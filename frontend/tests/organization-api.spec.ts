import { expect, test } from '@playwright/test'

test.skip(!process.env.PLAYWRIGHT_ORG_OWNER, 'Requires isolated organization API fixture')

for (const width of [1440, 1024, 390]) test(`real organization create, edit, delete at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.PLAYWRIGHT_ORG_OWNER!)
  await page.getByLabel('Password').fill('organization test password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  await page.goto('/administration/organization/organizations')
  await expect(page.getByRole('heading', { level: 1, name: 'Organizations' })).toBeVisible()
  await page.getByRole('button', { name: 'Create Organization' }).click()
  const name = `Browser Organization ${width} ${Date.now()}`
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  await page.getByRole('textbox', { name: 'Description' }).fill('Browser organization structure')
  await page.getByRole('button', { name: 'Create Organization' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Organization detail' })).toBeVisible()
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Edit Organization' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill(`${name} Updated`)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(`${name} Updated`, { exact: true }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
  await page.getByRole('button', { name: 'Delete Organization' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Organizations' })).toBeVisible()
})

test('account provisioning stores a valid organization scope and protects linked units', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(process.env.PLAYWRIGHT_ORG_OWNER!)
  await page.getByLabel('Password').fill('organization test password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  const prefix = `Scoped Browser ${Date.now()}`
  const ids = await page.evaluate(async prefix => {
    const create = async (kind: string, name: string, parent_id: string | null) => {
      const response = await fetch('/api/v1/organization', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name, parent_id, description: 'Scoped browser structure', active: true }) })
      if (!response.ok) throw new Error(`Could not create ${kind}: ${response.status}`)
      return (await response.json() as { id: string }).id
    }
    const organization = await create('organizations', prefix, null)
    const office = await create('offices', `${prefix} Office`, organization)
    const department = await create('departments', `${prefix} Department`, office)
    const team = await create('teams', `${prefix} Team`, department)
    return { organization, office, department, team }
  }, prefix)
  await page.goto('/account/provision-user')
  await expect(page.getByRole('heading', { level: 1, name: 'Create user account' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Full name' }).fill('Scoped Browser User')
  await page.getByRole('textbox', { name: 'Email' }).fill(`scoped-browser-${Date.now()}@example.test`)
  await page.getByLabel('User Type').click()
  await page.getByRole('option', { name: /Organization Test/ }).first().click()
  for (const [label, name] of [['Organization', prefix], ['Office / Branch', `${prefix} Office`], ['Department', `${prefix} Department`], ['Team', `${prefix} Team`]]) {
    await page.getByLabel(label, { exact: true }).click()
    await page.getByRole('option', { name, exact: true }).click()
  }
  await page.getByLabel('Organization Scope').click()
  await page.getByRole('option', { name: 'Team', exact: true }).click()
  await page.getByRole('button', { name: 'Create account and setup link' }).click()
  await expect(page.getByText('Account created. Share this link with the user.')).toBeVisible()
  const deletionStatus = await page.evaluate(async id => (await fetch(`/api/v1/organization/${id}`, { method: 'DELETE', credentials: 'include' })).status, ids.team)
  expect(deletionStatus).toBe(409)
})
