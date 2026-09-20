import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { signIn } from './helpers/auth'

async function choose(page: Page, field: string, option: string) {
  await page.getByRole('combobox', { name: field, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
}

for (const width of [1440, 1024, 390]) {
  test(`User Types create, edit, detail and delete at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/administration/user-types')
    const table = page.getByRole('table', { name: 'User Types' })
    await expect(table).toBeVisible()
    await expect(table.getByRole('row', { name: /User Type A/ })).toContainText('2')
    await expect(table.getByRole('row', { name: /User Type B/ })).toContainText('1')
    await expectNoOverflow(page)

    const search = page.getByRole('searchbox', { name: 'Search' })
    await search.fill('User Type B')
    await expect(table.getByRole('row', { name: /User Type B/ })).toBeVisible()
    await expect(table.getByRole('row', { name: /User Type A/ })).toHaveCount(0)
    await search.fill('not present')
    await expect(page.getByText('No results')).toBeVisible()
    await search.fill('')

    await page.getByRole('button', { name: 'Create User Type' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Create User Type' })).toBeVisible()
    await expectNoOverflow(page)
    await page.locator('form.amafh-user-types-form').getByRole('button', { name: 'Create User Type' }).click()
    await expect(page.getByText('Name is required.')).toBeVisible()
    await expect(page.getByText('Description is required.')).toBeVisible()
    await page.getByRole('textbox', { name: 'Name' }).fill(' user   type a ')
    await page.getByRole('textbox', { name: 'Description' }).fill('Local description.')
    await page.locator('form.amafh-user-types-form').getByRole('button', { name: 'Create User Type' }).click()
    await expect(page.getByText('A user type with this name already exists.')).toBeVisible()
    await page.getByRole('textbox', { name: 'Name' }).fill('User Type D')
    await page.locator('form.amafh-user-types-form').getByRole('button', { name: 'Create User Type' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'User Type detail' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'User Type D', exact: true })).toBeVisible()
    await expect(page.getByText('Local description.')).toBeVisible()
    await expect(page.getByText('0', { exact: true })).toBeVisible()
    await expectNoOverflow(page)

    await page.reload()
    await expect(page.getByRole('heading', { name: 'User Type D', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Edit User Type' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit User Type' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Name' }).fill('User Type D Revised')
    await page.getByRole('textbox', { name: 'Description' }).fill('Updated local description.')
    await choose(page, 'Status', 'Inactive')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'User Type D Revised' })).toBeVisible()
    await expect(page.getByText('Updated local description.')).toBeVisible()
    await expectNoOverflow(page)

    await page.getByRole('button', { name: 'Delete User Type' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete User Type' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Delete User Type D Revised?')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole('button', { name: 'Delete User Type' }).click()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL(/\/administration\/user-types$/)
    await expect(table).toBeVisible()
    await search.fill('User Type D Revised')
    await expect(page.getByText('No results')).toBeVisible()
    await page.reload()
    await expect(table.getByRole('row', { name: /User Type D Revised/ })).toHaveCount(0)
    await expectNoOverflow(page)
  })
}

for (const width of [1440, 390]) {
  test(`assigned User Type deletion is blocked at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/administration/user-types/sample-type-1')
    await expect(page.getByRole('heading', { name: 'User Type A' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete User Type' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete User Type' })
    await expect(dialog).toContainText('Cannot delete User Type A: 2 users are assigned.')
    await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Edit User Type' }).click()
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeDisabled()
    await page.getByRole('textbox', { name: 'Description' }).fill('Updated description for assigned type.')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Updated description for assigned type.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'User Type A' })).toBeVisible()
    await expectNoOverflow(page)
  })
}

test('User Types empty and recoverable error states', async ({ page }) => {
  await signIn(page)
  await page.goto('/administration/user-types')
  await page.evaluate(() => localStorage.setItem('amafh-v2.mock-user-types.v1', JSON.stringify({ version: 1, userTypes: [] })))
  await page.reload()
  await expect(page.getByText('Nothing here yet')).toBeVisible()
  await page.evaluate(() => localStorage.setItem('amafh-v2.mock-user-types.v1', '{broken'))
  await page.reload()
  await expect(page.getByText('Could not load records')).toBeVisible()
  await expect(page.getByText('Local user type data could not be read.')).toBeVisible()
  await page.evaluate(() => localStorage.setItem('amafh-v2.mock-user-types.v1', JSON.stringify({ version: 1, userTypes: [] })))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Nothing here yet')).toBeVisible()
})

test('nested User Type routes remain protected', async ({ page }) => {
  await page.goto('/administration/user-types/new')
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fadministration%2Fuser-types%2Fnew$/)
  await page.getByRole('textbox', { name: 'Email' }).fill('preview@example.test')
  await page.getByLabel('Password').fill('preview')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/administration\/user-types\/new$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Create User Type' })).toBeVisible()
})
