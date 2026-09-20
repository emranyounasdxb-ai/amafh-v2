import { expect, test } from '@playwright/test'

test.skip(!process.env.PLAYWRIGHT_CUSTOMER_OWNER, 'Requires isolated customer API fixture')

async function selectFirst(page: import('@playwright/test').Page, label: string, optionName: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: new RegExp(optionName) }).first().click()
}

for (const width of [1440, 1024, 390]) test(`Create Application links one Customer to multiple Cases at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.PLAYWRIGHT_CUSTOMER_OWNER!)
  await page.getByLabel('Password').fill('customer check password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.goto('/applications/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Create Application' })).toBeVisible()
  const identity = `784-${width}-${Date.now()}`
  const name = `Browser Customer ${width}`
  await page.getByRole('textbox', { name: 'Emirates ID' }).fill(identity)
  await page.getByRole('textbox', { name: 'Passport Number' }).fill(`P-${width}-${Date.now()}`)
  await page.getByRole('textbox', { name: 'Full Name' }).fill(name)
  await selectFirst(page, 'Bank', 'Customer Bank')
  await selectFirst(page, 'Product', 'Customer Test Product')
  await selectFirst(page, 'Product Variant', 'Customer Test Variant')
  await page.getByRole('spinbutton', { name: 'Requested Amount' }).fill('50000')
  await selectFirst(page, 'Case Owner', 'Customer Owner')
  await page.getByRole('button', { name: 'Create Application' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Customer detail' })).toBeVisible()
  await expect(page.getByText('1 linked Case')).toBeVisible()
  await page.getByRole('button', { name: 'Open Case' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Case workspace' })).toBeVisible()
  await expect(page.getByText('Case Created').first()).toBeVisible()
  await page.getByRole('button', { name: 'Open Customer' }).click()
  await expect(page.getByText('1 linked Case')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
  await page.goto('/applications/new')
  await page.getByRole('searchbox', { name: 'Search existing customers' }).fill(identity)
  await expect(page.getByRole('region', { name: 'Matching customers' }).getByText(name)).toBeVisible()
  await page.getByRole('button', { name: 'Use existing customer' }).click()
  await selectFirst(page, 'Bank', 'Customer Bank')
  await selectFirst(page, 'Product', 'Customer Test Product')
  await selectFirst(page, 'Product Variant', 'Customer Test Variant')
  await page.getByRole('spinbutton', { name: 'Requested Amount' }).fill('60000')
  await selectFirst(page, 'Case Owner', 'Customer Owner')
  await page.getByRole('button', { name: 'Create Application' }).click()
  await expect(page.getByText('2 linked Cases')).toBeVisible()
})
