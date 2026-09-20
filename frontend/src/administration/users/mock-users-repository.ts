import { emptyUserDraft, validateUserDraft, type UserDraft, type UserRecord } from './users-model'

export const USERS_STORAGE_KEY = 'amafh-v2.mock-users.v1'

const seededUsers: UserRecord[] = [
  { ...emptyUserDraft(), id: 'sample-aisha', fullName: 'Aisha Rahman', email: 'aisha@example.test', userType: 'User Type A', organization: 'Organization A', organizationScope: 'team', officeBranch: 'Head Office', department: 'Department A', team: 'Team A' },
  { ...emptyUserDraft(), id: 'sample-omar', fullName: 'Omar Khan', email: 'omar@example.test', status: 'inactive', userType: 'User Type B', reportingManagerId: 'sample-aisha', organization: 'Organization A', organizationScope: 'department', officeBranch: 'Branch A', department: 'Department B' },
  { ...emptyUserDraft(), id: 'sample-sara', fullName: 'Sara Ali', email: 'sara@example.test', userType: 'User Type A', reportingManagerId: 'sample-aisha', organization: 'Organization B', organizationScope: 'organization' },
]

function isUserRecord(value: unknown): value is UserRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['id', 'fullName', 'email', 'userType', 'reportingManagerId', 'organization', 'organizationScope', 'officeBranch', 'department', 'team'].every(key => typeof item[key] === 'string') && (item.status === 'active' || item.status === 'inactive')
}

function readUsers(): UserRecord[] {
  let raw: string | null
  try { raw = window.localStorage.getItem(USERS_STORAGE_KEY) }
  catch { throw new Error('Local user data is unavailable.') }
  if (raw === null) return seededUsers.map(user => ({ ...user }))
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1 && Array.isArray((parsed as { users?: unknown }).users)) {
      const users = (parsed as { users: unknown[] }).users
      if (users.every(isUserRecord) && new Set(users.map(user => user.id)).size === users.length) return users.map(user => ({ ...user }))
    }
  } catch { /* Invalid local data is reported below. */ }
  throw new Error('Local user data could not be read.')
}

function writeUsers(users: UserRecord[]) {
  try { window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify({ version: 1, users })) }
  catch { throw new Error('Could not save local user data.') }
}

export interface UsersRepository {
  list(): Promise<UserRecord[]>
  create(draft: UserDraft, actorId: string): Promise<UserRecord>
  update(id: string, draft: UserDraft, actorId: string): Promise<UserRecord>
}

function persistCreate(draft: UserDraft) {
  const users = readUsers()
  if (Object.keys(validateUserDraft(draft, users)).length) throw new Error('Check the user details and try again.')
  const user: UserRecord = { ...draft, id: window.crypto.randomUUID(), fullName: draft.fullName.trim(), email: draft.email.trim().toLowerCase() }
  writeUsers([...users, user])
  return user
}

export const mockUsersRepository: UsersRepository & { createFromImport(draft: UserDraft, actorId: string): Promise<UserRecord> } = {
  async list() { return readUsers() },
  async create(draft, actorId) {
    const { requireAction } = await import('../../operations/permissions')
    await requireAction('Users', 'create', actorId)
    return persistCreate(draft)
  },
  async createFromImport(draft, actorId) {
    const { requireAction } = await import('../../operations/permissions')
    await requireAction('Imports', 'users', actorId)
    return persistCreate(draft)
  },
  async update(id, draft, actorId) {
    const { requireAction } = await import('../../operations/permissions')
    await requireAction('Users', 'edit', actorId)
    const users = readUsers()
    if (!users.some(user => user.id === id)) throw new Error('User was not found.')
    if (Object.keys(validateUserDraft(draft, users, id)).length) throw new Error('Check the user details and try again.')
    const user: UserRecord = { ...draft, id, fullName: draft.fullName.trim(), email: draft.email.trim().toLowerCase() }
    writeUsers(users.map(item => item.id === id ? user : item))
    return user
  },
}
