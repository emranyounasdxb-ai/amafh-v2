export const administrationAreas = [
  { id: 'users', label: 'Users', path: '/administration/users' },
  { id: 'user-types', label: 'User Types', path: '/administration/user-types' },
  { id: 'permissions', label: 'Permissions', path: '/administration/permissions' },
  { id: 'organization', label: 'Organization', path: '/administration/organization' },
  { id: 'banks-products', label: 'Banks & Products', path: '/administration/banks-products' },
  { id: 'policies-rules', label: 'Policies & Rules', path: '/administration/policies-rules' },
  { id: 'workflows', label: 'Workflows', path: '/administration/workflows' },
  { id: 'approval-centre', label: 'Approval Centre', path: '/administration/approval-centre' },
  { id: 'security', label: 'Security', path: '/administration/security' },
  { id: 'system-settings', label: 'System Settings', path: '/administration/system-settings' },
  { id: 'audit-log', label: 'Audit Log', path: '/administration/audit-log' },
] as const

export type AdministrationArea = (typeof administrationAreas)[number]
export const defaultAdministrationPath = administrationAreas[0].path
export type UsersRoute = { mode: 'list' } | { mode: 'create' } | { mode: 'detail' | 'edit'; id: string }
export type UserTypesRoute = { mode: 'list' } | { mode: 'create' } | { mode: 'detail' | 'edit'; id: string }
export type PermissionsRoute = { mode: 'list' } | { mode: 'create' } | { mode: 'detail' | 'edit'; id: string }
import { organizationKinds, type OrganizationKind } from './organization/organization-model'
import { managedModuleForPath } from './managed/registry'
import { approvalRouteFromPath } from './approval-centre/approval-routes'
import { auditRouteFromPath } from './audit-log/audit-routes'
export type OrganizationRoute = { mode: 'overview' } | { mode: 'list'; kind: OrganizationKind } | { mode: 'create'; kind: OrganizationKind } | { mode: 'detail'; kind: OrganizationKind; id: string } | { mode: 'edit'; kind: OrganizationKind; id: string }
export function usersRouteFromPath(path: string): UsersRoute | null {
  if (path === '/administration/users') return { mode: 'list' }
  if (path === '/administration/users/new') return { mode: 'create' }
  const match = /^\/administration\/users\/([^/]+?)(?:\/(edit))?$/.exec(path)
  if (!match) return null
  try { return { mode: match[2] ? 'edit' : 'detail', id: decodeURIComponent(match[1]) } }
  catch { return null }
}
export function userTypesRouteFromPath(path: string): UserTypesRoute | null {
  if (path === '/administration/user-types') return { mode: 'list' }
  if (path === '/administration/user-types/new') return { mode: 'create' }
  const match = /^\/administration\/user-types\/([^/]+?)(?:\/(edit))?$/.exec(path)
  if (!match) return null
  try { return { mode: match[2] ? 'edit' : 'detail', id: decodeURIComponent(match[1]) } }
  catch { return null }
}
export function permissionsRouteFromPath(path: string): PermissionsRoute | null {
  if (path === '/administration/permissions') return { mode: 'list' }
  if (path === '/administration/permissions/new') return { mode: 'create' }
  const match = /^\/administration\/permissions\/([^/]+?)(?:\/(edit))?$/.exec(path)
  if (!match) return null
  try { return { mode: match[2] ? 'edit' : 'detail', id: decodeURIComponent(match[1]) } }
  catch { return null }
}
export function organizationRouteFromPath(path: string): OrganizationRoute | null {
  if (path === '/administration/organization') return { mode: 'overview' }
  const match = /^\/administration\/organization\/([^/]+)(?:\/([^/]+))?(?:\/(edit))?$/.exec(path)
  if (!match || !organizationKinds.some(item => item.id === match[1])) return null
  const kind = match[1] as OrganizationKind
  if (!match[2]) return { mode: 'list', kind }
  if (match[2] === 'new' && !match[3]) return { mode: 'create', kind }
  try { return { mode: match[3] ? 'edit' : 'detail', kind, id: decodeURIComponent(match[2]) } }
  catch { return null }
}
export const administrationAreaFromPath = (path: string) => administrationAreas.find(area => area.path === path) ?? (usersRouteFromPath(path) ? administrationAreas[0] : userTypesRouteFromPath(path) ? administrationAreas[1] : permissionsRouteFromPath(path) ? administrationAreas[2] : organizationRouteFromPath(path) ? administrationAreas[3] : /^\/administration\/banks-products\/products\/[^/]+\/stages$/.test(path) ? administrationAreas[4] : managedModuleForPath(path) ? administrationAreas.find(area => area.id === managedModuleForPath(path)?.config.slug) : approvalRouteFromPath(path) ? administrationAreas[7] : auditRouteFromPath(path) ? administrationAreas[10] : undefined)
