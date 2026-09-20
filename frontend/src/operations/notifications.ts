import { requireAction } from './permissions'
import { caseStageAging } from '../cases/case-aging'

export type NotificationCategory = 'case-assigned' | 'case-reviewed' | 'coordinator-assigned' | 'case-stage' | 'case-due-soon' | 'case-overdue' | 'task-assigned' | 'task-due-soon' | 'task-overdue' | 'system'
export interface NotificationRecord { id: string; recipientId: string; category: NotificationCategory; message: string; relatedType: 'case' | 'task' | 'system'; relatedId: string; at: string; readAt: string; archivedAt: string; actorId: string; key?: string }
export const NOTIFICATIONS_KEY = 'amafh-v2.mock-notifications.v1'
function read(): NotificationRecord[] {
  const raw = localStorage.getItem(NOTIFICATIONS_KEY)
  if (raw === null) return []
  try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed) && parsed.every(item => item && typeof item.id === 'string' && typeof item.recipientId === 'string' && typeof item.category === 'string' && typeof item.message === 'string' && typeof item.at === 'string' && typeof item.readAt === 'string' && typeof item.archivedAt === 'string')) return structuredClone(parsed as NotificationRecord[]) } catch { /* handled below */ }
  throw new Error('Local notifications could not be read.')
}
function write(records: NotificationRecord[]) { try { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(records)) } catch { throw new Error('Could not save local notifications.') } }
export const notificationsRepository = {
  async list(recipientId: string) { await requireAction('Notifications', 'view', recipientId); return read().filter(item => item.recipientId === recipientId && !item.archivedAt).sort((a, b) => b.at.localeCompare(a.at)) },
  async forCase(caseId: string, actorId: string) { await requireAction('Notifications', 'view-communication-history', actorId); return read().filter(item => item.relatedType === 'case' && item.relatedId === caseId).sort((a, b) => a.at.localeCompare(b.at)) },
  async create(input: Omit<NotificationRecord, 'id' | 'at' | 'readAt' | 'archivedAt'>) {
    const records = read()
    if (input.key && records.some(item => item.key === input.key && item.recipientId === input.recipientId)) return records.find(item => item.key === input.key && item.recipientId === input.recipientId)!
    const created: NotificationRecord = { ...input, id: crypto.randomUUID(), at: new Date().toISOString(), readAt: '', archivedAt: '' }
    write([...records, created]); return created
  },
  async markRead(id: string, actorId: string) {
    await requireAction('Notifications', 'manage', actorId)
    const records = read(); const item = records.find(item => item.id === id && item.recipientId === actorId)
    if (!item) throw new Error('Notification was not found for this user.')
    const updated = { ...item, readAt: item.readAt || new Date().toISOString() }
    write(records.map(record => record.id === id ? updated : record)); return updated
  },
  async markAllRead(actorId: string) {
    await requireAction('Notifications', 'manage', actorId)
    const now = new Date().toISOString(); write(read().map(item => item.recipientId === actorId && !item.readAt ? { ...item, readAt: now } : item))
  },
  async archive(id: string, actorId: string) {
    await requireAction('Notifications', 'manage', actorId)
    const records = read(); const item = records.find(item => item.id === id && item.recipientId === actorId)
    if (!item) throw new Error('Notification was not found for this user.')
    write(records.map(record => record.id === id ? { ...record, archivedAt: new Date().toISOString() } : record))
  },
  async syncReminders() {
    const [{ caseRepository }, { tasksRepository, taskAging }] = await Promise.all([import('../cases/case-repository'), import('./tasks')])
    const [cases, tasks] = await Promise.all([caseRepository.list(), tasksRepository.rawList()])
    for (const item of cases) {
      const aging = caseStageAging(item)
      if (!aging || !item.coordinatorId || aging.status === 'On Time') continue
      await this.create({ recipientId: item.coordinatorId, category: aging.status === 'Overdue' ? 'case-overdue' : 'case-due-soon', message: `${item.caseNumber}: ${item.stage} is ${aging.status.toLowerCase()}.`, relatedType: 'case', relatedId: item.id, actorId: '', key: `case:${item.id}:${item.stageStartedAt}:${aging.status}` })
    }
    for (const item of tasks) {
      const aging = taskAging(item)
      if (aging !== 'Due Today' && aging !== 'Due Soon' && aging !== 'Overdue') continue
      await this.create({ recipientId: item.assignedTo, category: aging === 'Overdue' ? 'task-overdue' : 'task-due-soon', message: `${item.title} is ${aging.toLowerCase()}.`, relatedType: 'task', relatedId: item.id, actorId: '', key: `task:${item.id}:${aging}` })
    }
  },
}
