import { expect, test } from '@playwright/test'

test.skip(!process.env.PLAYWRIGHT_AUTHZ_OWNER, 'Requires isolated manually assigned API permission fixture')

test('local permission data cannot grant an API-authenticated user access', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.PLAYWRIGHT_AUTHZ_OWNER!)
  await page.getByLabel('Password').fill('account setup owner password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.evaluate(() => {
    localStorage.setItem('amafh-v2.mock-permissions.v1', JSON.stringify({ version: 1, permissions: [{ id: 'fake-users-view', domain: 'Users', action: 'view', description: 'Fake', enabled: true, userTypeIds: ['sample-type-1'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }))
    sessionStorage.setItem('amafh-v2.case-preview-actor', 'sample-aisha')
  })
  await page.goto('/administration/users')
  await expect(page.getByText('Permission required')).toBeVisible()
  await expect(page.getByText('Your User Type needs Users: view permission.')).toBeVisible()
  expect(await page.evaluate(async () => (await fetch('/api/v1/auth/permissions')).json())).toEqual({ permissions: [{ domain: 'Users', action: 'create' }] })
})
