import { expect, test } from '@playwright/test'

const actor = process.env.PLAYWRIGHT_CSV_ACTOR
const organization = process.env.PLAYWRIGHT_CSV_ORG
const userType = process.env.PLAYWRIGHT_CSV_TYPE
test.skip(!actor || !organization || !userType, 'Requires isolated CSV import fixture')

async function upload(page: import('@playwright/test').Page, label: string, content: string) {
  await page.getByLabel(label).setInputFiles({ name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from(content) })
}

for (const [index, width] of [1440, 1024, 390].entries()) test('CSV preview and confirm at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(actor!)
  await page.getByLabel('Password').fill('csv import password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()

  const day = '2026-09-' + (24 + index)
  await page.goto('/imports/attendance')
  await upload(page, 'Upload Attendance CSV', 'userEmail,date,status\n' + actor + ',' + day + ',Present\nmissing@example.test,' + day + ',Late')
  await expect(page.getByRole('heading', { name: 'Validation summary' })).toBeVisible()
  await expect(page.getByText('User email was not found.')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Import' }).click()
  await expect(page.getByRole('heading', { name: 'Import result' })).toBeVisible()
  await expect(page.getByText(/1 imported/).first()).toBeVisible()

  await page.goto('/imports/users')
  const email = 'csv-browser-' + width + '-' + Date.now() + '@example.test'
  const userCsv = 'fullName,email,userType,organization,organizationScope,officeBranch,department,team\n' +
    'Browser Employee,' + email + ',' + userType + ',' + organization + ',organization,,,\n' +
    'Bad Employee,bad-' + width + '@example.test,Wrong Type,' + organization + ',organization,,,'
  await upload(page, 'Upload One-time Users / Employees CSV', userCsv)
  await expect(page.getByRole('heading', { name: 'Validation summary' })).toBeVisible()
  await expect(page.getByText('Active User Type was not found.')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Import' }).click()
  await expect(page.getByRole('heading', { name: 'Import result' })).toBeVisible()
  await expect(page.getByText('/set-password?token=', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
})
