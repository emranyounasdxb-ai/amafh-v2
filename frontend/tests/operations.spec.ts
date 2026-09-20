import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers/auth'

const rights = [
  'Users:view',
  'Profiles:edit-other-images', 'Imports:attendance', 'Imports:case-stage', 'Imports:users',
  'Notifications:view', 'Notifications:manage', 'Notifications:view-communication-history',
  'Tasks:view', 'Tasks:create', 'Tasks:edit', 'Tasks:assign', 'Tasks:complete', 'Tasks:cancel', 'Tasks:delete',
  'Finance:view-commission', 'Finance:manage-rules', 'Finance:review-commission', 'Finance:approve-commission', 'Finance:mark-paid', 'Finance:view-incentives', 'Finance:manage-incentives', 'Finance:manage-clawback',
  'Reports:view', 'Reports:export', 'Reports:view-performance', 'Reports:view-financial',
]
async function grant(page: Page) { await page.evaluate(rights => localStorage.setItem('amafh-v2.mock-permissions.v1', JSON.stringify({ version: 1, permissions: rights.map((entry, index) => { const [domain, action] = entry.split(':'); return { id: `ops-${index}`, domain, action, description: 'Browser test right', enabled: true, userTypeIds: ['sample-type-1'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }) })), rights) }
async function actor(page: Page) { await page.getByRole('combobox', { name: 'Acting user (local permission preview)' }).click(); await page.getByRole('option', { name: 'Aisha Rahman · User Type A' }).click() }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false) }

for (const width of [1440, 1024, 390]) test(`operations routes and responsive permission states at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await signIn(page)
  await page.goto('/imports/attendance'); await expect(page.getByText('Permission required')).toBeVisible(); await noOverflow(page)
  await grant(page); await page.reload(); await actor(page); await expect(page.getByText('Required headers: userEmail, date, status')).toBeVisible(); await noOverflow(page)
  await page.goto('/profile/sample-aisha'); await expect(page.getByRole('heading', { name: /Aisha Rahman · Avatar/ })).toBeVisible(); await noOverflow(page)
  await page.goto('/notifications'); await expect(page.getByRole('heading', { name: 'Notification Centre' })).toBeVisible(); await noOverflow(page)
  await page.goto('/tasks'); await expect(page.getByRole('button', { name: 'Create Task' })).toBeVisible(); await noOverflow(page)
  await page.goto('/finance'); await expect(page.getByRole('heading', { name: 'Finance', exact: true })).toBeVisible(); await noOverflow(page)
  await page.goto('/reports'); await expect(page.getByRole('heading', { name: 'Case summary' })).toBeVisible(); await page.getByRole('combobox', { name: 'Bank' }).click(); await page.getByRole('option', { name: 'Sample Bank' }).click(); await expect(page.getByRole('heading', { name: 'Case summary' })).toBeVisible(); await noOverflow(page)
})

for (const width of [1440, 1024, 390]) test(`Reports use the shared Figma Calendar at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await signIn(page); await grant(page); await page.goto('/reports'); await actor(page)
  await expect(page.getByRole('heading', { name: 'Reporting & Analytics' })).toBeVisible()
  const from = page.getByRole('textbox', { name: 'From' })
  await expect(from).toHaveAttribute('placeholder', 'DD MMM YYYY')
  await expect(page.getByRole('textbox', { name: 'Until' })).toHaveAttribute('placeholder', 'DD MMM YYYY')
  await page.getByRole('button', { name: 'Choose from' }).click()
  const calendar = page.getByRole('group', { name: 'From calendar' })
  await expect(calendar).toBeVisible()
  await expect(calendar.getByRole('button', { name: 'Previous month' })).toBeVisible()
  if (process.env.CAPTURE_REPORT_CALENDAR) await page.screenshot({ path: `test-results/report-calendar-${width}.png` })
  await noOverflow(page)
  await calendar.getByRole('button', { name: /, / }).filter({ visible: true }).first().click()
  await expect(from).not.toHaveValue('')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(from).toHaveValue('')
  await noOverflow(page)
})

test('profile upload, CSV preview, Task, notification and report filters work in browser', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await signIn(page); await grant(page)
  await page.goto('/profile/sample-aisha'); await actor(page)
  await page.getByLabel('Upload avatar').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a6d6f636b', 'hex') })
  await expect(page.getByRole('img', { name: 'Selected avatar preview' })).toBeVisible()
  await page.getByRole('button', { name: 'Save avatar' }).click()
  await expect(page.getByRole('img', { name: 'Aisha Rahman avatar' })).toBeVisible()
  await page.getByLabel('Upload banner').setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a6d6f636b', 'hex') })
  await expect(page.getByRole('img', { name: 'Selected banner preview' })).toBeVisible()
  await page.getByRole('button', { name: 'Save banner' }).click()
  await expect(page.getByRole('img', { name: 'Aisha Rahman banner' })).toBeVisible()
  await page.goto('/administration/users/sample-aisha'); await expect(page.locator('.amafh-users-detail .amafh-avatar img')).toHaveAttribute('src', /^data:image\/png;base64,/)
  await page.goto('/imports/attendance'); await page.getByLabel('Upload Attendance CSV').setInputFiles({ name: 'attendance.csv', mimeType: 'text/csv', buffer: Buffer.from('userEmail,date,status\naisha@example.test,2026-09-18,Present\nunknown@example.com,2026-09-18,Late') })
  await expect(page.getByRole('heading', { name: 'Validation summary' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeEnabled()
  await page.getByRole('button', { name: 'Confirm Import' }).click(); await expect(page.getByRole('heading', { name: 'Import result' })).toBeVisible()
  await page.goto('/tasks'); await page.getByRole('button', { name: 'Create Task' }).click()
  await page.getByRole('textbox', { name: 'Task Title' }).fill('Call customer')
  await page.getByRole('combobox', { name: 'Assigned To' }).click(); await page.getByRole('option', { name: 'Sara Ali' }).click()
  await page.getByRole('textbox', { name: 'Due Date' }).fill('2026-09-21')
  await page.getByRole('textbox', { name: 'Due Time' }).fill('10:00')
  await page.getByRole('button', { name: 'Save Task' }).click(); await expect(page.getByRole('heading', { name: 'Call customer' })).toBeVisible()
  await page.goto('/reports'); await expect(page.getByRole('heading', { name: 'Case summary' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Bank' }).click(); await page.getByRole('option', { name: 'All' }).click()
  await expect(page.getByRole('heading', { name: 'Cases by Bank' })).toBeVisible()
})
