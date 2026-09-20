import { mockUserTypesRepository } from '../user-types/mock-user-types-repository'
import { validatePermissionDraft, type PermissionDraft, type PermissionRecord } from './permissions-model'

export const PERMISSIONS_STORAGE_KEY = 'amafh-v2.mock-permissions.v1'
const seedTime = '2026-09-19T00:00:00.000Z'
const seeds: PermissionRecord[] = [
  { id: 'permission-users-view', domain: 'Users', action: 'view', description: 'View user records.', enabled: true, userTypeIds: ['sample-type-1', 'sample-type-2'], createdAt: seedTime, updatedAt: seedTime },
  { id: 'permission-users-create', domain: 'Users', action: 'create', description: 'Create user records.', enabled: false, userTypeIds: [], createdAt: seedTime, updatedAt: seedTime },
  { id: 'permission-user-types-view', domain: 'User Types', action: 'view', description: 'View user type records.', enabled: true, userTypeIds: ['sample-type-1'], createdAt: seedTime, updatedAt: seedTime },
  { id: 'permission-audit-view', domain: 'Audit Log', action: 'view', description: 'View audit entries.', enabled: false, userTypeIds: [], createdAt: seedTime, updatedAt: seedTime },
]
function isRecord(value: unknown): value is PermissionRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['id', 'domain', 'action', 'description', 'createdAt', 'updatedAt'].every(key => typeof item[key] === 'string') && typeof item.enabled === 'boolean' && Array.isArray(item.userTypeIds) && item.userTypeIds.every(id => typeof id === 'string')
}
function read(): PermissionRecord[] {
  let raw: string | null
  try { raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY) } catch { throw new Error('Local permission data is unavailable.') }
  if (raw === null) return seeds.map(item => ({ ...item, userTypeIds: [...item.userTypeIds] }))
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1 && Array.isArray((parsed as { permissions?: unknown }).permissions)) {
      const records = (parsed as { permissions: unknown[] }).permissions
      if (records.every(isRecord) && new Set(records.map(item => item.id)).size === records.length && new Set(records.map(item => `${item.domain.toLocaleLowerCase()}:${item.action.toLocaleLowerCase()}`)).size === records.length) return records.map(item => ({ ...item, userTypeIds: [...item.userTypeIds] }))
    }
  } catch { /* Invalid local data is reported below. */ }
  throw new Error('Local permission data could not be read.')
}
function write(records: PermissionRecord[]) {
  try { localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ version: 1, permissions: records })) }
  catch { throw new Error('Could not save local permission data.') }
}
export interface PermissionsRepository {
  list(): Promise<PermissionRecord[]>
  create(draft: PermissionDraft): Promise<PermissionRecord>
  update(id: string, draft: PermissionDraft): Promise<PermissionRecord>
}
export const mockPermissionsRepository: PermissionsRepository = {
  async list() { return read() },
  async create(draft) {
    const records = read()
    const types = await mockUserTypesRepository.list()
    if (Object.keys(validatePermissionDraft(draft, records, types)).length) throw new Error('Check the permission configuration and try again.')
    const now = new Date().toISOString()
    const created: PermissionRecord = { ...draft, id: crypto.randomUUID(), description: draft.description.trim(), userTypeIds: [...draft.userTypeIds], createdAt: now, updatedAt: now }
    write([...records, created])
    return created
  },
  async update(id, draft) {
    const records = read()
    const previous = records.find(item => item.id === id)
    if (!previous) throw new Error('Permission was not found.')
    const types = await mockUserTypesRepository.list()
    if (Object.keys(validatePermissionDraft(draft, records, types, id)).length) throw new Error('Check the permission configuration and try again.')
    const updated: PermissionRecord = { ...previous, ...draft, description: draft.description.trim(), userTypeIds: [...draft.userTypeIds], updatedAt: new Date().toISOString() }
    write(records.map(item => item.id === id ? updated : item))
    return updated
  },
}
