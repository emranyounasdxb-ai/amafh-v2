import { beforeEach, expect, test } from 'vitest'
import { banksProductsRepository } from './banks-products'
import { productStagesRepository, PRODUCT_STAGES_STORAGE_KEY } from './product-stages'
import { mockApplicationRepository } from '../../customers/mock-customer-repository'
import { caseRepository } from '../../cases/case-repository'
import { caseStageAging, formatDuration } from '../../cases/case-aging'
import { PERMISSIONS_STORAGE_KEY } from '../permissions/mock-permissions-repository'

beforeEach(() => {
  localStorage.clear()
  const actions = ['create', 'approve', 'assign-coordinator', 'submit-to-bank', 'add-bank-file-number', 'update-stage', 'add-stage', 'edit-stage', 'delete-stage', 'reorder-stage', 'activate-stage', 'set-stage-duration']
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ version: 1, permissions: actions.map(action => ({ id: `case-${action}`, domain: 'Cases', action, description: 'Test right', enabled: true, userTypeIds: ['sample-type-1'], createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' })) }))
})
const draft = (name: string, expectedDurationHours = 2) => ({ name, expectedDurationHours, status: 'active' as const })

test('direct Product Stage mutation requires the specific manually assigned action', async () => {
  localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
  await expect(productStagesRepository.create('sample-product-1', draft('New Stage'), 'sample-aisha')).rejects.toThrow(/Cases: add-stage/)
  await expect(productStagesRepository.update('sample-stage-1', draft('New name', 24), 'sample-aisha')).rejects.toThrow(/Cases: edit-stage/)
  await expect(productStagesRepository.move('sample-stage-2', -1, 'sample-aisha')).rejects.toThrow(/Cases: reorder-stage/)
  await expect(productStagesRepository.remove('sample-stage-1', 'sample-aisha')).rejects.toThrow(/Cases: delete-stage/)
})

test('Stages are Product-specific with CRUD, order, active state and duplicate protection', async () => {
  const other = await banksProductsRepository.create({ kind: 'products', name: 'Other Product', parentId: 'sample-bank-1', description: 'Other product.', status: 'active', extra: '' })
  expect(await productStagesRepository.list(other.id)).toEqual([])
  const first = await productStagesRepository.create(other.id, draft('Review'), 'sample-aisha')
  const second = await productStagesRepository.create(other.id, draft('Decision', 4), 'sample-aisha')
  expect((await productStagesRepository.list(other.id)).map(item => item.name)).toEqual(['Review', 'Decision'])
  await expect(productStagesRepository.create(other.id, draft(' review '), 'sample-aisha')).rejects.toThrow(/already exists/)
  const moved = await productStagesRepository.move(second.id, -1, 'sample-aisha')
  expect(moved.map(item => item.name)).toEqual(['Decision', 'Review'])
  const updated = await productStagesRepository.update(first.id, { name: 'Assessment', expectedDurationHours: 3, status: 'inactive' }, 'sample-aisha')
  expect(updated).toMatchObject({ name: 'Assessment', expectedDurationHours: 3, status: 'inactive' })
  await productStagesRepository.remove(second.id, 'sample-aisha')
  expect((await productStagesRepository.list(other.id)).map(item => item.sequence)).toEqual([1])
  expect((await productStagesRepository.list('sample-product-1')).map(item => item.name)).toEqual(['Stage 1', 'Stage 2', 'Stage 3', 'Final Outcome'])
  await expect(banksProductsRepository.remove(other.id)).rejects.toThrow(/Product Stages depend/)
})

test('Used Stage protects identity, state, order and deletion while timeframe updates preserve entry snapshot and history', async () => {
  const id = 'sample-case-1'
  await caseRepository.update(id, { action: 'approve', actorId: 'sample-aisha' })
  await caseRepository.update(id, { action: 'assign-coordinator', actorId: 'sample-aisha', value: 'sample-sara' })
  await caseRepository.update(id, { action: 'submit-to-bank', actorId: 'sample-sara' })
  await caseRepository.update(id, { action: 'add-bank-file-number', actorId: 'sample-sara', value: 'BF-1' })
  const entered = await caseRepository.update(id, { action: 'update-stage', actorId: 'sample-sara', value: 'sample-stage-1' })
  const originalHistory = JSON.stringify(entered.history)
  expect(entered.stageStartedAt).toBe(entered.history.at(-1)?.at)
  expect(entered.history.at(-1)).toMatchObject({ stageId: 'sample-stage-1', expectedDurationHours: 24, actorId: 'sample-sara' })
  await expect(productStagesRepository.update('sample-stage-1', draft('Renamed', 24), 'sample-aisha')).rejects.toThrow(/Only Expected Duration/)
  await expect(productStagesRepository.update('sample-stage-1', { ...draft('Stage 1', 24), status: 'inactive' }, 'sample-aisha')).rejects.toThrow(/Only Expected Duration/)
  await expect(productStagesRepository.remove('sample-stage-1', 'sample-aisha')).rejects.toThrow(/Case uses/)
  await expect(productStagesRepository.move('sample-stage-1', 1, 'sample-aisha')).rejects.toThrow(/sequence is protected/)
  await productStagesRepository.update('sample-stage-1', draft('Stage 1', 1), 'sample-aisha')
  const still = (await caseRepository.list()).find(item => item.id === id)!
  expect(still.stageStartedAt).toBe(entered.stageStartedAt)
  expect(still.stageExpectedDurationHours).toBe(24)
  expect(JSON.stringify(still.history)).toBe(originalHistory)
  await caseRepository.update(id, { action: 'update-stage', actorId: 'sample-sara', value: 'sample-stage-2' })
  const reentered = await caseRepository.update(id, { action: 'update-stage', actorId: 'sample-sara', value: 'sample-stage-1' })
  expect(reentered.stageExpectedDurationHours).toBe(1)
  expect(reentered.history.at(-1)?.expectedDurationHours).toBe(1)
  expect(reentered.history.find(item => item.id === entered.history.at(-1)?.id)).toEqual(entered.history.at(-1))
})

test('stage SLA calculates due, elapsed, remaining, due soon and overdue from captured entry', async () => {
  const entered = { ...(await caseRepository.list())[0], stageId: 'sample-stage-1', stage: 'Stage 1', stageStartedAt: '2026-09-20T00:00:00.000Z', stageExpectedDurationHours: 4 }
  expect(caseStageAging(entered, new Date('2026-09-20T01:00:00.000Z'))).toMatchObject({ dueAt: '2026-09-20T04:00:00.000Z', elapsedMs: 3600000, remainingMs: 10800000, status: 'On Time' })
  expect(caseStageAging(entered, new Date('2026-09-20T03:30:00.000Z'))?.status).toBe('Due Soon')
  expect(caseStageAging(entered, new Date('2026-09-20T05:15:00.000Z'))).toMatchObject({ status: 'Overdue', overdueMs: 4500000, remainingMs: 0 })
  expect(formatDuration(4500000)).toBe('1h 15m')
  expect(caseStageAging({ ...entered, stageStartedAt: undefined })).toBeNull()
})

test('inactive and cross-Product Stages cannot be selected; used history persists across ordering changes', async () => {
  const other = await banksProductsRepository.create({ kind: 'products', name: 'Separate Product', parentId: 'sample-bank-1', description: 'Other.', status: 'active', extra: '' })
  const separate = await productStagesRepository.create(other.id, draft('Other Review'), 'sample-aisha')
  await productStagesRepository.update('sample-stage-2', { ...draft('Stage 2'), status: 'inactive' }, 'sample-aisha')
  await caseRepository.update('sample-case-1', { action: 'approve', actorId: 'sample-aisha' })
  await caseRepository.update('sample-case-1', { action: 'assign-coordinator', actorId: 'sample-aisha', value: 'sample-aisha' })
  await caseRepository.update('sample-case-1', { action: 'submit-to-bank', actorId: 'sample-aisha' })
  await expect(caseRepository.update('sample-case-1', { action: 'update-stage', actorId: 'sample-aisha', value: 'sample-stage-2' })).rejects.toThrow(/active Stage/)
  await expect(caseRepository.update('sample-case-1', { action: 'update-stage', actorId: 'sample-aisha', value: separate.id })).rejects.toThrow(/active Stage/)
  const caseBefore = (await caseRepository.list())[0]
  await productStagesRepository.move('sample-stage-4', -1, 'sample-aisha')
  expect((await caseRepository.list())[0].history).toEqual(caseBefore.history)
})

test('new Product Case uses its own Stage configuration', async () => {
  const product = await banksProductsRepository.create({ kind: 'products', name: 'Product B', parentId: 'sample-bank-1', description: 'Product B.', status: 'active', extra: '' })
  await banksProductsRepository.create({ kind: 'variants', name: 'Variant B', parentId: product.id, description: 'Variant B.', status: 'active', extra: '' })
  const stage = await productStagesRepository.create(product.id, draft('Product B Review', 6), 'sample-aisha')
  const { application } = await mockApplicationRepository.createWithCustomer({ bank: 'Sample Bank', product: 'Product B', productVariant: 'Variant B', requestedAmount: '100', caseOwnerId: 'sample-aisha' }, { mode: 'existing', id: 'sample-individual-1' }, 'sample-aisha')
  await caseRepository.update(application.id, { action: 'approve', actorId: 'sample-aisha' })
  await caseRepository.update(application.id, { action: 'assign-coordinator', actorId: 'sample-aisha', value: 'sample-aisha' })
  await caseRepository.update(application.id, { action: 'submit-to-bank', actorId: 'sample-aisha' })
  await expect(caseRepository.update(application.id, { action: 'update-stage', actorId: 'sample-aisha', value: 'sample-stage-1' })).rejects.toThrow(/active Stage/)
  expect((await caseRepository.update(application.id, { action: 'update-stage', actorId: 'sample-aisha', value: stage.id })).stageExpectedDurationHours).toBe(6)
})

test('malformed Product Stage data is recoverable', async () => {
  localStorage.setItem(PRODUCT_STAGES_STORAGE_KEY, '{broken')
  await expect(productStagesRepository.list('sample-product-1')).rejects.toThrow(/could not be read/)
  localStorage.setItem(PRODUCT_STAGES_STORAGE_KEY, JSON.stringify({ version: 1, records: [] }))
  expect(await productStagesRepository.list('sample-product-1')).toEqual([])
})
