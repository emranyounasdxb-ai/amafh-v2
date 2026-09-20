import { expect, test } from 'vitest'
import type { ApplicationRecord } from '../customers/customer-model'
import { caseStageAging } from './case-aging'

const entered = '2026-09-20T00:00:00.000Z'
const caseAtStage = {
  stage: 'Bank Review', stageId: 'stage-1', stageStartedAt: entered,
  stageExpectedDurationHours: 4,
} as ApplicationRecord

test('stage aging distinguishes on time, due soon, and overdue from the stored entry snapshot', () => {
  const onTime = caseStageAging(caseAtStage, new Date('2026-09-20T01:00:00.000Z'))
  expect(onTime).toMatchObject({ status: 'On Time', elapsedMs: 3600000, remainingMs: 10800000, overdueMs: 0 })
  expect(onTime?.dueAt).toBe('2026-09-20T04:00:00.000Z')
  const dueSoon = caseStageAging(caseAtStage, new Date('2026-09-20T03:30:00.000Z'))
  expect(dueSoon).toMatchObject({ status: 'Due Soon', remainingMs: 1800000 })
  const overdue = caseStageAging(caseAtStage, new Date('2026-09-20T05:15:00.000Z'))
  expect(overdue).toMatchObject({ status: 'Overdue', remainingMs: 0, overdueMs: 4500000 })
  expect(caseAtStage.stageExpectedDurationHours).toBe(4)
  expect(caseAtStage.stageStartedAt).toBe(entered)
})

test('missing or invalid stage timing does not fabricate SLA status', () => {
  expect(caseStageAging({ ...caseAtStage, stageStartedAt: '' })).toBeNull()
  expect(caseStageAging({ ...caseAtStage, stageStartedAt: 'bad-date' })).toBeNull()
  expect(caseStageAging({ ...caseAtStage, stageExpectedDurationHours: 0 })).toBeNull()
})
