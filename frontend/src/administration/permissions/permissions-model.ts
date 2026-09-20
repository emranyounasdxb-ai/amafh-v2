import type { UserTypeRecord } from '../user-types/user-types-model'

export const permissionDomains = [
  { name: 'Users', actions: ['view', 'create', 'edit'] },
  { name: 'User Types', actions: ['view', 'create', 'edit', 'delete'] },
  { name: 'Permissions', actions: ['view', 'create', 'edit'] },
  { name: 'Organization', actions: ['view', 'edit'] },
  { name: 'Audit Log', actions: ['view'] },
  { name: 'Cases', actions: ['view', 'create', 'edit', 'delete', 'assign-owner', 'approve', 'reject', 'assign-coordinator', 'submit-to-bank', 'add-bank-file-number', 'update-stage', 'view-history', 'edit-history', 'lock', 'add-stage', 'edit-stage', 'delete-stage', 'reorder-stage', 'activate-stage', 'set-stage-duration'] },
  { name: 'Customers', actions: ['view', 'edit', 'delete'] },
  { name: 'Profiles', actions: ['edit-other-images'] },
  { name: 'Imports', actions: ['attendance', 'case-stage', 'users'] },
  { name: 'Notifications', actions: ['view', 'manage', 'view-communication-history'] },
  { name: 'Tasks', actions: ['view', 'create', 'edit', 'assign', 'complete', 'cancel', 'delete'] },
  { name: 'Finance', actions: ['view-commission', 'manage-rules', 'review-commission', 'approve-commission', 'mark-paid', 'view-incentives', 'manage-incentives', 'manage-clawback'] },
  { name: 'Reports', actions: ['view', 'export', 'view-performance', 'view-financial'] },
] as const

export interface PermissionDraft { domain: string; action: string; description: string; enabled: boolean; userTypeIds: string[] }
export interface PermissionRecord extends PermissionDraft { id: string; createdAt: string; updatedAt: string }
export type PermissionErrors = Partial<Record<keyof PermissionDraft, string>>
export const emptyPermissionDraft = (): PermissionDraft => ({ domain: '', action: '', description: '', enabled: false, userTypeIds: [] })
const normalized = (value: string) => value.trim().toLocaleLowerCase()

export function validatePermissionDraft(draft: PermissionDraft, records: PermissionRecord[], types: UserTypeRecord[], editingId?: string): PermissionErrors {
  const errors: PermissionErrors = {}
  const domain = permissionDomains.find(item => item.name === draft.domain)
  if (!domain) errors.domain = 'Select a valid domain.'
  if (!domain || !(domain.actions as readonly string[]).includes(draft.action)) errors.action = 'Select a valid action for this domain.'
  if (domain && !errors.action && records.some(item => item.id !== editingId && normalized(item.domain) === normalized(draft.domain) && normalized(item.action) === normalized(draft.action))) errors.action = 'This permission definition already exists.'
  if (!draft.description.trim()) errors.description = 'Description is required.'
  else if (draft.description.trim().length > 500) errors.description = 'Use 500 characters or fewer.'
  if (typeof draft.enabled !== 'boolean') errors.enabled = 'Select a valid state.'
  if (!Array.isArray(draft.userTypeIds) || draft.userTypeIds.some(id => typeof id !== 'string' || !types.some(type => type.id === id)) || new Set(draft.userTypeIds).size !== draft.userTypeIds.length) errors.userTypeIds = 'Select valid User Types without duplicates.'
  else if (draft.enabled && draft.userTypeIds.length === 0) errors.userTypeIds = 'Assign at least one User Type before enabling.'
  return errors
}
