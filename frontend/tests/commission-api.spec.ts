import { expect, test } from '@playwright/test'

const actor = process.env.PLAYWRIGHT_FINANCE_ACTOR
test.skip(!actor, 'Requires isolated commission fixture')

for (const [index, width] of [1440, 1024, 390].entries()) test('Commission rules and lifecycle at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(actor!)
  await page.getByLabel('Password').fill('commission check password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const snapshot = await (await fetch('/api/v1/finance/snapshot', { credentials: 'include' })).json() as {
      rules: { id: string; method: string; value: string; product_id: string | null; effective_from: string }[]
    }
    for (const rule of snapshot.rules.filter(item => item.method === 'Fixed Amount' && Number(item.value) === 150 && item.product_id === null && /^202[789]-01-01$/.test(item.effective_from))) {
      await fetch('/api/v1/finance/rules/' + rule.id, { method: 'DELETE', credentials: 'include' })
    }
  })
  await page.goto('/finance')
  await expect(page.getByRole('heading', { level: 1, name: 'Finance' })).toBeVisible()
  await expect(page.getByText('1000.00').first()).toBeVisible()
  await page.getByRole('button', { name: 'Rules', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add Commission Rule' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Bank' }).click()
  await page.getByRole('option', { name: /Finance Bank/ }).first().click()
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('150')
  await page.getByRole('textbox', { name: 'Effective From' }).fill(String(2027 + index) + '-01-01')
  await page.getByRole('button', { name: 'Save Rule' }).click()
  await expect(page.getByText('Fixed Amount: 150')).toBeVisible()
  const rule = page.locator('.amafh-section').filter({ hasText: 'Fixed Amount: 150' }).last()
  await rule.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Fixed Amount: 150')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
})
