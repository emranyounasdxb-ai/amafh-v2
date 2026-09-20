import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PermissionsModule } from './permissions-module'
import type { PermissionsRepository } from './mock-permissions-repository'
import type { UserTypesRepository } from '../user-types/mock-user-types-repository'
import type { PermissionRecord } from './permissions-model'

const typesRepository = { list: vi.fn().mockResolvedValue([]) } as unknown as UserTypesRepository
const repository = (list: PermissionsRepository['list']): PermissionsRepository => ({ list, create: vi.fn(), update: vi.fn() })
afterEach(cleanup)

test('shows loading, empty and recoverable error states', async () => {
  let resolve!: (items: PermissionRecord[]) => void
  const pending = repository(() => new Promise(result => { resolve = result }))
  const { unmount } = render(<PermissionsModule route={{ mode: 'list' }} onNavigate={vi.fn()} repository={pending} typesRepository={typesRepository} />)
  expect(screen.getByText('Loading records')).toBeTruthy()
  resolve([])
  expect(await screen.findByText('Nothing here yet')).toBeTruthy()
  unmount()
  render(<PermissionsModule route={{ mode: 'list' }} onNavigate={vi.fn()} repository={repository(vi.fn().mockRejectedValue(new Error('Local data unavailable')))} typesRepository={typesRepository} />)
  expect(await screen.findByText('Could not load records')).toBeTruthy()
  expect(screen.getByText('Local data unavailable')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})
