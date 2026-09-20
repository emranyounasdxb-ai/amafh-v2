import { mockUsersRepository } from '../users/mock-users-repository'
import { userTypeOptions } from '../users/users-model'
import { normalizedTypeName, validateUserTypeDraft, type UserTypeDraft, type UserTypeRecord } from './user-types-model'

export const USER_TYPES_STORAGE_KEY = 'amafh-v2.mock-user-types.v1'
const seedTime = '2026-09-19T00:00:00.000Z'
const seededTypes: UserTypeRecord[] = userTypeOptions.map((name, index) => ({ id: `sample-type-${index + 1}`, name, description: `Local sample ${name.toLowerCase()}.`, status: index === 2 ? 'inactive' : 'active', createdAt: seedTime, updatedAt: seedTime }))

function isUserTypeRecord(value: unknown): value is UserTypeRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['id', 'name', 'description', 'createdAt', 'updatedAt'].every(key => typeof item[key] === 'string') && (item.status === 'active' || item.status === 'inactive')
}

function readTypes(): UserTypeRecord[] {
  let raw: string | null
  try { raw = window.localStorage.getItem(USER_TYPES_STORAGE_KEY) }
  catch { throw new Error('Local user type data is unavailable.') }
  if (raw === null) return seededTypes.map(type => ({ ...type }))
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1 && Array.isArray((parsed as { userTypes?: unknown }).userTypes)) {
      const types = (parsed as { userTypes: unknown[] }).userTypes
      if (types.every(isUserTypeRecord) && new Set(types.map(type => type.id)).size === types.length && new Set(types.map(type => normalizedTypeName(type.name))).size === types.length) return types.map(type => ({ ...type }))
    }
  } catch { /* Invalid local data is reported below. */ }
  throw new Error('Local user type data could not be read.')
}

function writeTypes(types: UserTypeRecord[]) {
  try { window.localStorage.setItem(USER_TYPES_STORAGE_KEY, JSON.stringify({ version: 1, userTypes: types })) }
  catch { throw new Error('Could not save local user type data.') }
}

export interface UserTypesRepository {
  list(): Promise<UserTypeRecord[]>
  create(draft: UserTypeDraft): Promise<UserTypeRecord>
  update(id: string, draft: UserTypeDraft): Promise<UserTypeRecord>
  remove(id: string): Promise<void>
}

export const mockUserTypesRepository: UserTypesRepository = {
  async list() { return readTypes() },
  async create(draft) {
    const types = readTypes()
    if (Object.keys(validateUserTypeDraft(draft, types)).length) throw new Error('Check the user type details and try again.')
    const now = new Date().toISOString()
    const created: UserTypeRecord = { ...draft, id: window.crypto.randomUUID(), name: draft.name.trim().replace(/\s+/g, ' '), description: draft.description.trim(), createdAt: now, updatedAt: now }
    writeTypes([...types, created])
    return created
  },
  async update(id, draft) {
    const types = readTypes()
    const previous = types.find(type => type.id === id)
    if (!previous) throw new Error('User type was not found.')
    const users = await mockUsersRepository.list()
    const assignedCount = users.filter(user => normalizedTypeName(user.userType) === normalizedTypeName(previous.name)).length
    if (Object.keys(validateUserTypeDraft(draft, types, id, assignedCount)).length) throw new Error('Check the user type details and try again.')
    const updated: UserTypeRecord = { ...previous, ...draft, name: draft.name.trim().replace(/\s+/g, ' '), description: draft.description.trim(), updatedAt: new Date().toISOString() }
    writeTypes(types.map(type => type.id === id ? updated : type))
    return updated
  },
  async remove(id) {
    const types = readTypes()
    const existing = types.find(type => type.id === id)
    if (!existing) throw new Error('User type was not found.')
    const users = await mockUsersRepository.list()
    const count = users.filter(user => normalizedTypeName(user.userType) === normalizedTypeName(existing.name)).length
    if (count > 0) throw new Error(`Cannot delete ${existing.name}: ${count} ${count === 1 ? 'user is' : 'users are'} assigned.`)
    writeTypes(types.filter(type => type.id !== id))
  },
}
