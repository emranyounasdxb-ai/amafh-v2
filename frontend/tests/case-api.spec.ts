import { expect, test } from '@playwright/test'

test.skip(!process.env.PLAYWRIGHT_CASE_OWNER || !process.env.PLAYWRIGHT_CASE_COORDINATOR || !process.env.PLAYWRIGHT_CASE_COORDINATOR_NAME, 'Requires isolated Case lifecycle fixture')

for (const width of [1440, 1024, 390]) test(`real approval to locked Case lifecycle at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.PLAYWRIGHT_CASE_OWNER!)
  await page.getByLabel('Password').fill('case lifecycle password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  const caseId = await page.evaluate(async width => {
    const catalogue = await (await fetch('/api/v1/catalogue', { credentials: 'include' })).json() as { id: string; kind: string; name: string; parent_id: string | null }[]
    const bank = catalogue.find(item => item.kind === 'banks' && item.name.startsWith('Case Bank'))!
    const product = catalogue.find(item => item.kind === 'products' && item.parent_id === bank.id)!
    const variant = catalogue.find(item => item.kind === 'variants' && item.parent_id === product.id)!
    const owner = (await (await fetch('/api/v1/auth/session', { credentials: 'include' })).json() as { user: { id: string } }).user.id
    const created = await fetch('/api/v1/applications', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_customer: { type: 'individual', full_name: `Case Browser ${width}`, emirates_id: `784-${width}-${Date.now()}` }, bank_id: bank.id, product_id: product.id, variant_id: variant.id, case_owner_id: owner, requested_amount: '100000' }) })
    if (!created.ok) throw new Error(`Could not create Case: ${created.status}`)
    return (await created.json() as { id: string }).id
  }, width)
  await page.goto(`/cases/${caseId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Case workspace' })).toBeVisible()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.getByText('SM Approved').first()).toBeVisible()
  await page.getByRole('combobox', { name: 'Case Coordinator' }).click()
  await page.getByRole('option', { name: process.env.PLAYWRIGHT_CASE_COORDINATOR_NAME!, exact: true }).click()
  await page.getByRole('button', { name: 'Assign Case Coordinator' }).click()
  await expect(page.getByText(process.env.PLAYWRIGHT_CASE_COORDINATOR_NAME!, { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.PLAYWRIGHT_CASE_COORDINATOR!)
  await page.getByLabel('Password').fill('case lifecycle password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.goto(`/cases/${caseId}`)
  await page.getByRole('button', { name: 'Submit to Bank' }).click()
  await expect(page.getByText('Submitted to Bank').first()).toBeVisible()
  await page.getByRole('textbox', { name: 'Bank File Number' }).fill(`BANK-BROWSER-${width}`)
  await page.getByRole('button', { name: 'Add Bank File Number' }).click()
  await expect(page.getByText('Locked · original submission protected')).toBeVisible()
  await page.getByRole('button', { name: 'View History' }).click()
  await expect(page.getByRole('heading', { name: 'Case History' })).toBeVisible()
  await expect(page.getByText('Case Locked')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
})
