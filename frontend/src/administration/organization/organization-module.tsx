import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { SelectField } from '../../components/ui/select-field'
import { Card } from '../../components/ui/card'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { WorkspaceState } from '../../components/feedback/workspace-state'
import { Dialog } from '../../components/overlays/dialog'
import { DetailSection, ProfileHeader } from '../../patterns/shared-patterns'
import type { OrganizationRoute } from '../admin-routes'
import { mockOrganizationRepository, type OrganizationRepository } from './mock-organization-repository'
import { apiOrganizationRepository } from './api-organization-repository'
import { usePermissionPreview } from '../../operations/permissions'
import { PermissionGate } from '../../operations/ui'
import { kindDefinition, organizationKinds, type OrganizationDraft, type OrganizationRecord } from './organization-model'
import { OrganizationForm } from './organization-form'
import './organization-module.css'

const base = '/administration/organization'
const detailPath = (record: OrganizationRecord) => `${base}/${record.kind}/${encodeURIComponent(record.id)}`
const dateLabel = (value: string) => new Date(value).toLocaleDateString()
const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
const defaultRepository = apiMode ? apiOrganizationRepository : mockOrganizationRepository

export function OrganizationModule({ route, onNavigate, repository = defaultRepository }: { route: OrganizationRoute; onNavigate: (path: string) => void; repository?: OrganizationRepository }) {
  const preview = usePermissionPreview()
  const [records, setRecords] = useState<OrganizationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const reload = useCallback(async () => { setLoading(true); setError(''); try { setRecords(await repository.list()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load organization data.') } finally { setLoading(false) } }, [repository])
  useEffect(() => { void reload() }, [reload])
  const parentName = useCallback((record: OrganizationRecord) => records.find(item => item.id === record.parentId)?.name ?? (record.parentId ? 'Unavailable parent' : 'Root'), [records])
  const columns = useMemo<DataTableColumn<OrganizationRecord>[]>(() => [
    { id: 'name', header: 'Name', value: item => item.name, width: 210 },
    { id: 'parent', header: 'Parent', value: parentName, width: 210 },
    { id: 'description', header: 'Description', value: item => item.description, width: 260 },
    { id: 'status', header: 'Status', value: item => item.status, width: 120, cell: item => <Badge tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
    { id: 'updated', header: 'Updated', value: item => dateLabel(item.updatedAt), width: 140 },
  ], [parentName])

  const tree = (parentId: string): ReactNode => {
    const children = records.filter(item => item.parentId === parentId)
    return children.length ? <ul>{children.map(item => <li key={item.id}><button type="button" onClick={() => onNavigate(detailPath(item))}>{item.name}</button><span>{kindDefinition(item.kind).singular} · {item.status === 'active' ? 'Active' : 'Inactive'}</span>{tree(item.id)}</li>)}</ul> : null
  }
  if (apiMode && !preview.loading && !preview.error && (route.mode === 'create' || route.mode === 'edit') && !preview.can('Organization', 'edit')) return <WorkspaceState kind="permission" title="Permission required" description="Your User Type needs Organization: edit permission." />
  const content = <div className="amafh-organization-module">
    <nav className="amafh-organization-tabs" aria-label="Organization views"><button type="button" aria-current={route.mode === 'overview' ? 'page' : undefined} onClick={() => onNavigate(base)}>Overview</button>{organizationKinds.map(kind => <button key={kind.id} type="button" aria-current={route.mode !== 'overview' && route.kind === kind.id ? 'page' : undefined} onClick={() => onNavigate(`${base}/${kind.id}`)}>{kind.label}</button>)}</nav>
    {route.mode === 'overview' ? loading ? <WorkspaceState kind="loading" title="Loading organization" /> : error ? <WorkspaceState kind="error" title="Could not load organization" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} /> : <><div className="amafh-organization-summary">{organizationKinds.map(kind => <Card key={kind.id}><strong>{records.filter(item => item.kind === kind.id).length}</strong><span>{kind.label}</span></Card>)}</div><Card className="amafh-organization-hierarchy"><h2 className="amafh-h4">Organization hierarchy</h2>{records.length ? <div className="amafh-organization-tree">{tree('')}</div> : <WorkspaceState kind="empty" title="Nothing here yet" description="No organization records are available." />}</Card></>
      : route.mode === 'list' ? <DataTable tableId={`administration-organization-${route.kind}`} caption={kindDefinition(route.kind).label} columns={columns} rows={records.filter(item => item.kind === route.kind)} rowId={item => item.id} state={loading ? 'loading' : error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} onRefresh={() => { void reload() }} filters={item => statusFilter === 'all' || item.status === statusFilter} filterControls={<div className="amafh-organization-filter"><SelectField label="Status" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></div>} rowActions={item => <Button variant="secondary" size="compact" onClick={() => onNavigate(detailPath(item))}>View</Button>} />
        : loading ? <WorkspaceState kind="loading" title="Loading organization record" /> : error ? <WorkspaceState kind="error" title="Could not load organization record" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} /> : route.mode === 'create' ? <OrganizationForm kind={route.kind} records={records} onCancel={() => onNavigate(`${base}/${route.kind}`)} onSave={async (draft: OrganizationDraft) => { const created = await repository.create(draft); setRecords(current => [...current, created]); onNavigate(detailPath(created)) }} />
          : (() => {
            const record = records.find(item => item.id === route.id && item.kind === route.kind)
            if (!record) return <WorkspaceState kind="error" title="Organization record not found" description="This local structure record is unavailable." action={<Button onClick={() => onNavigate(`${base}/${route.kind}`)}>Back to list</Button>} />
            if (route.mode === 'edit') return <OrganizationForm key={record.id} kind={route.kind} initial={record} records={records} editingId={record.id} onCancel={() => onNavigate(detailPath(record))} onSave={async (draft: OrganizationDraft) => { const updated = await repository.update(record.id, draft); setRecords(current => current.map(item => item.id === record.id ? updated : item)); onNavigate(detailPath(updated)) }} />
            const parent = records.find(item => item.id === record.parentId)
            const children = records.filter(item => item.parentId === record.id)
            const confirmDelete = async () => {
              if (deletePending || children.length) return
              setDeletePending(true); setDeleteError('')
              try { await repository.remove(record.id); setRecords(current => current.filter(item => item.id !== record.id)); setDeleteOpen(false); onNavigate(`${base}/${route.kind}`) }
              catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'Could not delete the organization record.') }
              finally { setDeletePending(false) }
            }
            return <div className="amafh-organization-detail"><ProfileHeader name={record.name} subtitle={kindDefinition(record.kind).singular} status={record.status === 'active' ? 'Active' : 'Inactive'} statusTone={record.status === 'active' ? 'success' : 'neutral'} actions={!apiMode || preview.can('Organization', 'edit') ? <><Button onClick={() => onNavigate(`${detailPath(record)}/edit`)}>Edit {kindDefinition(record.kind).singular}</Button><Button variant="danger" onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>Delete {kindDefinition(record.kind).singular}</Button></> : undefined} /><DetailSection title="Structure information" items={[{ label: 'Description', value: record.description }, { label: 'Status', value: record.status === 'active' ? 'Active' : 'Inactive' }, { label: 'Parent', value: parent ? <button className="amafh-organization-link" type="button" onClick={() => onNavigate(detailPath(parent))}>{parent.name}</button> : 'Root' }, { label: 'Created', value: dateLabel(record.createdAt) }, { label: 'Updated', value: dateLabel(record.updatedAt) }]} /><Card className="amafh-organization-children"><h2 className="amafh-h4">Direct relationships</h2>{children.length ? <ul>{children.map(child => <li key={child.id}><button type="button" onClick={() => onNavigate(detailPath(child))}>{child.name}</button><span>{kindDefinition(child.kind).singular}</span></li>)}</ul> : <p>No child records.</p>}</Card><Dialog open={deleteOpen} onClose={() => { if (!deletePending) setDeleteOpen(false) }} title={`Delete ${kindDefinition(record.kind).singular}`} description={children.length ? `Cannot delete ${record.name}: ${children.length} related ${children.length === 1 ? 'record depends' : 'records depend'} on it.` : `Delete ${record.name}? This removes the structure record.`} actions={<><Button variant="secondary" disabled={deletePending} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" disabled={children.length > 0} loading={deletePending} onClick={() => { void confirmDelete() }}>Delete</Button></>}>{deleteError && <p className="amafh-organization-form__error" role="alert">{deleteError}</p>}</Dialog></div>
          })()}
  </div>
  return apiMode ? <PermissionGate preview={preview} domain="Organization" action="view">{content}</PermissionGate> : content
}
