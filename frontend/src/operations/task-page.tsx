import { useEffect, useState, type FormEvent } from 'react'
import { Workspace } from '../templates/workspace'
import { ActivityTimeline, ConfirmationDialog, DetailSection, FormSection } from '../patterns/shared-patterns'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { SelectField } from '../components/ui/select-field'
import { TextField, TextareaField } from '../components/ui/text-field'
import { DataTable, type DataTableColumn } from '../components/data-table/data-table'
import { WorkspaceState } from '../components/feedback/workspace-state'
import { mockCustomerRepository } from '../customers/mock-customer-repository'
import { mockApplicationRepository } from '../customers/mock-customer-repository'
import { customerName, type ApplicationRecord, type CustomerRecord } from '../customers/customer-model'
import { tasksRepository, emptyTaskDraft, taskAging, type TaskDraft, type TaskRecord, type TaskStatus } from './tasks'
import { apiTasksRepository } from './api-tasks'
import { apiCustomerRepository, loadApiCaseOwners } from '../customers/api-customer-repository'
import { apiCaseRepository } from '../cases/api-case-repository'
import { usePermissionPreview } from './permissions'
import { PermissionActor, PermissionGate } from './ui'
import './operations.css'

function TaskForm({ initial, users, customers, cases, onSave, onCancel }: { initial?: TaskDraft; users: { id: string; fullName: string; status: string }[]; customers: CustomerRecord[]; cases: ApplicationRecord[]; onSave: (draft: TaskDraft) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<TaskDraft>(initial ?? emptyTaskDraft())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await onSave(draft) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save Task.') } finally { setBusy(false) } }
  const change = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft(current => ({ ...current, [key]: value, ...(key === 'customerId' ? { caseId: '' } : {}) }))
  return <form noValidate onSubmit={event => { void submit(event) }}><FormSection title={initial ? 'Edit Task' : 'Create Task'}><div className="amafh-ops-fields"><TextField label="Task Title" value={draft.title} onChange={event => change('title', event.target.value)} required /><SelectField label="Assigned To" value={draft.assignedTo} onValueChange={value => change('assignedTo', value)} options={users.filter(item => item.status === 'active').map(item => ({ value: item.id, label: item.fullName }))} required /><SelectField label="Priority" value={draft.priority} onValueChange={value => change('priority', value as TaskDraft['priority'])} options={['Low', 'Medium', 'High', 'Urgent'].map(value => ({ value, label: value }))} /><SelectField label="Related Customer" value={draft.customerId || 'none'} onValueChange={value => change('customerId', value === 'none' ? '' : value)} options={[{ value: 'none', label: 'None' }, ...customers.map(item => ({ value: item.id, label: customerName(item) }))]} /><SelectField label="Related Case" value={draft.caseId || 'none'} onValueChange={value => change('caseId', value === 'none' ? '' : value)} options={[{ value: 'none', label: 'None' }, ...cases.filter(item => !draft.customerId || item.customerId === draft.customerId).map(item => ({ value: item.id, label: item.caseNumber }))]} /><TextField label="Due Date" type="date" value={draft.dueDate} onChange={event => change('dueDate', event.target.value)} required /><TextField label="Due Time" type="time" value={draft.dueTime} onChange={event => change('dueTime', event.target.value)} required /><TextareaField label="Description" value={draft.description} onChange={event => change('description', event.target.value)} /></div></FormSection>{error && <p role="alert" className="amafh-case-error">{error}</p>}<div className="amafh-ops-actions"><Button type="submit" loading={busy}>Save Task</Button><Button variant="secondary" onClick={onCancel}>Cancel</Button></div></form>
}
export function TaskPage({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
  const repository = apiMode ? apiTasksRepository : tasksRepository
  const preview = usePermissionPreview()
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [users, setUsers] = useState<{ id: string; fullName: string; status: string }[]>([])
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [cases, setCases] = useState<ApplicationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState(false)
  const [note, setNote] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const reload = async () => { if (!preview.actorId || !preview.can('Tasks', 'view')) { setLoading(false); return }; setLoading(true); setError(''); try {
    const [nextTasks, nextCustomers, nextCases, nextUsers] = await Promise.all([
      apiMode ? apiTasksRepository.list() : repository.list(preview.actorId),
      apiMode ? (preview.can('Customers', 'view') ? apiCustomerRepository.list() : Promise.resolve([])) : mockCustomerRepository.list(),
      apiMode ? (preview.can('Cases', 'view') ? apiCaseRepository.list() : Promise.resolve([])) : mockApplicationRepository.list(),
      apiMode ? loadApiCaseOwners() : Promise.resolve(preview.users),
    ])
    setTasks(nextTasks); setCustomers(nextCustomers); setCases(nextCases); setUsers(nextUsers)
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load Tasks.') } finally { setLoading(false) } }
  useEffect(() => { void reload() }, [preview.actorId, preview.permissions, preview.loading])
  const selectedId = path.startsWith('/tasks/') ? decodeURIComponent(path.slice(7)) : ''
  const selected = tasks.find(item => item.id === selectedId)
  const userName = (id: string) => users.find(item => item.id === id)?.fullName ?? 'Unavailable'
  const act = async (operation: () => Promise<unknown>, nextPath?: string) => { setError(''); try { await operation(); await reload(); if (nextPath) onNavigate(nextPath); setEdit(false); setCreate(false); setDeleteOpen(false); setNote('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update Task.') } }
  const columns: DataTableColumn<TaskRecord>[] = [{ id: 'title', header: 'Task Title', value: item => item.title, width: 220 }, { id: 'assigned', header: 'Assigned To', value: item => userName(item.assignedTo) }, { id: 'priority', header: 'Priority', value: item => item.priority }, { id: 'status', header: 'Status', value: item => item.status }, { id: 'due', header: 'Due', value: item => `${item.dueDate} ${item.dueTime}` }, { id: 'aging', header: 'Due State', value: item => taskAging(item), cell: item => <Badge tone={taskAging(item) === 'Overdue' ? 'danger' : taskAging(item) === 'Due Soon' || taskAging(item) === 'Due Today' ? 'warning' : 'neutral'}>{taskAging(item)}</Badge> }]
  return <Workspace title={selectedId ? 'Task detail' : 'Tasks / Activities'} description="Operational assignments and due states."><PermissionActor preview={preview} /><PermissionGate preview={preview} domain="Tasks" action="view">
    {error && <p role="alert" className="amafh-case-error">{error}</p>}
    {loading ? <WorkspaceState kind="loading" title="Loading Tasks" /> : !selectedId ? <div className="amafh-ops-grid">
      <div className="amafh-ops-actions">{preview.can('Tasks', 'create') && <Button onClick={() => setCreate(true)}>Create Task</Button>}<label>View <select aria-label="Task view" value={filter} onChange={event => setFilter(event.target.value)}>{['all', 'my', 'assigned', 'Open', 'In Progress', 'Completed', 'Due Today', 'Due Soon', 'Overdue'].map(value => <option key={value} value={value}>{value === 'my' ? 'My Tasks' : value === 'assigned' ? 'Assigned Tasks' : value}</option>)}</select></label></div>
      {create && <TaskForm users={users} customers={customers} cases={cases} onCancel={() => setCreate(false)} onSave={async draft => { const created = await repository.create(draft, preview.actorId); await reload(); setCreate(false); onNavigate(`/tasks/${created.id}`) }} />}
      <DataTable tableId="tasks" caption="Tasks" columns={columns} rows={tasks} rowId={item => item.id} state={error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} pageSize={10} filters={item => filter === 'all' || filter === 'my' && item.assignedTo === preview.actorId || filter === 'assigned' && item.createdBy === preview.actorId || item.status === filter || taskAging(item) === filter} rowActions={item => <Button variant="secondary" size="compact" onClick={() => onNavigate(`/tasks/${item.id}`)}>View</Button>} />
    </div> : !selected ? <WorkspaceState kind="empty" title="Task was not found" /> : <div className="amafh-ops-grid"><DetailSection title={selected.title} items={[{ label: 'Status', value: selected.status }, { label: 'Priority', value: selected.priority }, { label: 'Assigned To', value: userName(selected.assignedTo) }, { label: 'Created By', value: userName(selected.createdBy) }, { label: 'Due', value: `${selected.dueDate} ${selected.dueTime}` }, { label: 'Due State', value: <Badge tone={taskAging(selected) === 'Overdue' ? 'danger' : 'warning'}>{taskAging(selected)}</Badge> }, { label: 'Created', value: new Date(selected.createdAt).toLocaleString() }, { label: 'Completed', value: selected.completedAt ? new Date(selected.completedAt).toLocaleString() : '—' }, { label: 'Related Customer', value: customers.find(item => item.id === selected.customerId) ? customerName(customers.find(item => item.id === selected.customerId)!) : '—' }, { label: 'Related Case', value: cases.find(item => item.id === selected.caseId)?.caseNumber ?? '—' }, { label: 'Description', value: selected.description || '—' }]} />
      <div className="amafh-ops-actions"><Button variant="secondary" onClick={() => onNavigate('/tasks')}>Back to Tasks</Button>{selected.status !== 'Completed' && selected.status !== 'Cancelled' && <>{(preview.can('Tasks', 'edit') || preview.can('Tasks', 'assign')) && <Button variant="secondary" onClick={() => setEdit(true)}>Edit Task</Button>}{selected.status === 'Open' && preview.can('Tasks', 'edit') && <Button variant="secondary" onClick={() => { void act(() => repository.setStatus(selected.id, 'In Progress', preview.actorId)) }}>Start Task</Button>}{preview.can('Tasks', 'complete') && <Button onClick={() => { void act(() => repository.setStatus(selected.id, 'Completed', preview.actorId)) }}>Complete</Button>}{preview.can('Tasks', 'cancel') && <Button variant="secondary" onClick={() => { void act(() => repository.setStatus(selected.id, 'Cancelled', preview.actorId)) }}>Cancel Task</Button>}</>}{preview.can('Tasks', 'delete') && <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete Task</Button>}</div>
      {edit && <TaskForm initial={selected} users={users} customers={customers} cases={cases} onCancel={() => setEdit(false)} onSave={async draft => { await repository.update(selected.id, draft, preview.actorId); await reload(); setEdit(false) }} />}
      <ActivityTimeline title="Task notes" events={selected.notes.map(item => ({ id: item.id, title: userName(item.actorId), detail: item.text, time: new Date(item.at).toLocaleString() }))} />{preview.can('Tasks', 'edit') && <FormSection title="Add note"><TextareaField label="Note" value={note} onChange={event => setNote(event.target.value)} /><Button disabled={!note.trim()} onClick={() => { void act(() => repository.addNote(selected.id, note, preview.actorId)) }}>Add note</Button></FormSection>}
      <ConfirmationDialog open={deleteOpen} title="Delete Task" description="Delete this Task?" confirmLabel="Delete" danger onClose={() => setDeleteOpen(false)} onConfirm={() => { void act(() => repository.remove(selected.id, preview.actorId), '/tasks') }} />
    </div>}
  </PermissionGate></Workspace>
}
