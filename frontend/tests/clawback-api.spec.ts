import { expect, test } from '@playwright/test'

const actor = process.env.PLAYWRIGHT_CLAWBACK_ACTOR
test.skip(!actor, 'Requires isolated Paid Commission fixture')

for (const width of [1440, 1024, 390]) test('Clawback record and resolution at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(actor!)
  await page.getByLabel('Password').fill('commission check password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.goto('/finance')
  await page.getByRole('button', { name: 'Clawbacks' }).click()
  await expect(page.getByRole('heading', { name: 'Record Clawback' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Paid Commission' }).click()
  await page.getByRole('option').filter({ hasText: /CASE-/ }).first().click()
  await page.getByRole('spinbutton', { name: 'Clawback amount' }).fill('25')
  const reason = 'Browser reversal ' + width + ' ' + Date.now()
  await page.getByRole('textbox', { name: 'Reason' }).fill(reason)
  await page.getByRole('button', { name: 'Record Clawback' }).click()
  await expect(page.getByText(reason)).toBeVisible()
  const section = page.locator('.amafh-section').filter({ hasText: reason })
  await section.getByRole('button', { name: 'Resolve' }).click()
  await expect(section.getByText('Resolved')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
})
