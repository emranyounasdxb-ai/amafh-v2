import type { ReactNode } from 'react'
import { SelectField } from '../components/ui/select-field'
import { WorkspaceState } from '../components/feedback/workspace-state'
import { Button } from '../components/ui/button'
import { usePermissionPreview } from './permissions'

export function PermissionActor({ preview }: { preview: ReturnType<typeof usePermissionPreview> }) {
  if (import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock') return null
  return <div className="amafh-ops-actor"><SelectField label="Acting user (local permission preview)" value={preview.actorId} onValueChange={preview.selectActor} options={preview.users.filter(item => item.status === 'active').map(item => ({ value: item.id, label: `${item.fullName} · ${item.userType}` }))} /><p>Actions require enabled permissions assigned to this user's User Type. This is a local preview.</p></div>
}
export function PermissionGate({ preview, domain, action, children }: { preview: ReturnType<typeof usePermissionPreview>; domain: string; action: string; children: ReactNode }) {
  if (preview.loading) return <WorkspaceState kind="loading" title="Loading permissions" />
  if (preview.error) return <WorkspaceState kind="error" title="Could not load permissions" description={preview.error} action={<Button onClick={() => { void preview.reload() }}>Try again</Button>} />
  if (!preview.can(domain, action)) return <WorkspaceState kind="permission" title="Permission required" description={import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock' ? `Your User Type needs ${domain}: ${action} permission.` : `Select an acting user whose User Type has ${domain}: ${action} permission in Administration → Permissions.`} />
  return <>{children}</>
}
