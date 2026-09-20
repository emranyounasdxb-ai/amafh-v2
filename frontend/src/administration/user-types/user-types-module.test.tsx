import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UserTypesModule } from './user-types-module'
import type { UserTypesRepository } from './mock-user-types-repository'
import type { UsersRepository } from '../users/mock-users-repository'
import type { UserTypeRecord } from './user-types-model'
import type { UserRecord } from '../users/users-model'

const types: UserTypeRecord[] = [
  { id: 'assigned', name: 'User Type A', description: 'Assigned type', status: 'active', createdAt: '2026-09-19T00:00:00.000Z', updatedAt: '2026-09-19T00:00:00.000Z' },
  { id: 'unused', name: 'User Type C', description: 'Unused type', status: 'inactive', createdAt: '2026-09-19T00:00:00.000Z', updatedAt: '2026-09-19T00:00:00.000Z' },
]
const users: UserRecord[] = [{ id: 'one', fullName: 'Sample User', email: 'sample@example.test', status: 'active', userType: 'User Type A', reportingManagerId: '', organization: 'Organization A', organizationScope: 'organization', officeBranch: '', department: '', team: '' }]
const usersRepository = { list: vi.fn().mockResolvedValue(users), create: vi.fn(), update: vi.fn() } as UsersRepository
const repository = (overrides: Partial<UserTypesRepository> = {}): UserTypesRepository => ({ list: vi.fn().mockResolvedValue(types), create: vi.fn(), update: vi.fn(), remove: vi.fn().mockResolvedValue(undefined), ...overrides })

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
})
afterEach(() => { cleanup(); delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close })

test('shows loading, then empty results and a recoverable error', async () => {
  let resolve!: (items: UserTypeRecord[]) => void
  const pending = repository({ list: () => new Promise<UserTypeRecord[]>(result => { resolve = result }) })
  const { unmount } = render(<UserTypesModule route={{ mode: 'list' }} onNavigate={vi.fn()} repository={pending} usersRepository={usersRepository} />)
  expect(screen.getByText('Loading records')).toBeTruthy()
  resolve([])
  expect(await screen.findByText('Nothing here yet')).toBeTruthy()
  unmount()
  render(<UserTypesModule route={{ mode: 'list' }} onNavigate={vi.fn()} repository={repository({ list: vi.fn().mockRejectedValue(new Error('Local data unavailable')) })} usersRepository={usersRepository} />)
  expect(await screen.findByText('Could not load records')).toBeTruthy()
  expect(screen.getByText('Local data unavailable')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})

test('explains and blocks deletion for an assigned type', async () => {
  const repo = repository()
  render(<UserTypesModule route={{ mode: 'detail', id: 'assigned' }} onNavigate={vi.fn()} repository={repo} usersRepository={usersRepository} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Delete User Type' }))
  expect(screen.getByText('Cannot delete User Type A: 1 user is assigned.')).toBeTruthy()
  expect((screen.getByRole('button', { name: /^Delete$/ }) as HTMLButtonElement).disabled).toBe(true)
  expect(repo.remove).not.toHaveBeenCalled()
})

test('confirms deletion of an unassigned type', async () => {
  const repo = repository()
  const navigate = vi.fn()
  render(<UserTypesModule route={{ mode: 'detail', id: 'unused' }} onNavigate={navigate} repository={repo} usersRepository={usersRepository} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Delete User Type' }))
  expect(repo.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }))
  await waitFor(() => expect(repo.remove).toHaveBeenCalledWith('unused'))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/administration/user-types'))
})
