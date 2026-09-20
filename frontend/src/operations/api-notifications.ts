import type { NotificationRecord } from './notifications'

async function request<T>(path: string, method = 'GET'): Promise<T> {
  const response = await fetch('/api/v1/notifications' + path, { method, credentials: 'include' })
  if (!response.ok) {
    let message = 'Could not load notifications.'
    try { const data = await response.json() as { error?: { message?: string } }; message = data.error?.message ?? message } catch { /* Use default. */ }
    throw new Error(message)
  }
  return await response.json() as T
}

export const apiNotificationsRepository = {
  list() { return request<NotificationRecord[]>('') },
  forCase(caseId: string) { return request<NotificationRecord[]>('/case/' + encodeURIComponent(caseId)) },
  markRead(id: string) { return request<NotificationRecord>('/' + encodeURIComponent(id) + '/read', 'POST') },
  markAllRead() { return request<{ status: string }>('/read-all', 'POST') },
  archive(id: string) { return request<{ status: string }>('/' + encodeURIComponent(id) + '/archive', 'POST') },
}
