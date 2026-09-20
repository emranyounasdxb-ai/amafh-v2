import { beforeEach, describe, expect, test } from 'vitest'
import { mockUserTypesRepository, USER_TYPES_STORAGE_KEY } from './mock-user-types-repository'
import { emptyUserTypeDraft, validateUserTypeDraft } from './user-types-model'

beforeEach(() => window.localStorage.clear())

describe('local User Types model', () => {
  test('validates fields, duplicate names, and assigned-name protection', async () => {
    const types = await mockUserTypesRepository.list()
    expect(validateUserTypeDraft(emptyUserTypeDraft(), types).name).toBe('Name is required.')
    expect(validateUserTypeDraft(emptyUserTypeDraft(), types).description).toBe('Description is required.')
    expect(validateUserTypeDraft({ name: '  USER   TYPE   A  ', description: 'Valid', status: 'active' }, types).name).toBe('A user type with this name already exists.')
    expect(validateUserTypeDraft({ name: 'Renamed', description: 'Valid', status: 'active' }, types, 'sample-type-1', 2).name).toBe('Name cannot change while users are assigned.')
    expect(validateUserTypeDraft({ name: 'Renamed', description: 'Valid', status: 'active' }, types, 'sample-type-3', 0)).toEqual({})
  })

  test('creates and edits a local User Type with metadata', async () => {
    const created = await mockUserTypesRepository.create({ name: ' User Type D ', description: ' Local description ', status: 'active' })
    expect(created.name).toBe('User Type D')
    expect(created.description).toBe('Local description')
    expect(created.createdAt).toBeTruthy()
    expect((await mockUserTypesRepository.list()).length).toBe(4)
    const updated = await mockUserTypesRepository.update(created.id, { name: 'User Type E', description: 'Updated description', status: 'inactive' })
    expect(updated.status).toBe('inactive')
    expect(updated.createdAt).toBe(created.createdAt)
    await expect(mockUserTypesRepository.create({ name: 'user type e', description: 'Duplicate', status: 'active' })).rejects.toThrow()
  })

  test('blocks deletion while assigned and persists allowed deletion', async () => {
    await expect(mockUserTypesRepository.remove('sample-type-1')).rejects.toThrow('Cannot delete User Type A: 2 users are assigned.')
    expect((await mockUserTypesRepository.list()).length).toBe(3)
    await mockUserTypesRepository.remove('sample-type-3')
    expect((await mockUserTypesRepository.list()).map(type => type.name)).toEqual(['User Type A', 'User Type B'])
    expect(window.localStorage.getItem(USER_TYPES_STORAGE_KEY)).toContain('User Type A')
    expect(window.localStorage.getItem(USER_TYPES_STORAGE_KEY)).not.toContain('User Type C')
  })

  test('supports empty data and reports malformed storage', async () => {
    window.localStorage.setItem(USER_TYPES_STORAGE_KEY, JSON.stringify({ version: 1, userTypes: [] }))
    expect(await mockUserTypesRepository.list()).toEqual([])
    window.localStorage.setItem(USER_TYPES_STORAGE_KEY, '{broken')
    await expect(mockUserTypesRepository.list()).rejects.toThrow('Local user type data could not be read.')
  })
})
