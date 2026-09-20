import { beforeEach, expect, test } from 'vitest'
import { mockPermissionsRepository, PERMISSIONS_STORAGE_KEY } from './mock-permissions-repository'
import { validatePermissionDraft, type PermissionDraft } from './permissions-model'
import { mockUserTypesRepository } from '../user-types/mock-user-types-repository'

const valid: PermissionDraft = { domain: 'Users', action: 'edit', description: 'Edit users.', enabled: true, userTypeIds: ['sample-type-1'] }
beforeEach(() => localStorage.clear())

test('rejects duplicate definitions and invalid action or User Type assignments', async () => {
  const [records, types] = await Promise.all([mockPermissionsRepository.list(), mockUserTypesRepository.list()])
  expect(validatePermissionDraft({ ...valid, action: 'view' }, records, types).action).toMatch(/already exists/)
  expect(validatePermissionDraft({ ...valid, action: 'delete' }, records, types).action).toMatch(/valid action/)
  expect(validatePermissionDraft({ ...valid, userTypeIds: [] }, records, types).userTypeIds).toMatch(/at least one/)
  expect(validatePermissionDraft({ ...valid, userTypeIds: ['missing'] }, records, types).userTypeIds).toMatch(/valid User Types/)
  expect(validatePermissionDraft({ ...valid, userTypeIds: ['sample-type-1', 'sample-type-1'] }, records, types).userTypeIds).toMatch(/duplicates/)
  await expect(mockPermissionsRepository.create({ ...valid, action: 'view' })).rejects.toThrow()
})

test('creates and updates a local User Type permission without changing user data', async () => {
  const created = await mockPermissionsRepository.create(valid)
  expect((await mockPermissionsRepository.list()).find(item => item.id === created.id)?.enabled).toBe(true)
  const updated = await mockPermissionsRepository.update(created.id, { ...valid, enabled: false, userTypeIds: [] })
  expect(updated.enabled).toBe(false)
  expect((await mockPermissionsRepository.list()).find(item => item.id === created.id)?.userTypeIds).toEqual([])
  expect(localStorage.getItem(PERMISSIONS_STORAGE_KEY)).toContain(created.id)
})

test('supports empty local data and reports corrupt data', async () => {
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ version: 1, permissions: [] }))
  expect(await mockPermissionsRepository.list()).toEqual([])
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, '{broken')
  await expect(mockPermissionsRepository.list()).rejects.toThrow('Local permission data could not be read.')
})
