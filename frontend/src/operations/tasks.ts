import { mockCustomerRepository, mockApplicationRepository } from '../customers/mock-customer-repository'
import { mockUsersRepository } from '../administration/users/mock-users-repository'
import { requireAction } from './permissions'
import { notificationsRepository } from './notifications'

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent'
export type TaskStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled'
export interface TaskDraft { title: string; description: string; customerId: string; caseId: string; assignedTo: string; priority: TaskPriority; dueDate: string; dueTime: string }
export interface TaskNote { id: string; text: string; actorId: string; at: string }
export interface TaskRecord extends TaskDraft { id: string; createdBy: string; status: TaskStatus; createdAt: string; updatedAt: string; completedAt: string; notes: TaskNote[] }
export const TASKS_KEY = 'amafh-v2.mock-tasks.v1'
export const emptyTaskDraft = (): TaskDraft => ({ title: '', description: '', customerId: '', caseId: '', assignedTo: '', priority: 'Medium', dueDate: '', dueTime: '17:00' })
function read(): TaskRecord[] {
  const raw = localStorage.getItem(TASKS_KEY)
  if (raw === null) return []
  try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed) && parsed.every(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.assignedTo === 'string' && Array.isArray(item.notes))) return structuredClone(parsed as TaskRecord[]) } catch { /* handled below */ }
  throw new Error('Local Tasks could not be read.')
}
function write(records: TaskRecord[]) { try { localStorage.setItem(TASKS_KEY, JSON.stringify(records)) } catch { throw new Error('Could not save local Tasks.') } }
export async function validateTask(draft: TaskDraft) {
  if (!draft.title.trim() || draft.title.trim().length > 120) throw new Error('Task Title must be 1–120 characters.')
  if (draft.description.length > 1000) throw new Error('Description must be 1000 characters or fewer.')
  if (!['Low', 'Medium', 'High', 'Urgent'].includes(draft.priority)) throw new Error('Select a valid Priority.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) || Number.isNaN(Date.parse(`${draft.dueDate}T${draft.dueTime}:00`)) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.dueTime)) throw new Error('Enter a valid Due Date and Time.')
  const [users, customers, cases] = await Promise.all([mockUsersRepository.list(), mockCustomerRepository.list(), mockApplicationRepository.list()])
  if (!users.some(item => item.id === draft.assignedTo && item.status === 'active')) throw new Error('Assign an active existing User.')
  if (draft.customerId && !customers.some(item => item.id === draft.customerId)) throw new Error('Related Customer was not found.')
  const related = draft.caseId ? cases.find(item => item.id === draft.caseId) : null
  if (draft.caseId && !related) throw new Error('Related Case was not found.')
  if (related && draft.customerId && related.customerId !== draft.customerId) throw new Error('The related Case belongs to another Customer.')
}
export function taskAging(item: TaskRecord, now = new Date()): 'Open' | 'Due Today' | 'Due Soon' | 'Overdue' | 'Completed' | 'Cancelled' {
  if (item.status === 'Completed' || item.status === 'Cancelled') return item.status
  const due = new Date(`${item.dueDate}T${item.dueTime}:00`).getTime()
  if (!Number.isFinite(due)) return 'Open'
  if (due < now.getTime()) return 'Overdue'
  if (item.dueDate === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`) return 'Due Today'
  if (due - now.getTime() <= 24 * 60 * 60 * 1000) return 'Due Soon'
  return 'Open'
}
export const tasksRepository = {
  async list(actorId: string) { await requireAction('Tasks', 'view', actorId); return read() },
  async rawList() { return read() },
  async create(draft: TaskDraft, actorId: string) {
    await requireAction('Tasks', 'create', actorId); await validateTask(draft)
    const now = new Date().toISOString(); const created: TaskRecord = { ...draft, title: draft.title.trim(), id: crypto.randomUUID(), createdBy: actorId, status: 'Open', createdAt: now, updatedAt: now, completedAt: '', notes: [] }
    write([...read(), created])
    try { await notificationsRepository.create({ recipientId: created.assignedTo, category: 'task-assigned', message: `Task assigned: ${created.title}`, relatedType: 'task', relatedId: created.id, actorId }) } catch { /* Task remains saved; notification can be retried locally. */ }
    return created
  },
  async update(id: string, draft: TaskDraft, actorId: string) {
    const previous = read().find(item => item.id === id); if (!previous) throw new Error('Task was not found.')
    if (draft.assignedTo !== previous.assignedTo) await requireAction('Tasks', 'assign', actorId)
    if (draft.title !== previous.title || draft.description !== previous.description || draft.customerId !== previous.customerId || draft.caseId !== previous.caseId || draft.priority !== previous.priority || draft.dueDate !== previous.dueDate || draft.dueTime !== previous.dueTime) await requireAction('Tasks', 'edit', actorId)
    await validateTask(draft)
    if (previous.status === 'Completed' || previous.status === 'Cancelled') throw new Error('Completed or cancelled Tasks cannot be edited.')
    const updated = { ...previous, ...draft, title: draft.title.trim(), updatedAt: new Date().toISOString() }
    write(read().map(item => item.id === id ? updated : item))
    if (draft.assignedTo !== previous.assignedTo) try { await notificationsRepository.create({ recipientId: draft.assignedTo, category: 'task-assigned', message: `Task assigned: ${updated.title}`, relatedType: 'task', relatedId: id, actorId }) } catch { /* preserve task update */ }
    return updated
  },
  async setStatus(id: string, status: TaskStatus, actorId: string) {
    const action = status === 'Completed' ? 'complete' : status === 'Cancelled' ? 'cancel' : 'edit'
    await requireAction('Tasks', action, actorId)
    const records = read(); const task = records.find(item => item.id === id)
    if (!task) throw new Error('Task was not found.')
    if (task.status === 'Completed' || task.status === 'Cancelled') throw new Error('This Task is already closed.')
    if (status === 'Open' || status === 'In Progress' && task.status !== 'Open') throw new Error('Only an open Task can move to In Progress.')
    const now = new Date().toISOString(); const updated = { ...task, status, updatedAt: now, completedAt: status === 'Completed' ? now : '' }
    write(records.map(item => item.id === id ? updated : item)); return updated
  },
  async addNote(id: string, text: string, actorId: string) {
    await requireAction('Tasks', 'edit', actorId)
    const records = read(); const task = records.find(item => item.id === id)
    if (!task) throw new Error('Task was not found.')
    if (!text.trim() || text.length > 1000) throw new Error('Enter a Note of 1000 characters or fewer.')
    const now = new Date().toISOString(); const updated = { ...task, updatedAt: now, notes: [...task.notes, { id: crypto.randomUUID(), text: text.trim(), actorId, at: now }] }
    write(records.map(item => item.id === id ? updated : item)); return updated
  },
  async remove(id: string, actorId: string) { await requireAction('Tasks', 'delete', actorId); const records = read(); if (!records.some(item => item.id === id)) throw new Error('Task was not found.'); write(records.filter(item => item.id !== id)) },
}
