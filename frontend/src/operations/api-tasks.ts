import type { TaskDraft, TaskRecord, TaskStatus } from './tasks'

type ApiTask = {
  id: string; title: string; description: string; customer_id: string | null; case_id: string | null
  assigned_to_id: string; created_by_id: string; priority: TaskRecord['priority']
  status: TaskStatus; due_at: string; created_at: string; updated_at: string
  completed_at: string | null; notes: { id: string; text: string; actor_id: string; at: string }[]
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api/v1/tasks' + path, {
    credentials: 'include', ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    let message = 'Could not update Task.'
    try { const body = await response.json() as { error?: { message?: string } }; message = body.error?.message ?? message } catch { /* Use default. */ }
    throw new Error(message)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

function fromApi(item: ApiTask): TaskRecord {
  const due = new Date(item.due_at)
  const localDate = due.getFullYear() + '-' + String(due.getMonth() + 1).padStart(2, '0') + '-' + String(due.getDate()).padStart(2, '0')
  const localTime = String(due.getHours()).padStart(2, '0') + ':' + String(due.getMinutes()).padStart(2, '0')
  return { id: item.id, title: item.title, description: item.description,
    customerId: item.customer_id ?? '', caseId: item.case_id ?? '',
    assignedTo: item.assigned_to_id, createdBy: item.created_by_id,
    priority: item.priority, status: item.status, dueDate: localDate,
    dueTime: localTime, createdAt: item.created_at, updatedAt: item.updated_at,
    completedAt: item.completed_at ?? '',
    notes: item.notes.map(note => ({ id: note.id, text: note.text, actorId: note.actor_id, at: note.at })) }
}

function toApi(draft: TaskDraft) {
  const due = new Date(draft.dueDate + 'T' + draft.dueTime + ':00')
  if (!Number.isFinite(due.getTime())) throw new Error('Enter a valid Due Date and Time.')
  return { title: draft.title, description: draft.description,
    customer_id: draft.customerId || null, case_id: draft.caseId || null,
    assigned_to_id: draft.assignedTo, priority: draft.priority,
    due_at: due.toISOString() }
}

export const apiTasksRepository = {
  async list(_actorId?: string): Promise<TaskRecord[]> { return (await request<ApiTask[]>('')).map(fromApi) },
  async create(draft: TaskDraft, _actorId?: string): Promise<TaskRecord> { return fromApi(await request<ApiTask>('', { method: 'POST', body: JSON.stringify(toApi(draft)) })) },
  async update(id: string, draft: TaskDraft, _actorId?: string): Promise<TaskRecord> { return fromApi(await request<ApiTask>('/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(toApi(draft)) })) },
  async setStatus(id: string, status: TaskStatus, _actorId?: string): Promise<TaskRecord> { return fromApi(await request<ApiTask>('/' + encodeURIComponent(id) + '/status', { method: 'POST', body: JSON.stringify({ status }) })) },
  async addNote(id: string, text: string, _actorId?: string): Promise<TaskRecord> { return fromApi(await request<ApiTask>('/' + encodeURIComponent(id) + '/notes', { method: 'POST', body: JSON.stringify({ text }) })) },
  async remove(id: string, _actorId?: string): Promise<void> { await request<void>('/' + encodeURIComponent(id), { method: 'DELETE' }) },
}
