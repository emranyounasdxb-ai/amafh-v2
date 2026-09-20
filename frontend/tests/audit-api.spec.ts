import { expect, test } from '@playwright/test'

const actor = process.env.PLAYWRIGHT_AUDIT_ACTOR
test.skip(!actor, 'Requires isolated Audit fixture')

for (const width of [1440, 1024, 390]) test('Read-only Audit Log at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(actor!)
  await page.getByLabel('Password').fill('audit check password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.goto('/administration/audit-log')
  await expect(page.getByRole('heading', { name: 'Audit records' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Audit Log' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'View' }).first().click()
  await expect(page.getByText('Actor', { exact: true })).toBeVisible()
  await expect(page.getByText('Before', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
})
