import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { WorkspaceState } from '../../components/feedback/workspace-state'
import { DetailSection, ProfileHeader } from '../../patterns/shared-patterns'
import type { PermissionsRoute } from '../admin-routes'
import { mockUserTypesRepository, type UserTypesRepository } from '../user-types/mock-user-types-repository'
import type { UserTypeRecord } from '../user-types/user-types-model'
import { mockPermissionsRepository, type PermissionsRepository } from './mock-permissions-repository'
import { permissionDomains, type PermissionDraft, type PermissionRecord } from './permissions-model'
import { PermissionForm } from './permission-form'
import './permissions-module.css'

const listPath = '/administration/permissions'
const detailPath = (id: string) => `${listPath}/${encodeURIComponent(id)}`
const dateLabel = (value: string) => new Date(value).toLocaleDateString()

export function PermissionsModule({ route, onNavigate, repository = mockPermissionsRepository, typesRepository = mockUserTypesRepository }: { route: PermissionsRoute; onNavigate: (path: string) => void; repository?: PermissionsRepository; typesRepository?: UserTypesRepository }) {
  const [records, setRecords] = useState<PermissionRecord[]>([])
  const [types, setTypes] = useState<UserTypeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [domainFilter, setDomainFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try { const [nextRecords, nextTypes] = await Promise.all([repository.list(), typesRepository.list()]); setRecords(nextRecords); setTypes(nextTypes) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load permissions.') }
    finally { setLoading(false) }
  }, [repository, typesRepository])
  useEffect(() => { void reload() }, [reload])
  const typeNames = useCallback((record: PermissionRecord) => record.userTypeIds.map(id => types.find(type => type.id === id)?.name ?? 'Unavailable User Type').join(', ') || 'None', [types])
  const columns = useMemo<DataTableColumn<PermissionRecord>[]>(() => [
    { id: 'domain', header: 'Domain', value: item => item.domain, width: 170 },
    { id: 'action', header: 'Action', value: item => item.action, width: 120 },
    { id: 'description', header: 'Description', value: item => item.description, width: 260 },
    { id: 'state', header: 'State', value: item => item.enabled ? 'Enabled' : 'Disabled', width: 120, cell: item => <Badge tone={item.enabled ? 'success' : 'neutral'}>{item.enabled ? 'Enabled' : 'Disabled'}</Badge> },
    { id: 'userTypes', header: 'User Types', value: typeNames, width: 210 },
    { id: 'updatedAt', header: 'Updated', value: item => dateLabel(item.updatedAt), width: 130 },
  ], [typeNames])
  if (route.mode === 'list') return <DataTable tableId="administration-permissions" caption="Permissions" columns={columns} rows={records} rowId={item => item.id} state={loading ? 'loading' : error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} onRefresh={() => { void reload() }} pageSize={10} filters={item => (domainFilter === 'all' || item.domain === domainFilter) && (stateFilter === 'all' || (item.enabled ? 'enabled' : 'disabled') === stateFilter)} filterControls={<div className="amafh-permissions-filters"><label>Domain <select value={domainFilter} onChange={event => setDomainFilter(event.target.value)}><option value="all">All domains</option>{permissionDomains.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label>State <select value={stateFilter} onChange={event => setStateFilter(event.target.value)}><option value="all">All states</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label></div>} rowActions={item => <Button variant="secondary" size="compact" onClick={() => onNavigate(detailPath(item.id))}>View</Button>} />
  if (loading) return <WorkspaceState kind="loading" title="Loading permission" />
  if (error) return <WorkspaceState kind="error" title="Could not load permission" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} />
  if (route.mode === 'create') return <PermissionForm records={records} types={types} onCancel={() => onNavigate(listPath)} onSave={async (draft: PermissionDraft) => { const created = await repository.create(draft); setRecords(current => [...current, created]); onNavigate(detailPath(created.id)) }} />
  const record = records.find(item => item.id === route.id)
  if (!record) return <WorkspaceState kind="error" title="Permission not found" description="This local permission is unavailable." action={<Button onClick={() => onNavigate(listPath)}>Back to Permissions</Button>} />
  if (route.mode === 'edit') return <PermissionForm key={record.id} initial={record} editingId={record.id} records={records} types={types} onCancel={() => onNavigate(detailPath(record.id))} onSave={async (draft: PermissionDraft) => { const updated = await repository.update(record.id, draft); setRecords(current => current.map(item => item.id === record.id ? updated : item)); onNavigate(detailPath(record.id)) }} />
  return <div className="amafh-permissions-detail"><ProfileHeader name={`${record.domain} · ${record.action}`} subtitle="Permission configuration" status={record.enabled ? 'Enabled' : 'Disabled'} statusTone={record.enabled ? 'success' : 'neutral'} actions={<Button onClick={() => onNavigate(`${detailPath(record.id)}/edit`)}>Edit Permission</Button>} /><DetailSection title="Permission information" items={[{ label: 'Domain', value: record.domain }, { label: 'Action', value: record.action }, { label: 'Description', value: record.description }, { label: 'State', value: record.enabled ? 'Enabled' : 'Disabled' }, { label: 'User Types', value: typeNames(record) }, { label: 'Created', value: dateLabel(record.createdAt) }, { label: 'Updated', value: dateLabel(record.updatedAt) }]} /></div>
}
