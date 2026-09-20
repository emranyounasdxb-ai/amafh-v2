import { expect, test } from '@playwright/test'

const actor = process.env.PLAYWRIGHT_NOTIFY_ACTOR
const caseId = process.env.PLAYWRIGHT_NOTIFY_CASE
test.skip(!actor || !caseId, 'Requires isolated notification fixture')

for (const width of [1440, 1024, 390]) test('internal inbox and Case communication at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(actor!)
  await page.getByLabel('Password').fill('new notification password 2026!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { level: 1, name: 'Notification Centre' })).toBeVisible()
  await expect(page.getByText('case-overdue').first()).toBeVisible()
  await page.getByRole('button', { name: 'Mark all as read' }).click()
  await expect(page.getByText('Unread')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)

  await page.goto('/cases/' + caseId)
  await expect(page.getByRole('heading', { level: 1, name: 'Case workspace' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operational notifications' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Case History' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
})
