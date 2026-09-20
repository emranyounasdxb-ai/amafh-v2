import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { WorkspaceState } from '../../components/feedback/workspace-state'
import { Dialog } from '../../components/overlays/dialog'
import { SelectField } from '../../components/ui/select-field'
import { TextField, TextareaField } from '../../components/ui/text-field'
import { DetailSection, FormSection, ProfileHeader } from '../../patterns/shared-patterns'
import { emptyManagedDraft, validateManagedDraft, type ManagedConfig, type ManagedDraft, type ManagedErrors, type ManagedRecord } from './managed-model'
import type { ManagedRepository } from './managed-repository'
import type { ManagedRoute } from './managed-routes'
import './managed-module.css'
const detailPath = (config: ManagedConfig, item: ManagedRecord) => `/administration/${config.slug}/${item.kind}/${encodeURIComponent(item.id)}`
const listPath = (config: ManagedConfig, kind?: string | null) => `/administration/${config.slug}${kind ? `/${kind}` : ''}`

function ManagedForm({ config, kind, records, initial, editingId, onSave, onCancel }: { config: ManagedConfig; kind: string; records: ManagedRecord[]; initial?: ManagedDraft; editingId?: string; onSave: (draft: ManagedDraft) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<ManagedDraft>(() => initial ?? emptyManagedDraft(kind))
  const [errors, setErrors] = useState<ManagedErrors>({})
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(false)
  const definition = config.kinds.find(item => item.id === kind)!
  const update = <K extends keyof ManagedDraft>(key: K, value: ManagedDraft[K]) => { setDraft(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); setSaveError('') }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (pending) return
    const next = validateManagedDraft(config, draft, records, editingId)
    setErrors(next); if (Object.keys(next).length) return
    setPending(true); setSaveError('')
    try { await onSave(draft) } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not save the record.') } finally { setPending(false) }
  }
  return <form className="amafh-managed-form" noValidate onSubmit={event => { void submit(event) }}><FormSection title={`${definition.singular} details`} description={config.description}><div className="amafh-managed-form__fields">
    <TextField label={config.slug === 'system-settings' ? 'Key' : 'Name'} value={draft.name} onChange={event => update('name', event.target.value)} error={errors.name} required />
    <SelectField label="Status" value={draft.status} onValueChange={value => update('status', value as ManagedDraft['status'])} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} error={errors.status} required />
    {definition.parentKind && <SelectField label={config.kinds.find(item => item.id === definition.parentKind)?.singular ?? 'Parent'} value={draft.parentId} onValueChange={value => update('parentId', value)} options={records.filter(item => item.kind === definition.parentKind).map(item => ({ value: item.id, label: item.name }))} error={errors.parentId} required />}
    <TextareaField label="Description" value={draft.description} onChange={event => update('description', event.target.value)} error={errors.description} className="amafh-managed-form__wide" required />
    {definition.extraLabel && <TextareaField label={definition.extraLabel} value={draft.extra} onChange={event => update('extra', event.target.value)} error={errors.extra} className="amafh-managed-form__wide" required />}
  </div></FormSection>{Object.keys(errors).length > 0 && <p className="amafh-managed-form__error" role="alert">Check the highlighted fields.</p>}{saveError && <p className="amafh-managed-form__error" role="alert">{saveError}</p>}<div className="amafh-managed-form__actions"><Button variant="secondary" disabled={pending} onClick={onCancel}>Cancel</Button><Button type="submit" loading={pending}>{editingId ? 'Save changes' : `Create ${definition.singular}`}</Button></div></form>
}

export function ManagedModule({ config, route, onNavigate, repository }: { config: ManagedConfig; route: ManagedRoute; onNavigate: (path: string) => void; repository: ManagedRepository }) {
  const [records, setRecords] = useState<ManagedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const reload = useCallback(async () => { setLoading(true); setError(''); try { setRecords(await repository.list()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load records.') } finally { setLoading(false) } }, [repository])
  useEffect(() => { void reload() }, [reload])
  const kindName = (kind: string) => config.kinds.find(item => item.id === kind)?.singular ?? kind
  const parentName = useCallback((item: ManagedRecord) => records.find(parent => parent.id === item.parentId)?.name ?? '', [records])
  const columns = useMemo<DataTableColumn<ManagedRecord>[]>(() => [
    { id: 'name', header: config.slug === 'system-settings' ? 'Key' : 'Name', value: item => item.name, width: 220 },
    ...(config.kinds.length > 1 ? [{ id: 'type', header: 'Type', value: (item: ManagedRecord) => config.kinds.find(kind => kind.id === item.kind)?.singular ?? item.kind, width: 150 }] : []),
    ...(config.kinds.some(kind => kind.parentKind) ? [{ id: 'parent', header: 'Parent', value: parentName, width: 180 }] : []),
    { id: 'description', header: 'Description', value: item => item.description, width: 280 },
    { id: 'status', header: 'Status', value: item => item.status, width: 120, cell: item => <Badge tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
    { id: 'updated', header: 'Updated', value: item => new Date(item.updatedAt).toLocaleDateString(), width: 130 },
  ], [config, parentName])
  const base = listPath(config)
  const nav = <nav className="amafh-managed-nav" aria-label={`${config.label} views`}><button type="button" aria-current={route.mode === 'list' && route.kind === null ? 'page' : undefined} onClick={() => onNavigate(base)}>All</button>{config.kinds.map(kind => <button type="button" key={kind.id} aria-current={route.kind === kind.id ? 'page' : undefined} onClick={() => onNavigate(listPath(config, kind.id))}>{kind.label}</button>)}</nav>
  return <div className="amafh-managed-module">{nav}{route.mode === 'list' ? <>{route.kind === null && <div className="amafh-managed-create">{config.kinds.map(kind => <Button key={kind.id} variant="secondary" onClick={() => onNavigate(`${base}/${kind.id}/new`)}>Create {kind.singular}</Button>)}</div>}<DataTable tableId={`${config.slug}-${route.kind ?? 'all'}`} caption={route.kind ? config.kinds.find(item => item.id === route.kind)?.label : config.label} columns={columns} rows={records.filter(item => !route.kind || item.kind === route.kind)} rowId={item => item.id} state={loading ? 'loading' : error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} onRefresh={() => { void reload() }} filters={item => (statusFilter === 'all' || item.status === statusFilter) && (kindFilter === 'all' || item.kind === kindFilter)} filterControls={<div className="amafh-managed-filters"><SelectField label="Status" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />{config.kinds.length > 1 && !route.kind && <SelectField label="Type" value={kindFilter} onValueChange={setKindFilter} options={[{ value: "all", label: "All types" }, ...config.kinds.map(kind => ({ value: kind.id, label: kind.label }))]} />}</div>} rowActions={item => <Button variant="secondary" size="compact" onClick={() => onNavigate(detailPath(config, item))}>View</Button>} /></>
    : loading ? <WorkspaceState kind="loading" title="Loading record" /> : error ? <WorkspaceState kind="error" title="Could not load record" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} /> : route.mode === 'create' ? <ManagedForm config={config} kind={route.kind} records={records} onCancel={() => onNavigate(listPath(config, route.kind))} onSave={async draft => { const created = await repository.create(draft); setRecords(current => [...current, created]); onNavigate(detailPath(config, created)) }} />
      : (() => {
        const item = records.find(record => record.id === route.id && record.kind === route.kind)
        if (!item) return <WorkspaceState kind="error" title="Record not found" description="This local record is unavailable." action={<Button onClick={() => onNavigate(listPath(config, route.kind))}>Back to list</Button>} />
        if (route.mode === 'edit') return <ManagedForm key={item.id} config={config} kind={route.kind} initial={item} records={records} editingId={item.id} onCancel={() => onNavigate(detailPath(config, item))} onSave={async draft => { const updated = await repository.update(item.id, draft); setRecords(current => current.map(record => record.id === item.id ? updated : record)); onNavigate(detailPath(config, updated)) }} />
        const parent = records.find(record => record.id === item.parentId)
        const children = records.filter(record => record.parentId === item.id)
        const definition = config.kinds.find(kind => kind.id === item.kind)!
        const confirmDelete = async () => { if (deletePending || children.length) return; setDeletePending(true); setDeleteError(''); try { await repository.remove(item.id); setRecords(current => current.filter(record => record.id !== item.id)); setDeleteOpen(false); onNavigate(listPath(config, item.kind)) } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'Could not delete the record.') } finally { setDeletePending(false) } }
        return <div className="amafh-managed-detail"><ProfileHeader name={item.name} subtitle={definition.singular} status={item.status === 'active' ? 'Active' : 'Inactive'} statusTone={item.status === 'active' ? 'success' : 'neutral'} actions={<>{config.slug === 'banks-products' && item.kind === 'products' && <Button variant="secondary" onClick={() => onNavigate(`${detailPath(config, item)}/stages`)}>Product Stages</Button>}<Button onClick={() => onNavigate(`${detailPath(config, item)}/edit`)}>Edit {definition.singular}</Button><Button variant="danger" onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>Delete {definition.singular}</Button></>} /><DetailSection title="Configuration" items={[{ label: 'Description', value: item.description }, { label: 'Status', value: item.status === 'active' ? 'Active' : 'Inactive' }, ...(parent ? [{ label: kindName(parent.kind), value: <button className="amafh-managed-link" type="button" onClick={() => onNavigate(detailPath(config, parent))}>{parent.name}</button> }] : []), ...(definition.extraLabel ? [{ label: definition.extraLabel, value: item.extra }] : []), { label: 'Created', value: new Date(item.createdAt).toLocaleDateString() }, { label: 'Updated', value: new Date(item.updatedAt).toLocaleDateString() }]} />{children.length > 0 && <Card className="amafh-managed-children"><h2 className="amafh-h4">Related records</h2>{children.map(child => <button key={child.id} type="button" onClick={() => onNavigate(detailPath(config, child))}>{child.name}</button>)}</Card>}<Dialog open={deleteOpen} onClose={() => { if (!deletePending) setDeleteOpen(false) }} title={`Delete ${definition.singular}`} description={children.length ? `Cannot delete ${item.name}: ${children.length} related ${children.length === 1 ? 'record depends' : 'records depend'} on it.` : `Delete ${item.name}? This removes the local record.`} actions={<><Button variant="secondary" disabled={deletePending} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" disabled={children.length > 0} loading={deletePending} onClick={() => { void confirmDelete() }}>Delete</Button></>}>{deleteError && <p role="alert" className="amafh-managed-form__error">{deleteError}</p>}</Dialog></div>
      })()}</div>
}
