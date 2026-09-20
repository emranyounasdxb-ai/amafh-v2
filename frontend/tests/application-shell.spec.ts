import { expect, test } from '@playwright/test'
import { signIn } from './helpers/auth'

for (const [width, expectedSidebarWidth] of [[1440, 248], [1024, 64]] as const) {
  test(`application shell at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto('/')
    if (process.env.CAPTURE_APP_SHELL) await page.screenshot({ path: `test-results/application-shell-${width}.png`, fullPage: true })
    const sidebar = page.getByLabel('Application navigation')
    await expect(sidebar).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button')).toHaveCount(14)
    await expect(page.getByRole('main')).toBeVisible()
    expect(Math.round((await sidebar.boundingBox())!.width)).toBe(expectedSidebarWidth)
    await page.getByRole('button', { name: width === 1440 ? 'Collapse navigation' : 'Expand navigation' }).click()
    expect(Math.round((await sidebar.boundingBox())!.width)).toBe(width === 1440 ? 64 : 248)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })
}

test('mobile application shell uses the same navigation in a drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await page.goto('/')
  if (process.env.CAPTURE_APP_SHELL) await page.screenshot({ path: 'test-results/application-shell-390.png', fullPage: true })
  await expect(page.getByText('AMAFH', { exact: true })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation' })
  await menu.click()
  const drawer = page.getByRole('dialog', { name: 'Application navigation' })
  await expect(drawer).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close navigation' }).first()).toBeFocused()
  await drawer.getByRole('button', { name: 'Detail' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(page.locator('.amafh-shell__nav-item[aria-label="Detail"]')).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveURL(/\/templates\/detail$/)
  await menu.click()
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(menu).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
})
