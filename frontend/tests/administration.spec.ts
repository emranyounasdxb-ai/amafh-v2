import { expect, test } from '@playwright/test'
import { signIn } from './helpers/auth'

const areas = [
  ['users', 'Users'],
  ['user-types', 'User Types'],
  ['permissions', 'Permissions'],
  ['organization', 'Organization'],
  ['banks-products', 'Banks & Products'],
  ['policies-rules', 'Policies & Rules'],
  ['workflows', 'Workflows'],
  ['approval-centre', 'Approval Centre'],
  ['security', 'Security'],
  ['system-settings', 'System Settings'],
  ['audit-log', 'Audit Log'],
] as const

for (const width of [1440, 1024, 390]) {
  test(`administration routes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    for (const [slug, label] of areas) {
      await page.goto(`/administration/${slug}`)
      await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible()
      if (slug === 'users') {
        await expect(page.getByText('Permission required')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Create User', exact: true })).toHaveCount(0)
      } else if (slug === 'user-types' || slug === 'permissions') {
        await expect(page.getByRole('table', { name: label })).toBeVisible()
        await expect(page.getByRole('button', { name: slug === 'user-types' ? 'Create User Type' : 'Create Permission' })).toBeVisible()
      } else if (slug === 'organization') {
        await expect(page.getByRole('heading', { name: 'Organization hierarchy' })).toBeVisible()
        await expect(page.getByRole('navigation', { name: 'Organization views' }).getByRole('button')).toHaveCount(6)
      } else if (slug === 'banks-products' || slug === 'policies-rules' || slug === 'workflows' || slug === 'approval-centre' || slug === 'security' || slug === 'system-settings' || slug === 'audit-log') {
        await expect(page.getByRole('table', { name: label })).toBeVisible()
      } else {
        await expect(page.getByLabel(`${label} placeholder`)).toBeVisible()
        await expect(page.getByRole('table')).toHaveCount(0)
      }
      await expect(page.getByRole('navigation', { name: 'Administration navigation' }).getByRole('button')).toHaveCount(12)
      await expect(page.getByRole('navigation', { name: 'Administration navigation' }).getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(page.locator('.amafh-shell__nav-item[aria-label="Administration"]')).toHaveAttribute('aria-current', 'page')
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), `${label} overflows at ${width}px`).toBe(false)
      await expect(page.getByRole('form')).toHaveCount(0)
    }

    if (width === 390) {
      const nav = page.getByRole('navigation', { name: 'Administration navigation' })
      const active = nav.getByRole('button', { name: 'Audit Log' })
      const box = await nav.boundingBox()
      const activeBox = await active.boundingBox()
      expect(box && activeBox && activeBox.x >= box.x - 1 && activeBox.x + activeBox.width <= box.x + box.width + 1).toBe(true)
    }
    await page.getByRole('navigation', { name: 'Administration navigation' }).getByRole('button', { name: 'CSV Imports' }).click()
    await expect(page).toHaveURL(/\/imports\/attendance$/)
    await expect(page.getByRole('heading', { level: 1, name: 'CSV Imports' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })
}

test('shell and administration navigation update URLs and browser history', async ({ page }) => {
  await signIn(page)
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Administration' }).click()
  await expect(page).toHaveURL(/\/administration\/users$/)
  await page.getByRole('navigation', { name: 'Administration navigation' }).getByRole('button', { name: 'Security' }).click()
  await expect(page).toHaveURL(/\/administration\/security$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible()
  await page.goto('/administration')
  await expect(page).toHaveURL(/\/administration\/users$/)
})

test('administration deep link remains protected and returns after sign in', async ({ page }) => {
  await page.goto('/administration/audit-log')
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fadministration%2Faudit-log$/)
  await expect(page.getByRole('navigation', { name: 'Administration navigation' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Email' }).fill('admin@example.test')
  await page.getByLabel('Password').fill('preview')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/administration\/audit-log$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeVisible()
})
