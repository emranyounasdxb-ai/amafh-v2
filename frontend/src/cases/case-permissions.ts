import type { UserRecord } from '../administration/users/users-model'
import type { UserTypeRecord } from '../administration/user-types/user-types-model'
import type { PermissionRecord } from '../administration/permissions/permissions-model'

export const CASE_PREVIEW_ACTOR_KEY = 'amafh-v2.case-preview-actor'

export function caseActionAllowed(action: string, actorId: string, users: UserRecord[], types: UserTypeRecord[], permissions: PermissionRecord[]) {
  const actor = users.find(item => item.id === actorId && item.status === 'active')
  const type = types.find(item => item.name === actor?.userType && item.status === 'active')
  return Boolean(type && permissions.some(item => item.domain === 'Cases' && item.action === action && item.enabled && item.userTypeIds.includes(type.id)))
}
