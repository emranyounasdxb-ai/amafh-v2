import { useEffect, useState } from 'react'
import { Workspace } from '../templates/workspace'
import { FormSection } from '../patterns/shared-patterns'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { WorkspaceState } from '../components/feedback/workspace-state'
import { usePermissionPreview } from './permissions'
import { PermissionActor, PermissionGate } from './ui'
import { notificationsRepository, type NotificationRecord } from './notifications'
import { apiNotificationsRepository } from './api-notifications'
import './operations.css'

export function NotificationPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
  const preview = usePermissionPreview()
  const [records, setRecords] = useState<NotificationRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reload = async () => { if (!preview.actorId || !preview.can('Notifications', 'view')) return; setLoading(true); setError(''); try { if (!apiMode) await notificationsRepository.syncReminders(); setRecords(apiMode ? await apiNotificationsRepository.list() : await notificationsRepository.list(preview.actorId)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load notifications.') } finally { setLoading(false) } }
  useEffect(() => { void reload() }, [preview.actorId, preview.permissions, preview.loading])
  const mutate = async (action: 'read' | 'archive' | 'all', id?: string) => { setError(''); try { if (apiMode) { if (action === 'all') await apiNotificationsRepository.markAllRead(); else if (action === 'read') await apiNotificationsRepository.markRead(id!); else await apiNotificationsRepository.archive(id!) } else { if (action === 'all') await notificationsRepository.markAllRead(preview.actorId); else if (action === 'read') await notificationsRepository.markRead(id!, preview.actorId); else await notificationsRepository.archive(id!, preview.actorId) } await reload() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update notifications.') } }
  return <Workspace title="Notification Centre" description="Internal operational events and read state."><PermissionActor preview={preview} /><PermissionGate preview={preview} domain="Notifications" action="view">
    {error && <p role="alert" className="amafh-case-error">{error}</p>}{loading ? <WorkspaceState kind="loading" title="Loading notifications" /> : error && !records.length ? <WorkspaceState kind="error" title="Could not load notifications" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} /> : <FormSection title="Notifications" actions={preview.can('Notifications', 'manage') && <Button variant="secondary" onClick={() => { void mutate('all') }}>Mark all as read</Button>}>
      {records.length ? <div className="amafh-ops-list">{records.map(item => <div className="amafh-card" key={item.id} style={{ padding: 16 }}><div className="amafh-ops-actions"><strong>{item.message}</strong><Badge tone={item.readAt ? 'neutral' : 'info'}>{item.readAt ? 'Read' : 'Unread'}</Badge></div><p>{item.category} · {new Date(item.at).toLocaleString()} · {item.relatedType} {item.relatedId}</p><div className="amafh-ops-actions">{item.relatedType !== 'system' && <Button variant="secondary" size="compact" onClick={() => onNavigate(item.relatedType === 'case' ? `/cases/${encodeURIComponent(item.relatedId)}` : `/tasks/${encodeURIComponent(item.relatedId)}`)}>Open related record</Button>}{preview.can('Notifications', 'manage') && !item.readAt && <Button variant="secondary" size="compact" onClick={() => { void mutate('read', item.id) }}>Mark as read</Button>}{preview.can('Notifications', 'manage') && <Button variant="outline" size="compact" onClick={() => { void mutate('archive', item.id) }}>Archive</Button>}</div></div>)}</div> : <WorkspaceState kind="empty" title="No notifications" />}
    </FormSection>}
  </PermissionGate></Workspace>
}
