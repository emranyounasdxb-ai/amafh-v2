export type UserStatus = 'active' | 'inactive'
export type OrganizationScope = 'organization' | 'office' | 'department' | 'team'

export interface UserDraft {
  fullName: string
  email: string
  status: UserStatus
  userType: string
  reportingManagerId: string
  organization: string
  organizationScope: OrganizationScope | ''
  officeBranch: string
  department: string
  team: string
}
export interface UserRecord extends UserDraft { id: string }
export type UserErrors = Partial<Record<keyof UserDraft, string>>

// Static labels are mock assignments, not User Type management or access rules.
export const userTypeOptions = ['User Type A', 'User Type B', 'User Type C']
export const organizationOptions = ['Organization A', 'Organization B']
export const officeOptions = ['Head Office', 'Branch A', 'Branch B']
export const departmentOptions = ['Department A', 'Department B', 'Department C']
export const teamOptions = ['Team A', 'Team B', 'Team C']
export const scopeOptions: { value: OrganizationScope; label: string }[] = [
  { value: 'organization', label: 'Organization' },
  { value: 'office', label: 'Office / Branch' },
  { value: 'department', label: 'Department' },
  { value: 'team', label: 'Team' },
]

export const emptyUserDraft = (): UserDraft => ({ fullName: '', email: '', status: 'active', userType: '', reportingManagerId: '', organization: '', organizationScope: '', officeBranch: '', department: '', team: '' })

export function validateUserDraft(draft: UserDraft, users: UserRecord[], editingId?: string): UserErrors {
  const errors: UserErrors = {}
  const email = draft.email.trim().toLowerCase()
  if (!draft.fullName.trim()) errors.fullName = 'Full name is required.'
  else if (draft.fullName.trim().length > 120) errors.fullName = 'Use 120 characters or fewer.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'
  else if (users.some(user => user.id !== editingId && user.email.toLowerCase() === email)) errors.email = 'Email is already assigned to another user.'
  if (draft.status !== 'active' && draft.status !== 'inactive') errors.status = 'Select a status.'
  if (!userTypeOptions.includes(draft.userType)) errors.userType = 'Select a user type.'
  if (!organizationOptions.includes(draft.organization)) errors.organization = 'Select an organization.'
  if (!scopeOptions.some(option => option.value === draft.organizationScope)) errors.organizationScope = 'Select an organization scope.'
  if (draft.organizationScope !== 'organization' && draft.organizationScope && !draft.officeBranch) errors.officeBranch = 'Select an office or branch for this scope.'
  else if (draft.officeBranch && !officeOptions.includes(draft.officeBranch)) errors.officeBranch = 'Select a listed office or branch.'
  if ((draft.organizationScope === 'department' || draft.organizationScope === 'team') && !draft.department) errors.department = 'Select a department for this scope.'
  else if (draft.department && !departmentOptions.includes(draft.department)) errors.department = 'Select a listed department.'
  if (draft.organizationScope === 'team' && !draft.team) errors.team = 'Select a team for this scope.'
  else if (draft.team && !teamOptions.includes(draft.team)) errors.team = 'Select a listed team.'
  if (draft.reportingManagerId === editingId && editingId) errors.reportingManagerId = 'A user cannot report to themselves.'
  else if (draft.reportingManagerId && !users.some(user => user.id === draft.reportingManagerId)) errors.reportingManagerId = 'Select an existing reporting manager.'
  else if (draft.reportingManagerId && editingId) {
    const visited = new Set<string>()
    let managerId = draft.reportingManagerId
    while (managerId && !visited.has(managerId)) {
      if (managerId === editingId) { errors.reportingManagerId = 'Reporting managers cannot form a cycle.'; break }
      visited.add(managerId)
      managerId = users.find(user => user.id === managerId)?.reportingManagerId ?? ''
    }
  }
  return errors
}
