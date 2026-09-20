import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const actor = process.env.PLAYWRIGHT_REPORT_ACTOR
test.skip(!actor, 'Requires isolated Reporting fixture')

for (const width of [1440, 1024, 390]) test('Database Reports at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(actor!)
  await page.getByLabel('Password').fill('report check password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Reporting & Analytics' })).toBeVisible()
  await expect(page.getByText('Could not load Reports')).toHaveCount(0)
  await expect(page.getByText('Case summary')).toBeVisible()
  await expect(page.getByText('Finance for filtered Cases')).toBeVisible()
  const response = await page.request.get('/api/v1/reports/snapshot')
  expect(response.ok()).toBe(true)
  const data = await response.json() as { cases: { bank: string }[] }
  if (data.cases.length >= 2) {
    const bank = data.cases[0].bank
    await page.getByRole('combobox', { name: 'Bank', exact: true }).click()
    await page.getByRole('option', { name: bank, exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export filtered CSV' }).click()
    const csv = await download
    expect(csv.suggestedFilename()).toBe('amafh-cases-report.csv')
    const content = await readFile(await csv.path(), 'utf8')
    expect(content).toContain(bank)
    expect(content).not.toContain(data.cases.find(item => item.bank !== bank)!.bank)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
})
