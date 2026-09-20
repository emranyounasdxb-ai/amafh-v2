import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/button'
import { SelectField } from '../../components/ui/select-field'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { WorkspaceState } from '../../components/feedback/workspace-state'
import { DetailSection, FormSection } from '../../patterns/shared-patterns'
import { mockAuditRepository, type AuditEntry, type AuditRepository } from './mock-audit-repository'
import type { AuditRoute } from './audit-routes'
import '../managed/managed-module.css'
import './audit-module.css'
export function AuditModule({ route, onNavigate, repository = mockAuditRepository }: { route: AuditRoute; onNavigate: (path: string) => void; repository?: AuditRepository }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const reload = useCallback(async () => { setLoading(true); setError(''); try { setEntries(await repository.list()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load audit samples.') } finally { setLoading(false) } }, [repository])
  useEffect(() => { void reload() }, [reload])
  const columns = useMemo<DataTableColumn<AuditEntry>[]>(() => [
    { id: 'event', header: 'Event', value: item => item.event, width: 200 }, { id: 'source', header: 'Source', value: item => item.source, width: 200 }, { id: 'summary', header: 'Summary', value: item => item.summary, width: 350 }, { id: 'occurred', header: 'Occurred', value: item => new Date(item.occurredAt).toLocaleString(), width: 210 },
  ], [])
  if (route.mode === 'list') return <div className="amafh-managed-module"><FormSection title={repository === mockAuditRepository ? 'Local audit samples' : 'Audit records'} description={repository === mockAuditRepository ? 'Illustrative records only.' : 'Read-only records of application and security changes.'}><span>{repository === mockAuditRepository ? 'Read-only sample entries' : 'Read-only entries'}</span></FormSection><DataTable tableId="administration-audit-log" caption="Audit Log" columns={columns} rows={entries} rowId={item => item.id} state={loading ? 'loading' : error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} onRefresh={() => { void reload() }} filters={item => sourceFilter === 'all' || item.source === sourceFilter} filterControls={<div className="amafh-managed-filters"><SelectField label="Source" value={sourceFilter} onValueChange={setSourceFilter} options={[{ value: "all", label: "All sources" }, ...[...new Set(entries.map(item => item.source))].map(source => ({ value: source, label: source }))]} /></div>} rowActions={item => <Button variant="secondary" size="compact" onClick={() => onNavigate(`/administration/audit-log/${encodeURIComponent(item.id)}`)}>View</Button>} /></div>
  if (loading) return <WorkspaceState kind="loading" title="Loading audit sample" />
  if (error) return <WorkspaceState kind="error" title="Could not load audit sample" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} />
  const entry = entries.find(item => item.id === route.id)
  if (!entry) return <WorkspaceState kind="error" title="Audit sample not found" action={<Button onClick={() => onNavigate('/administration/audit-log')}>Back to Audit Log</Button>} />
  return <div className="amafh-audit-detail"><DetailSection title={entry.event} items={[{ label: 'Source', value: entry.source }, { label: 'Summary', value: entry.summary }, { label: 'Actor', value: entry.actorId ?? '—' }, { label: 'Entity ID', value: entry.entityId ?? '—' }, { label: 'Before', value: entry.before ? JSON.stringify(entry.before) : '—' }, { label: 'After', value: entry.after ? JSON.stringify(entry.after) : '—' }, { label: 'Metadata', value: entry.metadata ? JSON.stringify(entry.metadata) : '—' }, { label: 'Occurred', value: new Date(entry.occurredAt).toLocaleString() }]} /></div>
}
