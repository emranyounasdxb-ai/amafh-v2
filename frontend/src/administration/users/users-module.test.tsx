import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { UsersModule } from './users-module'
import type { UsersRepository } from './mock-users-repository'
import type { UserRecord } from './users-model'

beforeEach(() => {
  sessionStorage.setItem('amafh-v2.case-preview-actor', 'sample-aisha')
  localStorage.setItem('amafh-v2.mock-permissions.v1', JSON.stringify({ version: 1, permissions: [{ id: 'users-view', domain: 'Users', action: 'view', description: 'View records.', enabled: true, userTypeIds: ['sample-type-1'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }))
})
afterEach(cleanup)

test('shows loading and then an empty state from the repository', async () => {
  let resolve!: (users: UserRecord[]) => void
  const repository: UsersRepository = { list: () => new Promise<UserRecord[]>(result => { resolve = result }), create: vi.fn(), update: vi.fn() }
  render(<UsersModule route={{ mode: 'list' }} onNavigate={vi.fn()} repository={repository} />)
  expect(await screen.findByText('Loading records')).toBeTruthy()
  resolve([])
  expect(await screen.findByText('Nothing here yet')).toBeTruthy()
})

test('shows a recoverable error state when local data cannot load', async () => {
  const repository: UsersRepository = { list: vi.fn().mockRejectedValue(new Error('Local user data could not be read.')), create: vi.fn(), update: vi.fn() }
  render(<UsersModule route={{ mode: 'list' }} onNavigate={vi.fn()} repository={repository} />)
  expect(await screen.findByText('Could not load records')).toBeTruthy()
  expect(screen.getByText('Local user data could not be read.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})
