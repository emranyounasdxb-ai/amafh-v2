import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { signIn } from './helpers/auth'

async function grantUserActions(page: Page) {
  await page.evaluate(() => localStorage.setItem('amafh-v2.mock-permissions.v1', JSON.stringify({ version: 1, permissions: ['view', 'create', 'edit'].map(action => ({ id: `users-${action}`, domain: 'Users', action, description: 'Browser test action', enabled: true, userTypeIds: ['sample-type-1'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })) })))
}
async function selectActingUser(page: Page) {
  await page.getByRole('combobox', { name: 'Acting user (local permission preview)' }).click()
  await page.getByRole('option', { name: 'Aisha Rahman · User Type A' }).click()
}

async function choose(page: Page, field: string, option: string) {
  await page.getByRole('combobox', { name: field, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
}

for (const width of [1440, 1024, 390]) {
  test(`users create, detail and edit flow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/administration/users')
    await expect(page.getByRole('button', { name: 'Create User', exact: true })).toHaveCount(0)
    await grantUserActions(page)
    await page.reload()
    await selectActingUser(page)
    await expect(page.getByRole('table', { name: 'Users' })).toBeVisible()
    await noPageOverflow(page)

    const search = page.getByRole('searchbox', { name: 'Search' })
    await search.fill('Aisha')
    await expect(page.getByRole('table', { name: 'Users' }).getByText('Aisha Rahman', { exact: true })).toBeVisible()
    await choose(page, 'Status filter', 'Inactive')
    await expect(page.getByText('No results')).toBeVisible()
    await search.fill('')
    await expect(page.getByText('Omar Khan')).toBeVisible()
    await choose(page, 'Status filter', 'All statuses')
    await choose(page, 'User Type filter', 'User Type B')
    await expect(page.getByText('Omar Khan')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Users' }).getByText('Aisha Rahman', { exact: true })).toHaveCount(0)
    await choose(page, 'User Type filter', 'All user types')

    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(page).toHaveURL(/\/administration\/users\/new$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Create User' })).toBeVisible()
    await noPageOverflow(page)
    await page.locator('form.amafh-users-form').getByRole('button', { name: 'Create User' }).click()
    await expect(page.getByText('Full name is required.')).toBeVisible()
    await expect(page.getByText('Select a user type.')).toBeVisible()

    await page.getByRole('textbox', { name: 'Full name' }).fill('Nadia Example')
    await page.getByRole('textbox', { name: 'Email' }).fill('nadia@example.test')
    await choose(page, 'User Type', 'User Type A')
    await choose(page, 'Reporting Manager', 'Aisha Rahman')
    await choose(page, 'Organization', 'Organization A')
    await choose(page, 'Organization Scope', 'Team')
    await choose(page, 'Office / Branch', 'Head Office')
    await choose(page, 'Department', 'Department A')
    await choose(page, 'Team', 'Team A')
    await page.locator('form.amafh-users-form').getByRole('button', { name: 'Create User' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'User detail' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nadia Example' })).toBeVisible()
    await expect(page.getByText('Aisha Rahman', { exact: true })).toBeVisible()
    await noPageOverflow(page)

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Nadia Example' })).toBeVisible()
    await page.getByRole('button', { name: 'Edit User' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit User' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Full name' }).fill('Nadia Updated')
    await choose(page, 'Status', 'Inactive')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Nadia Updated' })).toBeVisible()
    await expect(page.getByText('Inactive').first()).toBeVisible()
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Users' }).click()
    await expect(page.getByRole('table', { name: 'Users' })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search' }).fill('Nadia Updated')
    await expect(page.getByText('Nadia Updated')).toBeVisible()
    await noPageOverflow(page)
  })
}

test('users direct list requires view permission and handles invalid local data', async ({ page }) => {
  await signIn(page)
  await page.goto('/administration/users')
  await expect(page.getByText('Permission required')).toBeVisible()
  await page.evaluate(() => localStorage.setItem('amafh-v2.mock-users.v1', '{broken'))
  await page.reload()
  await expect(page.getByText('Could not load permissions')).toBeVisible()
  await page.evaluate(() => localStorage.removeItem('amafh-v2.mock-users.v1'))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Permission required')).toBeVisible()
})

test('nested user routes stay behind the local login', async ({ page }) => {
  await page.goto('/administration/users/new')
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fadministration%2Fusers%2Fnew$/)
  await page.getByRole('textbox', { name: 'Email' }).fill('demo@example.test')
  await page.getByLabel('Password').fill('preview')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/administration\/users\/new$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Create User' })).toBeVisible()
  await expect(page.getByText('Permission required')).toBeVisible()
})
