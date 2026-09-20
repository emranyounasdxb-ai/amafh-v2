export interface ManagedKind { id: string; label: string; singular: string; parentKind?: string; extraLabel?: string }
export interface ManagedConfig { slug: string; label: string; kinds: ManagedKind[]; seed: ManagedRecord[]; description: string }
export interface ManagedDraft { kind: string; name: string; description: string; status: 'active' | 'inactive'; parentId: string; extra: string }
export interface ManagedRecord extends ManagedDraft { id: string; createdAt: string; updatedAt: string }
export type ManagedErrors = Partial<Record<keyof ManagedDraft, string>>
export const emptyManagedDraft = (kind: string): ManagedDraft => ({ kind, name: '', description: '', status: 'active', parentId: '', extra: '' })
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
export function validateManagedDraft(config: ManagedConfig, draft: ManagedDraft, records: ManagedRecord[], editingId?: string): ManagedErrors {
  const errors: ManagedErrors = {}
  const kind = config.kinds.find(item => item.id === draft.kind)
  if (!kind) errors.kind = 'Select a valid type.'
  const name = draft.name.trim().replace(/\s+/g, ' ')
  if (!name) errors.name = 'Name is required.'
  else if (name.length > 120) errors.name = 'Use 120 characters or fewer.'
  else if (records.some(item => item.id !== editingId && item.kind === draft.kind && item.parentId === draft.parentId && normalize(item.name) === normalize(name))) errors.name = 'A record with this name already exists under this parent.'
  if (!draft.description.trim()) errors.description = 'Description is required.'
  else if (draft.description.trim().length > 500) errors.description = 'Use 500 characters or fewer.'
  if (draft.status !== 'active' && draft.status !== 'inactive') errors.status = 'Select a valid status.'
  if (kind?.parentKind && !records.some(item => item.id === draft.parentId && item.kind === kind.parentKind)) errors.parentId = 'Select a valid parent.'
  else if (kind && !kind.parentKind && draft.parentId) errors.parentId = 'This record cannot have a parent.'
  if (kind?.extraLabel && !draft.extra.trim()) errors.extra = `${kind.extraLabel} is required.`
  else if (draft.extra.length > 500) errors.extra = 'Use 500 characters or fewer.'
  return errors
}
export const seedRecord = (id: string, kind: string, name: string, parentId = '', extra = ''): ManagedRecord => ({ id, kind, name, parentId, extra, description: `Local ${name.toLowerCase()} configuration.`, status: 'active', createdAt: '2026-09-19T00:00:00.000Z', updatedAt: '2026-09-19T00:00:00.000Z' })
