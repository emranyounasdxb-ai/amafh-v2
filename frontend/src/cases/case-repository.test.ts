import { beforeEach, expect, test } from 'vitest'
import { banksProductsRepository } from '../administration/banks-products/banks-products'
import { PERMISSIONS_STORAGE_KEY } from '../administration/permissions/mock-permissions-repository'
import { caseActionAllowed } from './case-permissions'
import { mockUsersRepository } from '../administration/users/mock-users-repository'
import { mockUserTypesRepository } from '../administration/user-types/mock-user-types-repository'
import { mockApplicationRepository } from '../customers/mock-customer-repository'
import { caseRepository, isCaseLocked } from './case-repository'

beforeEach(() => {
  localStorage.clear()
  const actions = ['create', 'approve', 'reject', 'assign-coordinator', 'submit-to-bank', 'add-bank-file-number', 'update-stage', 'assign-owner', 'edit', 'edit-history', 'delete']
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ version: 1, permissions: actions.map(action => ({ id: `case-${action}`, domain: 'Cases', action, description: 'Test right', enabled: true, userTypeIds: ['sample-type-1'], createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' })) }))
})

test('a linked Case starts pending, validates catalogue and existing owner, and persists', async () => {
  const draft = { bank: 'Sample Bank', product: 'Sample Product', productVariant: 'Sample Variant', requestedAmount: '10000', caseOwnerId: 'sample-aisha' }
  await expect(mockApplicationRepository.createWithCustomer({ ...draft, productVariant: 'Wrong' }, { mode: 'existing', id: 'sample-individual-1' }, 'sample-aisha')).rejects.toThrow(/valid active Bank/)
  await expect(mockApplicationRepository.createWithCustomer({ ...draft, caseOwnerId: 'missing' }, { mode: 'existing', id: 'sample-individual-1' }, 'sample-aisha')).rejects.toThrow(/existing Case Owner/)
  const { application } = await mockApplicationRepository.createWithCustomer(draft, { mode: 'existing', id: 'sample-individual-1' }, 'sample-aisha')
  expect(application.status).toBe('Pending SM Approval')
  expect(application.caseOwnerId).toBe('sample-aisha')
  expect(application.history.map(item => item.label)).toEqual(['Case Created'])
  expect((await caseRepository.list()).filter(item => item.customerId === 'sample-individual-1')).toHaveLength(3)
  expect((await caseRepository.list()).find(item => item.id === application.id)).toEqual(application)
})

test('approval, coordinator, submission, file number, lock, and later stages preserve history', async () => {
  const id = 'sample-case-1'
  await expect(caseRepository.update(id, { action: 'assign-coordinator', actorId: 'sample-aisha', value: 'sample-sara' })).rejects.toThrow(/approval/)
  const approved = await caseRepository.update(id, { action: 'approve', actorId: 'sample-sara' })
  expect(approved.approvalActorId).toBe('sample-sara')
  expect(approved.approvedAt).toBeTruthy()
  expect(isCaseLocked(approved)).toBe(false)
  await expect(caseRepository.update(id, { action: 'add-bank-file-number', actorId: 'sample-sara', value: 'BN-1' })).rejects.toThrow(/Submit/)
  await caseRepository.update(id, { action: 'assign-coordinator', actorId: 'sample-sara', value: 'sample-aisha' })
  await expect(caseRepository.update(id, { action: 'submit-to-bank', actorId: 'sample-sara' })).rejects.toThrow(/assigned Case Coordinator/)
  await caseRepository.update(id, { action: 'submit-to-bank', actorId: 'sample-aisha' })
  const locked = await caseRepository.update(id, { action: 'add-bank-file-number', actorId: 'sample-aisha', value: 'BN-1' })
  expect(isCaseLocked(locked)).toBe(true)
  expect(locked.history.slice(-2).map(item => item.label)).toEqual(['Bank File Number Added', 'Case Locked'])
  await expect(caseRepository.update(id, { action: 'edit', actorId: 'sample-aisha', draft: { bank: 'Sample Bank', product: 'Sample Product', productVariant: 'Sample Variant', requestedAmount: '1', caseOwnerId: 'sample-aisha' } })).rejects.toThrow(/protected/)
  const stage = await caseRepository.update(id, { action: 'update-stage', actorId: 'sample-aisha', value: 'sample-stage-1' })
  expect(stage.stage).toBe('Stage 1')
  expect(stage.stageId).toBe('sample-stage-1')
  expect(stage.stageStartedAt).toBeTruthy()
  expect(stage.stageExpectedDurationHours).toBe(24)
  expect(stage.history.at(-1)?.label).toBe('Stage 1')
  expect(stage.history.every((event, index, history) => !index || event.at >= history[index - 1].at)).toBe(true)
  await expect(caseRepository.remove(id, 'sample-aisha')).rejects.toThrow(/history/)
})

test('rejection, owner changes, allowed deletion, and dependent catalogue deletion', async () => {
  await caseRepository.update('sample-case-2', { action: 'assign-owner', actorId: 'sample-aisha', value: 'sample-sara' })
  const rejected = await caseRepository.update('sample-case-2', { action: 'reject', actorId: 'sample-sara' })
  expect(rejected.status).toBe('SM Rejected')
  await expect(caseRepository.update('sample-case-2', { action: 'approve', actorId: 'sample-aisha' })).rejects.toThrow(/reviewed/)
  await expect(banksProductsRepository.remove('sample-variant-1')).rejects.toThrow(/Case depends/)
  const created = await mockApplicationRepository.createWithCustomer({ bank: 'Sample Bank', product: 'Sample Product', productVariant: 'Sample Variant', requestedAmount: '100', caseOwnerId: 'sample-aisha' }, { mode: 'existing', id: 'sample-company-1' }, 'sample-aisha')
  await caseRepository.remove(created.application.id, 'sample-aisha')
  expect((await caseRepository.list()).some(item => item.id === created.application.id)).toBe(false)
})

test('Case actions require manually assigned enabled User Type permissions in the local preview', async () => {
  const users = await mockUsersRepository.list(); const types = await mockUserTypesRepository.list()
  expect(caseActionAllowed('approve', 'sample-aisha', users, types, [])).toBe(false)
  const permission = { id: 'case-approve', domain: 'Cases', action: 'approve', description: 'Review cases.', enabled: true, userTypeIds: ['sample-type-1'], createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' }
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ version: 1, permissions: [permission] }))
  expect(caseActionAllowed('approve', 'sample-aisha', users, types, [permission])).toBe(true)
  expect(caseActionAllowed('approve', 'sample-omar', users, types, [permission])).toBe(false)
  expect(caseActionAllowed('reject', 'sample-aisha', users, types, [permission])).toBe(false)
  expect(caseActionAllowed('approve', 'sample-aisha', users, types, [{ ...permission, enabled: false }])).toBe(false)
})

test('direct Case repository mutations require the action and assignment together', async () => {
  localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
  await expect(mockApplicationRepository.createWithCustomer({ bank: 'Sample Bank', product: 'Sample Product', productVariant: 'Sample Variant', requestedAmount: '100', caseOwnerId: 'sample-aisha' }, { mode: 'existing', id: 'sample-company-1' }, 'sample-aisha')).rejects.toThrow(/Cases: create/)
  await expect(caseRepository.update('sample-case-1', { action: 'approve', actorId: 'sample-aisha' })).rejects.toThrow(/Cases: approve/)
  await expect(caseRepository.remove('sample-case-3', 'sample-aisha')).rejects.toThrow(/Cases: delete/)
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ version: 1, permissions: [
    { id: 'case-approve', domain: 'Cases', action: 'approve', description: 'Approve', enabled: true, userTypeIds: ['sample-type-1'], createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' },
    { id: 'case-submit', domain: 'Cases', action: 'submit-to-bank', description: 'Submit', enabled: true, userTypeIds: ['sample-type-1'], createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' },
  ] }))
  await caseRepository.update('sample-case-1', { action: 'approve', actorId: 'sample-aisha' })
  await expect(caseRepository.update('sample-case-1', { action: 'submit-to-bank', actorId: 'sample-aisha' })).rejects.toThrow(/assign a coordinator/)
})
