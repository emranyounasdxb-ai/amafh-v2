import { expect, test } from '@playwright/test'

const owner = process.env.PLAYWRIGHT_PROFILE_OWNER
const manager = process.env.PLAYWRIGHT_PROFILE_MANAGER
const ownerId = process.env.PLAYWRIGHT_PROFILE_OWNER_ID
test.skip(!owner || !manager || !ownerId, 'Requires isolated profile media fixture')

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8zwACTGCSAQANHQEDgslx/wAAAABJRU5ErkJggg==', 'base64')

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByLabel('Password').fill('profile media password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
}

for (const width of [1440, 1024, 390]) test(`own and delegated profile images at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await signIn(page, owner!)
  await page.goto('/profile')
  await expect(page.getByRole('heading', { level: 1, name: 'Profile images' })).toBeVisible()
  await page.getByLabel('Upload avatar').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('img', { name: 'Profile Owner avatar' })).toBeVisible()
  await page.getByLabel('Upload banner').setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('img', { name: 'Profile Owner banner' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove banner' }).click()
  await expect(page.getByText('No banner uploaded.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)

  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await signIn(page, manager!)
  await page.goto(`/profile/${ownerId}`)
  await expect(page.getByLabel('Upload avatar')).toBeVisible()
  await page.getByRole('button', { name: 'Remove avatar' }).click()
  await expect(page.getByText('No avatar uploaded.')).toBeVisible()
})
