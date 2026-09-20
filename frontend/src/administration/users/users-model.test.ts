import { beforeEach, describe, expect, test } from 'vitest'
import { mockUsersRepository, USERS_STORAGE_KEY } from './mock-users-repository'
import { emptyUserDraft, validateUserDraft, type UserDraft } from './users-model'
import { PERMISSIONS_STORAGE_KEY } from '../permissions/mock-permissions-repository'

const validDraft = (): UserDraft => ({ ...emptyUserDraft(), fullName: 'New User', email: 'new@example.test', userType: 'User Type A', organization: 'Organization A', organizationScope: 'organization' })

beforeEach(() => { window.localStorage.clear(); window.localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ version: 1, permissions: ['create', 'edit'].map(action => ({ id: `users-${action}`, domain: 'Users', action, description: 'Test action', enabled: true, userTypeIds: ['sample-type-1'], createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' })) })) })

describe('local users model', () => {
  test('validates required identity, assignments, duplicate email, and scoped fields', async () => {
    const existing = await mockUsersRepository.list()
    const missing = validateUserDraft(emptyUserDraft(), existing)
    expect(missing.fullName).toBeTruthy()
    expect(missing.email).toBeTruthy()
    expect(missing.userType).toBeTruthy()
    expect(missing.organization).toBeTruthy()
    expect(missing.organizationScope).toBeTruthy()
    const duplicate = validateUserDraft({ ...validDraft(), email: ' AISHA@example.test ', organizationScope: 'team' }, existing)
    expect(duplicate.email).toBe('Email is already assigned to another user.')
    expect(duplicate.officeBranch).toBeTruthy()
    expect(duplicate.department).toBeTruthy()
    expect(duplicate.team).toBeTruthy()
    expect(validateUserDraft({ ...validDraft(), reportingManagerId: 'sample-aisha' }, existing)).toEqual({})
    expect(validateUserDraft({ ...validDraft(), reportingManagerId: 'sample-aisha' }, existing, 'sample-aisha').reportingManagerId).toBeTruthy()
    expect(validateUserDraft({ ...existing[0], reportingManagerId: 'sample-omar' }, existing, 'sample-aisha').reportingManagerId).toBe('Reporting managers cannot form a cycle.')
  })

  test('creates and edits a user in local storage without changing sample data', async () => {
    const created = await mockUsersRepository.create(validDraft(), 'sample-aisha')
    expect(created.id).toBeTruthy()
    expect((await mockUsersRepository.list()).length).toBe(4)
    expect((await mockUsersRepository.list())[0].fullName).toBe('Aisha Rahman')
    const updated = await mockUsersRepository.update(created.id, { ...created, status: 'inactive', fullName: 'Updated User' }, 'sample-aisha')
    expect(updated.status).toBe('inactive')
    expect((await mockUsersRepository.list()).find(user => user.id === created.id)?.fullName).toBe('Updated User')
    await expect(mockUsersRepository.create({ ...validDraft(), email: 'new@example.test' }, 'sample-aisha')).rejects.toThrow()
  })

  test('direct User mutation requires a manually assigned action', async () => {
    window.localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
    await expect(mockUsersRepository.create(validDraft(), 'sample-aisha')).rejects.toThrow(/Users: create/)
    await expect(mockUsersRepository.update('sample-aisha', (await mockUsersRepository.list())[0], 'sample-aisha')).rejects.toThrow(/Users: edit/)
  })

  test('supports empty data and reports malformed local data', async () => {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify({ version: 1, users: [] }))
    expect(await mockUsersRepository.list()).toEqual([])
    window.localStorage.setItem(USERS_STORAGE_KEY, '{broken')
    await expect(mockUsersRepository.list()).rejects.toThrow('Local user data could not be read.')
  })
})
