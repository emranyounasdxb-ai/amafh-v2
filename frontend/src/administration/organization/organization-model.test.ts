import { beforeEach, expect, test } from 'vitest'
import { mockOrganizationRepository, ORGANIZATION_STORAGE_KEY } from './mock-organization-repository'
import { validateOrganizationDraft, type OrganizationDraft } from './organization-model'

const draft: OrganizationDraft = { kind: 'teams', name: 'Local Team', parentId: 'department-1', description: 'Local team description.', status: 'active' }
beforeEach(() => localStorage.clear())

test('validates hierarchical parent and sibling duplicate name', async () => {
  const records = await mockOrganizationRepository.list()
  expect(validateOrganizationDraft({ ...draft, name: ' team   a ' }, records).name).toMatch(/sibling/)
  expect(validateOrganizationDraft({ ...draft, parentId: 'office-1' }, records).parentId).toMatch(/valid parent/)
  expect(validateOrganizationDraft({ ...draft, kind: 'departments', parentId: 'organization-1' }, records).parentId).toMatch(/valid parent/)
  expect(validateOrganizationDraft({ ...draft, parentId: 'department-2', name: 'Team A' }, records)).toEqual({})
  await expect(mockOrganizationRepository.create({ ...draft, name: 'Team A' })).rejects.toThrow()
})

test('creates, edits, and deletes a leaf with local persistence', async () => {
  const created = await mockOrganizationRepository.create(draft)
  expect((await mockOrganizationRepository.list()).find(item => item.id === created.id)?.parentId).toBe('department-1')
  const updated = await mockOrganizationRepository.update(created.id, { ...draft, name: 'Revised Team', status: 'inactive' })
  expect(updated.status).toBe('inactive')
  await mockOrganizationRepository.remove(created.id)
  expect((await mockOrganizationRepository.list()).some(item => item.id === created.id)).toBe(false)
  expect(localStorage.getItem(ORGANIZATION_STORAGE_KEY)).not.toContain(created.id)
})

test('blocks parent deletion, preserves children and reports corrupt local structure', async () => {
  await expect(mockOrganizationRepository.remove('department-1')).rejects.toThrow('1 related record depends')
  expect((await mockOrganizationRepository.list()).some(item => item.parentId === 'department-1')).toBe(true)
  localStorage.setItem(ORGANIZATION_STORAGE_KEY, JSON.stringify({ version: 1, records: [] }))
  expect(await mockOrganizationRepository.list()).toEqual([])
  localStorage.setItem(ORGANIZATION_STORAGE_KEY, '{broken')
  await expect(mockOrganizationRepository.list()).rejects.toThrow('Local organization data could not be read.')
})
