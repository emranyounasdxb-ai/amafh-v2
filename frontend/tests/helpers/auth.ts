import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill('demo.user@example.test')
  await page.getByLabel('Password').fill('local-preview')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
}
