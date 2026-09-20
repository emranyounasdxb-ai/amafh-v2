import { expect, test } from '@playwright/test'

const manager = process.env.PLAYWRIGHT_STAGE_MANAGER
const coordinator = process.env.PLAYWRIGHT_STAGE_COORDINATOR
const productId = process.env.PLAYWRIGHT_STAGE_PRODUCT
const caseId = process.env.PLAYWRIGHT_STAGE_CASE
test.skip(!manager || !coordinator || !productId || !caseId, 'Requires isolated stage API fixture')

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByLabel('Password').fill('stage tracking password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
}

for (const width of [1440, 1024, 390]) test(`Product stages and Case SLA at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await signIn(page, manager!)
  await page.goto(`/administration/banks-products/products/${productId}/stages`)
  await expect(page.getByText('Stage One', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Used by Case').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Stage' }).first()).toBeDisabled()
  const name = `Browser Stage ${width} ${Date.now()}`
  await page.getByRole('textbox', { name: 'Stage Name' }).fill(name)
  await page.getByRole('button', { name: 'Add Stage' }).click()
  await expect(page.getByText(name, { exact: false }).first()).toBeVisible()
  const row = page.getByRole('listitem').filter({ hasText: name })
  await row.getByRole('button', { name: 'Edit Stage' }).click()
  await page.getByRole('textbox', { name: 'Stage Name' }).fill(`${name} Updated`)
  await page.getByRole('button', { name: 'Save Stage' }).click()
  await expect(page.getByText(`${name} Updated`, { exact: false }).first()).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: `${name} Updated` }).getByRole('button', { name: 'Delete Stage' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText(`${name} Updated`, { exact: false })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)

  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await signIn(page, coordinator!)
  await page.goto(`/cases/${caseId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Case workspace' })).toBeVisible()
  await expect(page.getByText('Current Stage SLA')).toBeVisible()
  await expect(page.getByText('captured at stage entry', { exact: false })).toBeVisible()
  await expect(page.getByText(/On Time|Due Soon|Overdue/).first()).toBeVisible()
  await page.getByRole('button', { name: 'View History' }).click()
  await expect(page.getByRole('heading', { name: 'Case History' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
})
