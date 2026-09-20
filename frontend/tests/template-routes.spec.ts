import { expect, test } from '@playwright/test'
import { signIn } from './helpers/auth'

const routes = [
  { path: '/templates/dashboard', title: 'Dashboard', marker: 'KPI slot 1' },
  { path: '/templates/list', title: 'List', marker: 'Template records' },
  { path: '/templates/detail', title: 'Record detail', marker: 'Record summary' },
  { path: '/templates/form', title: 'Form', marker: 'Form section' },
  { path: '/templates/workspace', title: 'Workspace', marker: 'Primary content' },
] as const

for (const width of [1440, 1024, 390]) {
  test(`template routes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    for (const route of routes) {
      await page.goto(route.path)
      await expect(page.getByRole('main')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: route.title })).toBeVisible()
      await expect(page.getByText(route.marker, { exact: true }).first()).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth, elements: Array.from(document.querySelectorAll('*')).filter(element => element.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map(element => `${element.tagName}.${element.className}`) }))
      expect(overflow.width > overflow.viewport + 1, `${route.path} overflows at ${width}px: ${JSON.stringify(overflow)}`).toBe(false)
    }

    if (width === 390) await page.getByRole('button', { name: 'Open navigation' }).click()
    const primary = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(primary.getByRole('button')).toHaveCount(9)
    for (const label of ['Dashboard', 'Customers', 'Cases', 'Administration', 'Notifications', 'Tasks', 'Finance', 'Reports', 'Profile']) {
      await expect(primary.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
    for (const label of ['List', 'Detail', 'Form', 'Workspace', 'CSV Imports']) {
      await expect(primary.getByRole('button', { name: label, exact: true })).toHaveCount(0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })
}
