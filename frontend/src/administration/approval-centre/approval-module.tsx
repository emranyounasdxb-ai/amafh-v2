import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { WorkspaceState } from '../../components/feedback/workspace-state'
import { Dialog } from '../../components/overlays/dialog'
import { TextField, TextareaField } from '../../components/ui/text-field'
import { ApprovalPanel, DetailSection, FormSection } from '../../patterns/shared-patterns'
import { validateApprovalDraft, type ApprovalDraft, type ApprovalErrors, type ApprovalRecord, type ApprovalStatus } from './approval-model'
import { mockApprovalRepository, type ApprovalRepository } from './mock-approval-repository'
import type { ApprovalRoute } from './approval-routes'
import '../managed/managed-module.css'
const base = '/administration/approval-centre'
const detailPath = (id: string) => `${base}/${encodeURIComponent(id)}`

function ApprovalForm({ initial, records, editingId, onSave, onCancel }: { initial?: ApprovalDraft; records: ApprovalRecord[]; editingId?: string; onSave: (draft: ApprovalDraft) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<ApprovalDraft>(() => initial ?? { title: '', description: '' })
  const [errors, setErrors] = useState<ApprovalErrors>({})
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (pending) return; const next = validateApprovalDraft(draft, records, editingId); setErrors(next); if (Object.keys(next).length) return; setPending(true); setSaveError(''); try { await onSave(draft) } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not save request.') } finally { setPending(false) } }
  return <form className="amafh-managed-form" noValidate onSubmit={event => { void submit(event) }}><FormSection title="Request details" description="Local demonstration request only; no workflow or external action is triggered."><div className="amafh-managed-form__fields"><TextField label="Title" value={draft.title} onChange={event => { setDraft(current => ({ ...current, title: event.target.value })); setErrors({}); setSaveError('') }} error={errors.title} required /><TextareaField label="Description" value={draft.description} onChange={event => { setDraft(current => ({ ...current, description: event.target.value })); setErrors({}); setSaveError('') }} error={errors.description} className="amafh-managed-form__wide" required /></div></FormSection>{Object.keys(errors).length > 0 && <p role="alert" className="amafh-managed-form__error">Check the highlighted fields.</p>}{saveError && <p role="alert" className="amafh-managed-form__error">{saveError}</p>}<div className="amafh-managed-form__actions"><Button variant="secondary" disabled={pending} onClick={onCancel}>Cancel</Button><Button type="submit" loading={pending}>{editingId ? 'Save changes' : 'Create Request'}</Button></div></form>
}

export function ApprovalModule({ route, onNavigate, repository = mockApprovalRepository }: { route: ApprovalRoute; onNavigate: (path: string) => void; repository?: ApprovalRepository }) {
  const [records, setRecords] = useState<ApprovalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const reload = useCallback(async () => { setLoading(true); setError(''); try { setRecords(await repository.list()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load requests.') } finally { setLoading(false) } }, [repository])
  useEffect(() => { void reload() }, [reload])
  const columns = useMemo<DataTableColumn<ApprovalRecord>[]>(() => [
    { id: 'title', header: 'Title', value: item => item.title, width: 220 }, { id: 'description', header: 'Description', value: item => item.description, width: 310 }, { id: 'status', header: 'Status', value: item => item.status, width: 130, cell: item => <Badge tone={item.status === 'approved' ? 'success' : 'neutral'}>{item.status[0].toUpperCase() + item.status.slice(1)}</Badge> }, { id: 'updated', header: 'Updated', value: item => new Date(item.updatedAt).toLocaleDateString(), width: 150 },
  ], [])
  if (route.mode === 'list') return <DataTable tableId="administration-approval-centre" caption="Approval Centre" columns={columns} rows={records} rowId={item => item.id} state={loading ? 'loading' : error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} onRefresh={() => { void reload() }} filters={item => statusFilter === 'all' || item.status === statusFilter} filterControls={<label className="amafh-managed-filters">Status <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>} rowActions={item => <Button variant="secondary" size="compact" onClick={() => onNavigate(detailPath(item.id))}>View</Button>} />
  if (loading) return <WorkspaceState kind="loading" title="Loading request" />
  if (error) return <WorkspaceState kind="error" title="Could not load request" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} />
  if (route.mode === 'create') return <ApprovalForm records={records} onCancel={() => onNavigate(base)} onSave={async draft => { const created = await repository.create(draft); setRecords(current => [...current, created]); onNavigate(detailPath(created.id)) }} />
  const item = records.find(record => record.id === route.id)
  if (!item) return <WorkspaceState kind="error" title="Request not found" description="This local request is unavailable." action={<Button onClick={() => onNavigate(base)}>Back to Approval Centre</Button>} />
  if (route.mode === 'edit') return <ApprovalForm key={item.id} initial={item} editingId={item.id} records={records} onCancel={() => onNavigate(detailPath(item.id))} onSave={async draft => { const updated = await repository.update(item.id, draft); setRecords(current => current.map(record => record.id === item.id ? updated : record)); onNavigate(detailPath(item.id)) }} />
  const decide = async (status: ApprovalStatus) => { if (pending) return; setPending(true); setActionError(''); try { const updated = await repository.decide(item.id, status); setRecords(current => current.map(record => record.id === item.id ? updated : record)) } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not save local decision.') } finally { setPending(false) } }
  const remove = async () => { if (pending) return; setPending(true); setActionError(''); try { await repository.remove(item.id); setDeleteOpen(false); setRecords(current => current.filter(record => record.id !== item.id)); onNavigate(base) } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not delete request.') } finally { setPending(false) } }
  return <div className="amafh-managed-detail"><ApprovalPanel title={item.title} summary={item.description} status={item.status[0].toUpperCase() + item.status.slice(1)} tone={item.status === 'approved' ? 'success' : 'neutral'} actions={<div className="amafh-managed-create"><Button disabled={pending} onClick={() => { void decide('approved') }}>Approve locally</Button><Button variant="secondary" disabled={pending} onClick={() => { void decide('rejected') }}>Reject locally</Button><Button variant="secondary" disabled={pending} onClick={() => { void decide('pending') }}>Reset to pending</Button><Button onClick={() => onNavigate(`${detailPath(item.id)}/edit`)}>Edit Request</Button><Button variant="danger" onClick={() => { setActionError(''); setDeleteOpen(true) }}>Delete Request</Button></div>} /><DetailSection title="Request information" items={[{ label: 'Status', value: item.status }, { label: 'Created', value: new Date(item.createdAt).toLocaleDateString() }, { label: 'Updated', value: new Date(item.updatedAt).toLocaleDateString() }]} />{actionError && !deleteOpen && <p className="amafh-managed-form__error" role="alert">{actionError}</p>}<Dialog open={deleteOpen} onClose={() => { if (!pending) setDeleteOpen(false) }} title="Delete Request" description={`Delete ${item.title}? This removes the local request.`} actions={<><Button variant="secondary" disabled={pending} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={pending} onClick={() => { void remove() }}>Delete</Button></>}>{actionError && <p role="alert" className="amafh-managed-form__error">{actionError}</p>}</Dialog></div>
}
