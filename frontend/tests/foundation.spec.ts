import { expect, test } from '@playwright/test'

test('frontend reaches the versioned API', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  const response = await page.request.get('/api/v1/health')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({ status: 'ok' })
})
