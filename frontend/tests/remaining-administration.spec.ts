import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers/auth'

async function choose(page: Page, field: string, option: string) { await page.getByRole('combobox', { name: field, exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click() }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false) }
const managed = [
  { slug: 'banks-products', label: 'Banks & Products', kind: 'banks', singular: 'Bank', seed: 'Sample Bank' },
  { slug: 'policies-rules', label: 'Policies & Rules', kind: 'policies', singular: 'Policy', seed: 'Sample Policy' },
  { slug: 'workflows', label: 'Workflows', kind: 'definitions', singular: 'Workflow', seed: 'Sample Workflow', extra: 'Stages' },
  { slug: 'security', label: 'Security', kind: 'controls', singular: 'Security control', seed: 'Sample Control' },
  { slug: 'system-settings', label: 'System Settings', kind: 'settings', singular: 'Setting', seed: 'Sample Setting', extra: 'Value' },
] as const

for (const module of managed) for (const width of [1440, 1024, 390]) {
  test(`${module.label} local CRUD and responsive behavior at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page)
    await page.goto(`/administration/${module.slug}`)
    const table = page.getByRole('table', { name: module.label })
    await expect(table).toBeVisible()
    await noOverflow(page)
    await page.getByRole('searchbox', { name: 'Search' }).fill('not present')
    await expect(page.getByText('No results')).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search' }).fill('')
    await page.getByRole('combobox', { name: 'Status' }).selectOption('inactive')
    await expect(page.getByText('No results')).toBeVisible()
    await page.getByRole('combobox', { name: 'Status' }).selectOption('all')
    await page.getByRole('button', { name: `Create ${module.singular}` }).click()
    await expect(page.getByRole('heading', { level: 1, name: `Create ${module.singular}` })).toBeVisible()
    await noOverflow(page)
    await page.locator('form.amafh-managed-form').getByRole('button', { name: `Create ${module.singular}` }).click()
    await expect(page.getByText('Name is required.')).toBeVisible()
    const nameField = module.slug === 'system-settings' ? 'Key' : 'Name'
    await page.getByRole('textbox', { name: nameField }).fill(module.seed)
    await page.getByRole('textbox', { name: 'Description' }).fill('Local sample configuration.')
    if ('extra' in module && module.extra) await page.getByRole('textbox', { name: module.extra }).fill('Local value')
    await page.locator('form.amafh-managed-form').getByRole('button', { name: `Create ${module.singular}` }).click()
    await expect(page.getByText('A record with this name already exists under this parent.')).toBeVisible()
    await page.getByRole('textbox', { name: nameField }).fill(`${module.singular} Test`)
    await page.locator('form.amafh-managed-form').getByRole('button', { name: `Create ${module.singular}` }).click()
    await expect(page.getByRole('heading', { level: 1, name: `${module.singular} detail` })).toBeVisible()
    await expect(page.getByRole('heading', { name: `${module.singular} Test`, exact: true })).toBeVisible()
    await noOverflow(page)
    await page.reload()
    await expect(page.getByRole('heading', { name: `${module.singular} Test`, exact: true })).toBeVisible()
    await page.getByRole('button', { name: `Edit ${module.singular}` }).click()
    await page.getByRole('textbox', { name: nameField }).fill(`${module.singular} Revised`)
    await choose(page, 'Status', 'Inactive')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: `${module.singular} Revised`, exact: true })).toBeVisible()
    await page.getByRole('button', { name: `Delete ${module.singular}` }).click()
    const dialog = page.getByRole('dialog', { name: `Delete ${module.singular}` })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: `Delete ${module.singular}` }).click()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/administration/${module.slug}/${module.kind}$`))
    await page.reload()
    await page.getByRole('searchbox', { name: 'Search' }).fill(`${module.singular} Revised`)
    await expect(page.getByText('No results')).toBeVisible()
    await noOverflow(page)
  })
}

for (const module of managed.slice(0, 2)) {
  test(`${module.label} parent dependencies and child relationships`, async ({ page }) => {
    await signIn(page)
    await page.goto(`/administration/${module.slug}/${module.kind}`)
    const table = page.getByRole('table', { name: module.kind === 'banks' ? 'Banks' : 'Policies' })
    await table.getByRole('row', { name: new RegExp(module.seed) }).getByRole('button', { name: 'View' }).click()
    await page.getByRole('button', { name: `Delete ${module.singular}` }).click()
    const dialog = page.getByRole('dialog', { name: `Delete ${module.singular}` })
    await expect(dialog).toContainText('1 related record depends on it')
    await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    const child = module.kind === 'banks' ? { kind: 'products', singular: 'Product', parent: 'Bank' } : { kind: 'rules', singular: 'Rule', parent: 'Policy' }
    await page.goto(`/administration/${module.slug}/${child.kind}/new`)
    await page.getByRole('textbox', { name: 'Name' }).fill(`New ${child.singular}`)
    await page.getByRole('textbox', { name: 'Description' }).fill('Local child record.')
    await choose(page, child.parent, module.seed)
    await page.getByRole('button', { name: `Create ${child.singular}` }).click()
    await expect(page.getByRole('heading', { name: `New ${child.singular}`, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: module.seed })).toBeVisible()
  })
}

for (const width of [1440, 1024, 390]) {
  test(`Approval Centre local request and decision at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await signIn(page); await page.goto('/administration/approval-centre')
    await expect(page.getByRole('table', { name: 'Approval Centre' })).toBeVisible(); await noOverflow(page)
    await page.getByRole('searchbox', { name: 'Search' }).fill('not present'); await expect(page.getByText('No results')).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search' }).fill('')
    await page.getByRole('button', { name: 'Create Request' }).click()
    await page.getByRole('button', { name: 'Create Request' }).last().click()
    await expect(page.getByText('Title is required.')).toBeVisible()
    await page.getByRole('textbox', { name: 'Title' }).fill('Local Request Test')
    await page.getByRole('textbox', { name: 'Description' }).fill('Local approval example.')
    await page.locator('form.amafh-managed-form').getByRole('button', { name: 'Create Request' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Request detail' })).toBeVisible()
    await noOverflow(page)
    await page.getByRole('button', { name: 'Approve locally' }).click()
    await expect(page.getByText('Approved', { exact: true })).toBeVisible()
    await page.reload(); await expect(page.getByText('Approved', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Edit Request' }).click()
    await page.getByRole('textbox', { name: 'Title' }).fill('Revised Request')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Revised Request', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Delete Request' }).click()
    await page.getByRole('dialog', { name: 'Delete Request' }).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL(/\/administration\/approval-centre$/)
    await page.reload(); await page.getByRole('searchbox', { name: 'Search' }).fill('Revised Request'); await expect(page.getByText('No results')).toBeVisible(); await noOverflow(page)
  })

  test(`Audit Log read-only sample at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await signIn(page); await page.goto('/administration/audit-log')
    const table = page.getByRole('table', { name: 'Audit Log' }); await expect(table).toBeVisible(); await noOverflow(page)
    await expect(page.getByText('Read-only sample entries')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Create|^Edit|^Delete/ })).toHaveCount(0)
    await page.getByRole('searchbox', { name: 'Search' }).fill('not present'); await expect(page.getByText('No results')).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search' }).fill('')
    await table.getByRole('row', { name: /Sample event/ }).getByRole('button', { name: 'View' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Audit detail' })).toBeVisible()
    await expect(page.getByText('Illustrative entry only. This is not an application audit trail.')).toBeVisible()
    await noOverflow(page)
  })
}

for (const module of [...managed.map(item => ({ slug: item.slug, shape: 'records' })), { slug: 'approval-centre', shape: 'requests' }, { slug: 'audit-log', shape: 'entries' }]) {
  test(`${module.slug} empty and recoverable error states`, async ({ page }) => {
    await signIn(page); await page.goto(`/administration/${module.slug}`)
    const key = `amafh-v2.mock-${module.slug}.v1`
    await page.evaluate(({ key, shape }) => localStorage.setItem(key, JSON.stringify({ version: 1, [shape]: [] })), { key, shape: module.shape })
    await page.reload(); await expect(page.getByText('Nothing here yet')).toBeVisible()
    await page.evaluate(key => localStorage.setItem(key, '{broken'), key)
    await page.reload(); await expect(page.getByText('Could not load records')).toBeVisible()
    await page.evaluate(({ key, shape }) => localStorage.setItem(key, JSON.stringify({ version: 1, [shape]: [] })), { key, shape: module.shape })
    await page.getByRole('button', { name: 'Try again' }).click(); await expect(page.getByText('Nothing here yet')).toBeVisible()
  })
}
