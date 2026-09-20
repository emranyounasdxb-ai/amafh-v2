import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DataTable } from './data-table'
import type { DataTableColumn, TablePreferenceAdapter, TablePreferences } from './data-table'

type Row = { id: string; item: string; owner: string }
const rows: Row[] = [{ id: '1', item: 'Beta', owner: 'Team B' }, { id: '2', item: 'Alpha', owner: 'Team A' }, { id: '3', item: 'Gamma', owner: 'Team C' }]
const columns: DataTableColumn<Row>[] = [{ id: 'item', header: 'Item', value: row => row.item }, { id: 'owner', header: 'Owner', value: row => row.owner }]
afterEach(cleanup)

function adapter(): TablePreferenceAdapter & { getSaved: () => TablePreferences | null } {
  let saved: TablePreferences | null = null
  return { load: () => saved, save: (_key, value) => { saved = value }, getSaved: () => saved }
}

describe('generic DataTable', () => {
  test('sorts, filters, paginates, and selects visible rows', () => {
    const onSelectionChange = vi.fn()
    render(<DataTable tableId="test" columns={columns} rows={rows} rowId={row => row.id} pageSize={2} preferenceAdapter={adapter()} onSelectionChange={onSelectionChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Item' }))
    expect(screen.getByRole('columnheader', { name: /Item/ }).getAttribute('aria-sort')).toBe('ascending')
    expect(screen.getAllByRole('row')[1].textContent).toContain('Alpha')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText(/Page 2 of 2/)).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 3' }))
    expect(onSelectionChange).toHaveBeenLastCalledWith(['3'])
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'Beta' } })
    expect(screen.getByText(/Page 1 of 1/)).toBeTruthy()
    expect(screen.getByText('Beta')).toBeTruthy()
  })

  test('reorders, resizes, hides, pins, and persists column preferences', () => {
    const preferences = adapter()
    render(<DataTable tableId="test-controls" columns={columns} rows={rows} rowId={row => row.id} preferenceAdapter={preferences} />)
    fireEvent.dragStart(screen.getByRole('columnheader', { name: /Owner/ }))
    fireEvent.dragOver(screen.getByRole('columnheader', { name: /Item/ }))
    fireEvent.drop(screen.getByRole('columnheader', { name: /Item/ }))
    expect(preferences.getSaved()?.order).toEqual(['owner', 'item'])

    const resize = screen.getByRole('button', { name: 'Resize Owner' })
    fireEvent.keyDown(resize, { key: 'ArrowRight' })
    expect(preferences.getSaved()?.widths.owner).toBe(188)

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }))
    const panel = document.getElementById('test-controls-columns')!
    fireEvent.change(within(panel).getByRole('combobox', { name: 'Pin Owner' }), { target: { value: 'left' } })
    expect(preferences.getSaved()?.pinned.owner).toBe('left')
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Item' }))
    expect(preferences.getSaved()?.hidden).toContain('item')
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(preferences.getSaved()?.hidden).toEqual([])
    expect(preferences.getSaved()?.pinned).toEqual({})
  })

  test('keeps permission and error states separate from row data', () => {
    const { rerender } = render(<DataTable tableId="restricted" columns={columns} rows={rows} rowId={row => row.id} state="permission" preferenceAdapter={adapter()} />)
    expect(screen.getByText('Access restricted')).toBeTruthy()
    expect(screen.queryByText('Beta')).toBeNull()
    const retry = vi.fn()
    rerender(<DataTable tableId="restricted" columns={columns} rows={rows} rowId={row => row.id} state="error" error="Network unavailable" onRetry={retry} preferenceAdapter={adapter()} />)
    expect(screen.getByText('Network unavailable')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  test('composes external filters and row actions with partial selection', () => {
    const { rerender } = render(<DataTable tableId="filtered" columns={columns} rows={rows} rowId={row => row.id} filters={row => row.owner !== 'Team C'} filterControls={<button type="button">Filter control</button>} activeFilters={<span>Team filter</span>} rowActions={row => <button type="button">View {row.id}</button>} preferenceAdapter={adapter()} />)
    expect(screen.getByText('Team filter')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View 1' })).toBeTruthy()
    expect(screen.queryByText('Gamma')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row 1' }))
    expect((screen.getByRole('checkbox', { name: 'Select all rows on this page' }) as HTMLInputElement).indeterminate).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }))
    expect((screen.getByRole('checkbox', { name: 'Select row 2' }) as HTMLInputElement).checked).toBe(true)
    rerender(<DataTable tableId="filtered" columns={columns} rows={rows} rowId={row => row.id} filters={() => false} preferenceAdapter={adapter()} />)
    expect(screen.getByText('No results')).toBeTruthy()
  })

  test('exposes caller-owned export and stale refresh actions', () => {
    const onExport = vi.fn()
    const onRefresh = vi.fn()
    render(<DataTable tableId="operations" columns={columns} rows={rows} rowId={row => row.id} onExport={onExport} onRefresh={onRefresh} freshness={{ state: 'stale', label: 'Update delayed' }} preferenceAdapter={adapter()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onExport).toHaveBeenCalledOnce()
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(screen.getByText('Update delayed').closest('[role="status"]')).toBeTruthy()
  })
})
