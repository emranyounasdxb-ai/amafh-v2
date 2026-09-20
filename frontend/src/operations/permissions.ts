import { useEffect, useState } from 'react'
import { mockPermissionsRepository } from '../administration/permissions/mock-permissions-repository'
import type { PermissionRecord } from '../administration/permissions/permissions-model'
import { mockUserTypesRepository } from '../administration/user-types/mock-user-types-repository'
import type { UserTypeRecord } from '../administration/user-types/user-types-model'
import { mockUsersRepository } from '../administration/users/mock-users-repository'
import type { UserRecord } from '../administration/users/users-model'
import { CASE_PREVIEW_ACTOR_KEY } from '../cases/case-permissions'
import { useOptionalAuth } from '../auth/auth-context'

const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
type GrantedAction = { domain: string; action: string }
async function serverPermissions(): Promise<GrantedAction[]> {
  const response = await fetch('/api/v1/auth/permissions', { credentials: 'include' })
  if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired.' : 'Could not load your permissions.')
  const result: { permissions: GrantedAction[] } = await response.json()
  return result.permissions
}

export function hasAction(domain: string, action: string, actorId: string, users: UserRecord[], types: UserTypeRecord[], permissions: PermissionRecord[]) {
  const actor = users.find(item => item.id === actorId && item.status === 'active')
  const type = types.find(item => item.name === actor?.userType && item.status === 'active')
  return Boolean(type && permissions.some(item => item.domain === domain && item.action === action && item.enabled && item.userTypeIds.includes(type.id)))
}
export async function requireAction(domain: string, action: string, actorId: string) {
  if (apiMode) {
    const grants = await serverPermissions()
    if (!grants.some(item => item.domain === domain && item.action === action)) throw new Error(`Your User Type needs ${domain}: ${action} permission.`)
    return undefined
  }
  const [users, types, permissions] = await Promise.all([mockUsersRepository.list(), mockUserTypesRepository.list(), mockPermissionsRepository.list()])
  if (!hasAction(domain, action, actorId, users, types, permissions)) throw new Error(`The acting user's User Type needs ${domain}: ${action} permission.`)
  return users.find(item => item.id === actorId)!
}
export function usePermissionPreview() {
  const auth = useOptionalAuth()
  const [actorId, setActorId] = useState(() => sessionStorage.getItem(CASE_PREVIEW_ACTOR_KEY) ?? '')
  const [users, setUsers] = useState<UserRecord[]>([])
  const [types, setTypes] = useState<UserTypeRecord[]>([])
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [serverGrants, setServerGrants] = useState<GrantedAction[]>([])
  const reload = async () => {
    setLoading(true); setError('')
    try {
      if (apiMode) {
        setServerGrants(await serverPermissions())
      } else {
        const [nextUsers, nextTypes, nextPermissions] = await Promise.all([mockUsersRepository.list(), mockUserTypesRepository.list(), mockPermissionsRepository.list()]); setUsers(nextUsers); setTypes(nextTypes); setPermissions(nextPermissions)
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load permission preview.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void reload() }, [])
  useEffect(() => { const sync = () => setActorId(sessionStorage.getItem(CASE_PREVIEW_ACTOR_KEY) ?? ''); window.addEventListener('amafh-preview-actor-change', sync); return () => window.removeEventListener('amafh-preview-actor-change', sync) }, [])
  const selectActor = (id: string) => { if (apiMode) return; setActorId(id); sessionStorage.setItem(CASE_PREVIEW_ACTOR_KEY, id); window.dispatchEvent(new Event('amafh-preview-actor-change')) }
  return { actorId: apiMode ? auth?.user?.id ?? '' : actorId, selectActor, users, types, permissions, loading, error, reload, can: (domain: string, action: string) => apiMode ? serverGrants.some(item => item.domain === domain && item.action === action) : hasAction(domain, action, actorId, users, types, permissions) }
}
