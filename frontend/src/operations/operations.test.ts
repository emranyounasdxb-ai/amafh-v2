import { beforeEach, expect, test } from 'vitest'
import { PERMISSIONS_STORAGE_KEY } from '../administration/permissions/mock-permissions-repository'
import { mockUsersRepository } from '../administration/users/mock-users-repository'
import { caseRepository } from '../cases/case-repository'
import { profileImagesRepository, validateProfileImage } from './profile-images'
import { importRepository, previewImport, readCsvFile } from './csv-imports'
import { notificationsRepository } from './notifications'
import { tasksRepository, taskAging, type TaskDraft } from './tasks'
import { financeRepository } from './finance'
import { caseMetrics, casesToCsv, emptyReportFilters, filterCases, reportsRepository } from './reports'

beforeEach(() => localStorage.clear())
function grant(...actions: string[]) { localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify({ version: 1, permissions: actions.map((entry, index) => { const [domain, action] = entry.split(':'); return { id: `test-${index}`, domain, action, description: 'Test permission', enabled: true, userTypeIds: ['sample-type-1'], createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' } }) })) }
const png = `data:image/png;base64,${btoa('\x89PNG\r\n\x1a\nmock')}`
const taskDraft = (): TaskDraft => ({ title: 'Follow up Case', description: 'Call customer', customerId: 'sample-individual-1', caseId: 'sample-case-1', assignedTo: 'sample-sara', priority: 'High', dueDate: '2026-09-21', dueTime: '10:00' })

test('profile images allow own avatar and banner, reject invalid images, and protect other users', async () => {
  await profileImagesRepository.save('sample-aisha', 'avatar', png, 'sample-aisha')
  await profileImagesRepository.save('sample-aisha', 'banner', png, 'sample-aisha')
  expect(await profileImagesRepository.get('sample-aisha')).toEqual({ avatar: png, banner: png })
  await expect(profileImagesRepository.save('sample-sara', 'avatar', png, 'sample-aisha')).rejects.toThrow(/Profiles: edit-other-images/)
  await expect(profileImagesRepository.save('sample-aisha', 'avatar', 'data:image/png;base64,YWJj', 'sample-aisha')).rejects.toThrow(/content/)
  await expect(validateProfileImage(new File(['plain text'], 'fake.png', { type: 'image/png' }))).rejects.toThrow(/content/)
  grant('Profiles:edit-other-images')
  await profileImagesRepository.save('sample-sara', 'avatar', png, 'sample-aisha')
  await profileImagesRepository.remove('sample-aisha', 'banner', 'sample-aisha')
  expect((await profileImagesRepository.get('sample-aisha')).banner).toBe('')
})

test('CSV validates before confirmation, skips invalid rows, records import history and enforces permission', async () => {
  const user = (await mockUsersRepository.list()).find(item => item.id === 'sample-aisha')!
  const csv = `userEmail,date,status\n${user.email},2026-09-18,Present\nunknown@example.com,2026-09-18,Late\n${user.email},2026-09-18,Present`
  const preview = await previewImport('attendance', csv)
  expect([preview.valid, preview.invalid]).toEqual([1, 2])
  await expect(importRepository.confirm(preview, 'sample-aisha')).rejects.toThrow(/Imports: attendance/)
  grant('Imports:attendance')
  const result = await importRepository.confirm(preview, 'sample-aisha')
  expect([result.success, result.failed]).toEqual([1, 2])
  expect(await importRepository.attendance()).toHaveLength(1)
  expect(await importRepository.history()).toHaveLength(1)
  await expect(readCsvFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow(/CSV/)
  const cases = await previewImport('case-stage', 'caseNumber,stage\nUNKNOWN,Stage 1\nsample-case-1,Invalid Stage')
  expect([cases.unmatchedCases, cases.invalid]).toEqual([1, 2])
  const users = await previewImport('users', `fullName,email,userType,organization,organizationScope,officeBranch,department,team\nDuplicate,${user.email},User Type A,Organization A,organization,,,`)
  expect(users.invalid).toBe(1)
})

test('notifications preserve read state and direct list access requires permission', async () => {
  const created = await notificationsRepository.create({ recipientId: 'sample-aisha', category: 'system', message: 'Local activity', relatedType: 'system', relatedId: '', actorId: 'sample-sara' })
  await expect(notificationsRepository.list('sample-aisha')).rejects.toThrow(/Notifications: view/)
  grant('Notifications:view', 'Notifications:manage')
  expect((await notificationsRepository.list('sample-aisha'))[0].readAt).toBe('')
  await notificationsRepository.markRead(created.id, 'sample-aisha')
  expect((await notificationsRepository.list('sample-aisha'))[0].readAt).toBeTruthy()
  await notificationsRepository.archive(created.id, 'sample-aisha')
  expect(await notificationsRepository.list('sample-aisha')).toHaveLength(0)
})

test('Tasks require manual rights for create, edit, assignment, completion and deletion', async () => {
  await expect(tasksRepository.create(taskDraft(), 'sample-aisha')).rejects.toThrow(/Tasks: create/)
  grant('Tasks:create', 'Tasks:view')
  const task = await tasksRepository.create(taskDraft(), 'sample-aisha')
  expect(task.caseId).toBe('sample-case-1')
  expect(taskAging(task, new Date('2026-09-20T10:00:00'))).toBe('Due Soon')
  expect(taskAging(task, new Date('2026-09-22T10:00:00'))).toBe('Overdue')
  await expect(tasksRepository.update(task.id, { ...taskDraft(), assignedTo: 'sample-aisha', title: 'Changed' }, 'sample-aisha')).rejects.toThrow(/Tasks: assign/)
  grant('Tasks:create', 'Tasks:view', 'Tasks:assign')
  await expect(tasksRepository.update(task.id, { ...taskDraft(), assignedTo: 'sample-aisha', title: 'Changed' }, 'sample-aisha')).rejects.toThrow(/Tasks: edit/)
  grant('Tasks:create', 'Tasks:view', 'Tasks:assign', 'Tasks:edit', 'Tasks:complete', 'Tasks:delete')
  await tasksRepository.update(task.id, { ...taskDraft(), assignedTo: 'sample-aisha', title: 'Changed' }, 'sample-aisha')
  expect((await tasksRepository.setStatus(task.id, 'In Progress', 'sample-aisha')).status).toBe('In Progress')
  const done = await tasksRepository.setStatus(task.id, 'Completed', 'sample-aisha')
  expect(done.completedAt).toBeTruthy()
  await tasksRepository.remove(task.id, 'sample-aisha')
  expect(await tasksRepository.list('sample-aisha')).toHaveLength(0)
})

test('Finance eligibility, owner attribution, lifecycle, clawback and incentives use local records', async () => {
  grant('Finance:manage-rules', 'Finance:review-commission', 'Finance:approve-commission', 'Finance:mark-paid', 'Finance:manage-clawback', 'Finance:manage-incentives', 'Cases:approve', 'Cases:assign-coordinator', 'Cases:submit-to-bank', 'Cases:add-bank-file-number', 'Cases:update-stage')
  const rule = await financeRepository.saveRule({ bank: 'Sample Bank', product: 'Sample Product', productVariant: 'Sample Variant', method: 'Percentage', value: 2, effectiveFrom: '2020-01-01', effectiveUntil: '', active: true }, 'sample-aisha')
  await expect(financeRepository.calculate('sample-case-1', 'sample-aisha')).rejects.toThrow(/Final Outcome/)
  await caseRepository.update('sample-case-1', { action: 'approve', actorId: 'sample-sara' })
  await caseRepository.update('sample-case-1', { action: 'assign-coordinator', actorId: 'sample-sara', value: 'sample-aisha' })
  await caseRepository.update('sample-case-1', { action: 'submit-to-bank', actorId: 'sample-aisha' })
  await caseRepository.update('sample-case-1', { action: 'add-bank-file-number', actorId: 'sample-aisha', value: 'FILE-1' })
  await caseRepository.update('sample-case-1', { action: 'update-stage', actorId: 'sample-aisha', value: 'sample-stage-4' })
  const record = await financeRepository.calculate('sample-case-1', 'sample-aisha')
  expect(record.caseOwnerId).toBe('sample-aisha')
  expect(record.ruleId).toBe(rule.id)
  expect(record.amount).toBeGreaterThan(0)
  await expect(financeRepository.removeRule(rule.id, 'sample-aisha')).rejects.toThrow(/used/)
  await financeRepository.advance(record.id, 'Pending', 'sample-aisha')
  await financeRepository.advance(record.id, 'Approved', 'sample-aisha')
  await financeRepository.advance(record.id, 'Paid', 'sample-aisha')
  const clawback = await financeRepository.addClawback(record.id, 1, 'Reversal', 'sample-aisha')
  expect(clawback.status).toBe('Open')
  await expect(financeRepository.addClawback(record.id, record.amount, 'Too much', 'sample-aisha')).rejects.toThrow(/exceeds/)
  const incentive = await financeRepository.saveIncentive({ userId: 'sample-sara', period: '2026-Q3', metric: 'Completed Cases', targetValue: 5, achievement: 2, amount: 100, status: 'Draft' }, 'sample-aisha')
  expect(incentive.period).toBe('2026-Q3')
})

test('Reports filter real Cases, calculate metrics and export only the filtered rows', async () => {
  grant('Reports:view', 'Reports:export', 'Reports:view-financial')
  const data = await reportsRepository.load('sample-aisha')
  const one = filterCases(data.cases, { ...emptyReportFilters(), bank: 'Sample Bank', owner: 'sample-aisha' })
  expect(one.length).toBeLessThanOrEqual(data.cases.length)
  const noMatches = filterCases(data.cases, { ...emptyReportFilters(), bank: 'Impossible Bank' })
  expect(caseMetrics(noMatches).total).toBe(0)
  const csv = await reportsRepository.exportCsv(one, 'sample-aisha')
  expect(csv).toBe(casesToCsv(one))
  expect(csv.split('\r\n')).toHaveLength(one.length + 1)
  await expect(reportsRepository.finance('sample-omar')).rejects.toThrow(/Reports: view/)
})
