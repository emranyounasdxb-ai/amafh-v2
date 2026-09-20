import { expect, test } from '@playwright/test'
import { signIn } from './helpers/auth'

const modules = ['Dashboard', 'Customers', 'Cases', 'Administration', 'Notifications', 'Tasks', 'Finance', 'Reports']
const references = ['List', 'Detail', 'Form', 'Workspace']

for (const width of [1440, 1024, 390]) {
  test(`production navigation excludes reference templates at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/templates/dashboard')
    if (width === 390) await page.getByRole('button', { name: 'Open navigation' }).click()
    const primary = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(primary.getByRole('button')).toHaveCount(modules.length)
    for (const label of modules) {
      await expect(primary.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
    for (const label of [...references, 'CSV Imports', 'Profile']) {
      await expect(primary.getByRole('button', { name: label, exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('button', { name: /Account menu for/ })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).not.toContainText('Templates')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false)
  })
}

test('obsolete public template aliases return to Dashboard', async ({ page }) => {
  await signIn(page)
  for (const name of ['list', 'detail', 'form', 'workspace']) {
    await page.goto(`/templates/${name}`)
    await expect(page).toHaveURL(/\/templates\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  }
})
