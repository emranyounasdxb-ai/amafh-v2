import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CustomerPage } from './customer-page'
import { CreateApplicationPage } from './create-application-page'
import type { CustomerRepository, ApplicationRepository } from './mock-customer-repository'
import type { CustomerRecord } from './customer-model'

beforeEach(() => {
  sessionStorage.setItem('amafh-v2.case-preview-actor', 'sample-aisha')
  localStorage.setItem('amafh-v2.mock-permissions.v1', JSON.stringify({ version: 1, permissions: [{ id: 'customers-view', domain: 'Customers', action: 'view', description: 'View records.', enabled: true, userTypeIds: ['sample-type-1'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }))
})
afterEach(cleanup)
const apps = { list: vi.fn().mockResolvedValue([]), createWithCustomer: vi.fn() } as ApplicationRepository
const repo = (list: CustomerRepository['list']): CustomerRepository => ({ list, update: vi.fn(), remove: vi.fn() })

test('customer list shows loading, empty and recoverable error', async () => {
  let resolve!: (items: CustomerRecord[]) => void
  const { unmount } = render(<CustomerPage route={{ mode: 'list' }} onNavigate={vi.fn()} customersRepository={repo(() => new Promise(result => { resolve = result }))} applicationsRepository={apps} />)
  expect(await screen.findByText('Loading records')).toBeTruthy()
  resolve([])
  expect(await screen.findByText('Nothing here yet')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Create Customer' })).toBeNull()
  unmount()
  render(<CustomerPage route={{ mode: 'list' }} onNavigate={vi.fn()} customersRepository={repo(vi.fn().mockRejectedValue(new Error('Unavailable')))} applicationsRepository={apps} />)
  expect(await screen.findByText('Could not load records')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})

test('Create Application handles a recoverable customer loading error', async () => {
  render(<CreateApplicationPage onNavigate={vi.fn()} customersRepository={repo(vi.fn().mockRejectedValue(new Error('Unavailable')))} applicationsRepository={apps} />)
  expect(await screen.findByText('Could not load customers')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})
