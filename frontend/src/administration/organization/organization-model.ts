export const organizationKinds = [
  { id: 'organizations', label: 'Organizations', singular: 'Organization', parents: [] },
  { id: 'offices', label: 'Offices / Branches', singular: 'Office / Branch', parents: ['organizations'] },
  { id: 'departments', label: 'Departments', singular: 'Department', parents: ['offices'] },
  { id: 'teams', label: 'Teams', singular: 'Team', parents: ['departments'] },
  { id: 'business-units', label: 'Business Units', singular: 'Business Unit', parents: ['departments'] },
] as const
export type OrganizationKind = (typeof organizationKinds)[number]['id']
export type OrganizationStatus = 'active' | 'inactive'
export interface OrganizationDraft { kind: OrganizationKind; name: string; description: string; status: OrganizationStatus; parentId: string }
export interface OrganizationRecord extends OrganizationDraft { id: string; createdAt: string; updatedAt: string }
export type OrganizationErrors = Partial<Record<keyof OrganizationDraft, string>>
export const kindDefinition = (kind: OrganizationKind) => organizationKinds.find(item => item.id === kind)!
export const emptyOrganizationDraft = (kind: OrganizationKind): OrganizationDraft => ({ kind, name: '', description: '', status: 'active', parentId: '' })
const normalized = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export function validateOrganizationDraft(draft: OrganizationDraft, records: OrganizationRecord[], editingId?: string): OrganizationErrors {
  const errors: OrganizationErrors = {}
  const definition = organizationKinds.find(item => item.id === draft.kind)
  if (!definition) errors.kind = 'Select a valid structure type.'
  const name = draft.name.trim().replace(/\s+/g, ' ')
  if (!name) errors.name = 'Name is required.'
  else if (name.length > 120) errors.name = 'Use 120 characters or fewer.'
  else if (records.some(item => item.id !== editingId && item.kind === draft.kind && item.parentId === draft.parentId && normalized(item.name) === normalized(name))) errors.name = 'A sibling with this name already exists.'
  if (!draft.description.trim()) errors.description = 'Description is required.'
  else if (draft.description.trim().length > 500) errors.description = 'Use 500 characters or fewer.'
  if (draft.status !== 'active' && draft.status !== 'inactive') errors.status = 'Select a valid status.'
  if (definition) {
    if (definition.parents.length === 0 && draft.parentId) errors.parentId = 'Organizations cannot have a parent.'
    if (definition.parents.length > 0 && (!draft.parentId || !records.some(item => item.id === draft.parentId && (definition.parents as readonly string[]).includes(item.kind)))) errors.parentId = 'Select a valid parent.'
  }
  return errors
}
