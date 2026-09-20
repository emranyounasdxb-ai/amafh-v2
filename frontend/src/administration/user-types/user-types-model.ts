export type UserTypeStatus = 'active' | 'inactive'
export interface UserTypeDraft { name: string; description: string; status: UserTypeStatus }
export interface UserTypeRecord extends UserTypeDraft { id: string; createdAt: string; updatedAt: string }
export type UserTypeErrors = Partial<Record<keyof UserTypeDraft, string>>
export const emptyUserTypeDraft = (): UserTypeDraft => ({ name: '', description: '', status: 'active' })
export const normalizedTypeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export function validateUserTypeDraft(draft: UserTypeDraft, types: UserTypeRecord[], editingId?: string, assignedCount = 0): UserTypeErrors {
  const errors: UserTypeErrors = {}
  const name = draft.name.trim().replace(/\s+/g, ' ')
  const current = types.find(type => type.id === editingId)
  if (!name) errors.name = 'Name is required.'
  else if (name.length > 80) errors.name = 'Use 80 characters or fewer.'
  else if (types.some(type => type.id !== editingId && normalizedTypeName(type.name) === normalizedTypeName(name))) errors.name = 'A user type with this name already exists.'
  else if (current && assignedCount > 0 && normalizedTypeName(current.name) !== normalizedTypeName(name)) errors.name = 'Name cannot change while users are assigned.'
  if (!draft.description.trim()) errors.description = 'Description is required.'
  else if (draft.description.trim().length > 500) errors.description = 'Use 500 characters or fewer.'
  if (draft.status !== 'active' && draft.status !== 'inactive') errors.status = 'Select a status.'
  return errors
}
