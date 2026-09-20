import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Columns3, GripVertical, Pin, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import { TextField } from '../ui/text-field'
import { WorkspaceState } from '../feedback/workspace-state'
import { Dropdown } from '../overlays/floating'
import './data-table.css'

export type TableDensity = 'compact' | 'default' | 'comfortable'
export type PinSide = 'left' | 'right' | null
export type SortDirection = 'asc' | 'desc'
export interface TableSort { id: string; direction: SortDirection }
export interface TablePreferences {
  version: 1
  order: string[]
  widths: Record<string, number>
  hidden: string[]
  pinned: Record<string, PinSide>
  density: TableDensity
  sort: TableSort | null
}
export interface TablePreferenceAdapter {
  load(key: string): TablePreferences | null
  save(key: string, value: TablePreferences): void
}
export const localTablePreferences: TablePreferenceAdapter = {
  load(key) {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(`amafh-table:${key}`) ?? 'null')
      return isTablePreferences(value) ? value : null
    } catch { return null }
  },
  save(key, value) { try { localStorage.setItem(`amafh-table:${key}`, JSON.stringify(value)) } catch { /* Storage may be unavailable. */ } },
}

function isTablePreferences(value: unknown): value is TablePreferences {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.version === 1 && Array.isArray(item.order) && item.order.every(id => typeof id === 'string') && typeof item.widths === 'object' && item.widths !== null && !Array.isArray(item.widths) && Array.isArray(item.hidden) && item.hidden.every(id => typeof id === 'string') && typeof item.pinned === 'object' && item.pinned !== null && !Array.isArray(item.pinned) && ['compact', 'default', 'comfortable'].includes(String(item.density)) && (item.sort === null || typeof item.sort === 'object' && !Array.isArray(item.sort))
}

export interface DataTableColumn<T> {
  id: string
  header: string
  value: (row: T) => string | number | null | undefined
  cell?: (row: T) => ReactNode
  width?: number
  minWidth?: number
  maxWidth?: number
  sortable?: boolean
  hideable?: boolean
  pinnable?: boolean
  fixed?: boolean
}

export type DataTableState = 'ready' | 'loading' | 'error' | 'permission'
export interface TableSavedView<T> {
  id: string
  label: string
  scope: 'default' | 'personal' | 'shared'
  preferences?: TablePreferences
  filter?: (row: T) => boolean
}
export interface DataTableProps<T> {
  tableId: string
  columns: DataTableColumn<T>[]
  rows: T[]
  rowId: (row: T) => string
  state?: DataTableState
  error?: string
  onRetry?: () => void
  pageSize?: number
  preferenceAdapter?: TablePreferenceAdapter
  onSelectionChange?: (ids: string[]) => void
  bulkActions?: (selectedIds: string[]) => ReactNode
  filter?: (row: T, query: string) => boolean
  filters?: (row: T) => boolean
  filterControls?: ReactNode
  activeFilters?: ReactNode
  rowActions?: (row: T) => ReactNode
  renderExpanded?: (row: T) => ReactNode
  caption?: string
  savedViews?: TableSavedView<T>[]
  onCreateSavedView?: (preferences: TablePreferences) => void
  onExport?: () => void
  onRefresh?: () => void
  freshness?: { state: 'fresh' | 'updating' | 'stale' | 'auto'; label: string }
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const defaultWidth = (column: DataTableColumn<unknown>) => column.width ?? 180

function defaultPreferences<T>(columns: DataTableColumn<T>[]): TablePreferences {
  return { version: 1, order: columns.map(column => column.id), widths: {}, hidden: [], pinned: {}, density: 'default', sort: null }
}

function reconcilePreferences<T>(saved: TablePreferences | null, columns: DataTableColumn<T>[]): TablePreferences {
  const initial = defaultPreferences(columns)
  if (!saved) return initial
  const ids = new Set(initial.order)
  const hidden = saved.hidden.filter(id => ids.has(id) && columns.find(column => column.id === id)?.hideable !== false)
  if (hidden.length === columns.length) hidden.shift()
  return {
    ...initial,
    order: [...saved.order.filter(id => ids.has(id)), ...initial.order.filter(id => !saved.order.includes(id))],
    widths: Object.fromEntries(Object.entries(saved.widths).filter(([id, width]) => ids.has(id) && Number.isFinite(width))),
    hidden,
    pinned: Object.fromEntries(Object.entries(saved.pinned).filter(([id, side]) => ids.has(id) && (side === 'left' || side === 'right' || side === null))),
    density: saved.density,
    sort: saved.sort && ids.has(saved.sort.id) && (saved.sort.direction === 'asc' || saved.sort.direction === 'desc') ? saved.sort : null,
  }
}

export function DataTable<T>({ tableId, columns, rows, rowId, state = 'ready', error, onRetry, pageSize = 10, preferenceAdapter = localTablePreferences, onSelectionChange, bulkActions, filter, filters, filterControls, activeFilters, rowActions, renderExpanded, caption, savedViews, onCreateSavedView, onExport, onRefresh, freshness }: DataTableProps<T>) {
  const [preferences, setPreferences] = useState(() => reconcilePreferences(preferenceAdapter.load(tableId), columns))
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string[]>([])
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [activeViewId, setActiveViewId] = useState<string | null>(savedViews?.[0]?.id ?? null)
  const dragColumnId = useRef<string | null>(null)
  const lastSelectedIndex = useRef<number | null>(null)
  const shiftSelection = useRef(false)
  const resize = useRef<{ id: string; startX: number; width: number; min: number; max: number } | null>(null)

  useEffect(() => { preferenceAdapter.save(tableId, preferences) }, [tableId, preferenceAdapter, preferences])
  useEffect(() => { onSelectionChange?.(selected) }, [onSelectionChange, selected])

  const ordered = useMemo(() => preferences.order.map(id => columns.find(column => column.id === id)).filter((column): column is DataTableColumn<T> => Boolean(column)), [columns, preferences.order])
  const visible = useMemo(() => {
    const shown = ordered.filter(column => !preferences.hidden.includes(column.id))
    return [...shown.filter(column => preferences.pinned[column.id] === 'left'), ...shown.filter(column => !preferences.pinned[column.id]), ...shown.filter(column => preferences.pinned[column.id] === 'right')]
  }, [ordered, preferences.hidden, preferences.pinned])
  const activeView = savedViews?.find(view => view.id === activeViewId)
  const filtered = useMemo(() => rows.filter(row => (!filters || filters(row)) && (!activeView?.filter || activeView.filter(row)) && (filter ? filter(row, query) : columns.some(column => String(column.value(row) ?? '').toLocaleLowerCase().includes(query.toLocaleLowerCase())))), [rows, filters, activeView, filter, query, columns])
  const sorted = useMemo(() => {
    if (!preferences.sort) return filtered
    const column = columns.find(item => item.id === preferences.sort?.id)
    if (!column) return filtered
    const direction = preferences.sort.direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => String(column.value(a) ?? '').localeCompare(String(column.value(b) ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * direction)
  }, [filtered, columns, preferences.sort])
  const safePageSize = Math.max(1, pageSize)
  const pages = Math.max(1, Math.ceil(sorted.length / safePageSize))
  const currentPage = Math.min(page, pages)
  const pageRows = sorted.slice((currentPage - 1) * safePageSize, currentPage * safePageSize)
  const pageIds = pageRows.map(rowId)
  const allSelected = pageIds.length > 0 && pageIds.every(id => selected.includes(id))
  const partlySelected = pageIds.some(id => selected.includes(id)) && !allSelected
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = partlySelected }, [partlySelected])

  const widthOf = (column: DataTableColumn<T>) => clamp(preferences.widths[column.id] ?? defaultWidth(column as DataTableColumn<unknown>), column.minWidth ?? 96, column.maxWidth ?? 480)
  const stickyFor = (column: DataTableColumn<T>): CSSProperties => {
    const side = preferences.pinned[column.id]
    if (!side) return {}
    const peers = visible.filter(item => preferences.pinned[item.id] === side)
    const index = peers.findIndex(item => item.id === column.id)
    const offset = peers.slice(side === 'left' ? 0 : index + 1, side === 'left' ? index : undefined).reduce((sum, item) => sum + widthOf(item), side === 'left' ? 44 : 0)
    return { position: 'sticky', [side]: offset, zIndex: 2 }
  }
  const update = (change: Partial<TablePreferences>) => setPreferences(current => ({ ...current, ...change }))
  const reset = () => { update(defaultPreferences(columns)); setAnnouncement('Columns reset') }
  const sortColumn = (id: string) => {
    const next: TableSort | null = preferences.sort?.id !== id ? { id, direction: 'asc' } : preferences.sort.direction === 'asc' ? { id, direction: 'desc' } : null
    update({ sort: next })
    setAnnouncement(`${columns.find(column => column.id === id)?.header ?? id} ${next?.direction ?? 'unsorted'}`)
  }
  const moveColumn = (source: string, target: string) => {
    if (source === target || columns.find(column => column.id === source)?.fixed) return
    const next = preferences.order.filter(id => id !== source)
    next.splice(next.indexOf(target), 0, source)
    update({ order: next })
    setAnnouncement(`${columns.find(column => column.id === source)?.header ?? source} moved`)
  }
  const onResizeMove = useCallback((event: PointerEvent) => {
    if (!resize.current) return
    const { id, startX, width, min, max } = resize.current
    setPreferences(current => ({ ...current, widths: { ...current.widths, [id]: clamp(width + event.clientX - startX, min, max) } }))
  }, [])
  const onResizeEnd = useCallback(() => { resize.current = null; window.removeEventListener('pointermove', onResizeMove); window.removeEventListener('pointerup', onResizeEnd) }, [onResizeMove])
  useEffect(() => () => { window.removeEventListener('pointermove', onResizeMove); window.removeEventListener('pointerup', onResizeEnd) }, [onResizeMove, onResizeEnd])

  if (state === 'permission') return <WorkspaceState kind="permission" title="Access restricted" description="You do not have permission to view these records." />

  return <section className="amafh-table-system" aria-label={caption ?? 'Data table'}>
    <div className="amafh-table-toolbar">
      {savedViews && savedViews.length > 0 && <Dropdown label="Saved views" trigger={<button type="button" className="amafh-table-saved-view" aria-label={`Saved view: ${activeView?.label ?? savedViews[0].label}`}><span>{activeView?.label ?? savedViews[0].label}</span><ChevronDown size={16} aria-hidden="true" /></button>} items={[...savedViews.map(view => ({ id: view.id, label: view.label, description: view.scope === 'default' ? 'Default' : view.scope === 'personal' ? 'Personal' : 'Shared', onSelect: () => { setActiveViewId(view.id); if (view.preferences) setPreferences(reconcilePreferences(view.preferences, columns)); setPage(1); setSelected([]); setAnnouncement(`${view.label} view selected`) } })), ...(onCreateSavedView ? [{ id: 'create-view', label: 'Create saved view', onSelect: () => onCreateSavedView(preferences) }] : [])]} />}
      <TextField label="Search" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Search records" />
      <div className="amafh-table-toolbar__actions">
        {filterControls}
        <label className="amafh-table-density amafh-table-advanced">Density <select value={preferences.density} onChange={event => update({ density: event.target.value as TableDensity })}><option value="compact">Compact</option><option value="default">Default</option><option value="comfortable">Comfortable</option></select><ChevronDown size={14} aria-hidden="true" /></label>
        <Button variant="secondary" icon={<Columns3 size={16} aria-hidden="true" />} aria-expanded={columnsOpen} aria-controls={`${tableId}-columns`} onClick={() => setColumnsOpen(open => !open)}>Columns</Button>
        {onExport && <span className="amafh-table-advanced"><Button variant="outline" onClick={onExport}>Export</Button></span>}
        {onRefresh && <span className="amafh-table-advanced"><Button variant="outline" onClick={onRefresh}>Refresh</Button></span>}
        <span className="amafh-table-advanced"><Button variant="outline" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={reset}>Reset</Button></span>
        <span className="amafh-table-more"><Dropdown label="More table actions" trigger={<Button variant="secondary" aria-label="More table actions" icon={<ChevronDown size={16} aria-hidden="true" />}>More</Button>} items={[{ id: 'compact', label: 'Compact density', onSelect: () => update({ density: 'compact' }) }, { id: 'default', label: 'Default density', onSelect: () => update({ density: 'default' }) }, { id: 'comfortable', label: 'Comfortable density', onSelect: () => update({ density: 'comfortable' }) }, ...(onExport ? [{ id: 'export', label: 'Export', onSelect: onExport }] : []), ...(onRefresh ? [{ id: 'refresh', label: 'Refresh', onSelect: onRefresh }] : []), { id: 'reset', label: 'Reset', onSelect: reset }]} /></span>
      </div>
    </div>
    {freshness && <div className={`amafh-table-freshness amafh-table-freshness--${freshness.state}`} role="status"><span>{freshness.label}</span>{freshness.state === 'stale' && onRefresh && <button type="button" onClick={onRefresh}>Retry</button>}{freshness.state === 'fresh' && onRefresh && <button type="button" onClick={onRefresh}>Refresh</button>}</div>}
    {activeFilters && <div className="amafh-table-active-filters">{activeFilters}</div>}
    {columnsOpen && <div className="amafh-table-column-panel" id={`${tableId}-columns`}>
      <strong>Manage columns</strong>
      {ordered.map(column => <div className="amafh-table-column-option" key={column.id}>
        <label><input type="checkbox" checked={!preferences.hidden.includes(column.id)} disabled={column.hideable === false || (!preferences.hidden.includes(column.id) && visible.length === 1)} onChange={event => update({ hidden: event.target.checked ? preferences.hidden.filter(id => id !== column.id) : [...preferences.hidden, column.id] })} /> {column.header}</label>
        <select aria-label={`Pin ${column.header}`} value={preferences.pinned[column.id] ?? 'none'} disabled={column.pinnable === false} onChange={event => update({ pinned: { ...preferences.pinned, [column.id]: event.target.value === 'none' ? null : event.target.value as PinSide } })}><option value="none">No pin</option><option value="left">Pin left</option><option value="right">Pin right</option></select>
      </div>)}
    </div>}
    {selected.length > 0 && <div className="amafh-table-bulk"><span>{selected.length} selected</span>{bulkActions?.(selected)}<Button variant="outline" size="compact" onClick={() => setSelected([])}>Clear selection</Button></div>}
    {state === 'loading' ? <WorkspaceState kind="loading" title="Loading records" /> : state === 'error' ? <WorkspaceState kind="error" title="Could not load records" description={error} action={onRetry && <Button onClick={onRetry}>Try again</Button>} /> : rows.length === 0 ? <WorkspaceState kind="empty" title="Nothing here yet" description="No records are available." /> : sorted.length === 0 ? <WorkspaceState kind="no-results" title="No results" description="Try a different search." action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>} /> : <>
      <div className="amafh-table-scroll" tabIndex={0} aria-label="Scrollable table region">
        <table className={`amafh-data-table amafh-data-table--${preferences.density}`} style={{ width: 44 + visible.reduce((sum, column) => sum + widthOf(column), 0) + (rowActions ? 116 : 0) }}>
          {caption && <caption>{caption}</caption>}
          <colgroup><col style={{ width: 44 }} />{visible.map(column => <col key={column.id} style={{ width: widthOf(column) }} />)}{rowActions && <col style={{ width: 116 }} />}</colgroup>
          <thead><tr><th className="amafh-data-table__selection" scope="col"><input ref={selectAllRef} type="checkbox" aria-label="Select all rows on this page" checked={allSelected} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, ...pageIds])] : current.filter(id => !pageIds.includes(id)))} /></th>
            {visible.map(column => <th key={column.id} scope="col" aria-sort={preferences.sort?.id === column.id ? preferences.sort.direction === 'asc' ? 'ascending' : 'descending' : undefined} style={stickyFor(column)} draggable={!column.fixed} onDragStart={() => { dragColumnId.current = column.id }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragColumnId.current) moveColumn(dragColumnId.current, column.id) }} onDragEnd={() => { dragColumnId.current = null }}>
              <div className="amafh-data-table__heading">
                {!column.fixed && <GripVertical size={14} aria-label={`Drag ${column.header} to reorder`} />}
                {column.sortable !== false ? <button type="button" className="amafh-data-table__sort" onClick={() => sortColumn(column.id)} onKeyDown={event => { if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); const index = preferences.order.indexOf(column.id); const target = preferences.order[index + (event.key === 'ArrowLeft' ? -1 : 1)]; if (target) moveColumn(column.id, target) } }}>{column.header}<span aria-hidden="true">{preferences.sort?.id === column.id ? preferences.sort.direction === 'asc' ? ' ↑' : ' ↓' : ''}</span></button> : <span>{column.header}</span>}
                {preferences.pinned[column.id] && <Pin size={12} aria-label={`Pinned ${preferences.pinned[column.id]}`} />}
                <button type="button" className="amafh-data-table__resize" aria-label={`Resize ${column.header}`} onPointerDown={event => { event.preventDefault(); resize.current = { id: column.id, startX: event.clientX, width: widthOf(column), min: column.minWidth ?? 96, max: column.maxWidth ?? 480 }; window.addEventListener('pointermove', onResizeMove); window.addEventListener('pointerup', onResizeEnd) }} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setPreferences(current => ({ ...current, widths: { ...current.widths, [column.id]: clamp(widthOf(column) + (event.key === 'ArrowLeft' ? -8 : 8), column.minWidth ?? 96, column.maxWidth ?? 480) } })) } }} />
              </div>
            </th>)}{rowActions && <th scope="col">Actions</th>}</tr></thead>
          <tbody>{pageRows.map(row => {
            const id = rowId(row)
            const isExpanded = expanded.includes(id)
            return <Fragment key={id}>
              <tr>
                <td className="amafh-data-table__selection"><input type="checkbox" aria-label={`Select row ${id}`} checked={selected.includes(id)} onClick={event => { shiftSelection.current = event.shiftKey }} onKeyDown={event => { shiftSelection.current = event.shiftKey }} onChange={event => { const index = sorted.findIndex(item => rowId(item) === id); const range = shiftSelection.current && lastSelectedIndex.current !== null ? sorted.slice(Math.min(index, lastSelectedIndex.current), Math.max(index, lastSelectedIndex.current) + 1).map(rowId) : [id]; setSelected(current => event.target.checked ? [...new Set([...current, ...range])] : current.filter(item => !range.includes(item))); lastSelectedIndex.current = index; shiftSelection.current = false }} /></td>
                {visible.map((column, index) => <td key={column.id} style={stickyFor(column)}><div className="amafh-data-table__cell">{renderExpanded && index === 0 && <button type="button" className="amafh-data-table__details" aria-label={`${isExpanded ? 'Hide' : 'Show'} details for row ${id}`} aria-expanded={isExpanded} onClick={() => setExpanded(current => isExpanded ? current.filter(item => item !== id) : [...current, id])}>{isExpanded ? '−' : '+'}</button>}{column.cell ? column.cell(row) : String(column.value(row) ?? '')}</div></td>)}{rowActions && <td className="amafh-data-table__actions">{rowActions(row)}</td>}
              </tr>
              {renderExpanded && isExpanded && <tr><td colSpan={visible.length + 1 + (rowActions ? 1 : 0)} className="amafh-table-expanded">{renderExpanded(row)}</td></tr>}
            </Fragment>
          })}</tbody>
        </table>
      </div>
      <div className="amafh-table-pagination"><span>{sorted.length} results · Page {currentPage} of {pages}</span><div><Button variant="outline" size="compact" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} icon={<ChevronLeft size={14} aria-hidden="true" />}>Previous</Button><Button variant="outline" size="compact" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} icon={<ChevronRight size={14} aria-hidden="true" />}>Next</Button></div></div>
    </>}
    <span className="amafh-sr-only" role="status" aria-live="polite">{announcement}</span>
  </section>
}
