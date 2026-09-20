import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OrganizationModule } from './organization-module'
import type { OrganizationRepository } from './mock-organization-repository'
import type { OrganizationRecord } from './organization-model'

const root: OrganizationRecord = { id: 'root', kind: 'organizations', name: 'Organization A', parentId: '', status: 'active', description: 'Root.', createdAt: '2026-09-19T00:00:00.000Z', updatedAt: '2026-09-19T00:00:00.000Z' }
const child: OrganizationRecord = { ...root, id: 'child', kind: 'offices', name: 'Head Office', parentId: 'root' }
const repo = (list: OrganizationRepository['list']): OrganizationRepository => ({ list, create: vi.fn(), update: vi.fn(), remove: vi.fn().mockResolvedValue(undefined) })
beforeEach(() => { Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } }); Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } }) })
afterEach(() => { cleanup(); delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close })

test('shows loading, empty and recoverable error', async () => {
  let resolve!: (items: OrganizationRecord[]) => void
  const { unmount } = render(<OrganizationModule route={{ mode: 'list', kind: 'teams' }} onNavigate={vi.fn()} repository={repo(() => new Promise(result => { resolve = result }))} />)
  expect(screen.getByText('Loading records')).toBeTruthy()
  resolve([])
  expect(await screen.findByText('Nothing here yet')).toBeTruthy()
  unmount()
  render(<OrganizationModule route={{ mode: 'list', kind: 'teams' }} onNavigate={vi.fn()} repository={repo(vi.fn().mockRejectedValue(new Error('Local unavailable')))} />)
  expect(await screen.findByText('Could not load records')).toBeTruthy()
  expect(screen.getByText('Local unavailable')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})

test('explains blocked parent deletion and confirms leaf deletion', async () => {
  const parentRepo = repo(vi.fn().mockResolvedValue([root, child]))
  const { unmount } = render(<OrganizationModule route={{ mode: 'detail', kind: 'organizations', id: 'root' }} onNavigate={vi.fn()} repository={parentRepo} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Organization' }))
  expect(screen.getByText('Cannot delete Organization A: 1 related record depends on it.')).toBeTruthy()
  expect((screen.getByRole('button', { name: /^Delete$/ }) as HTMLButtonElement).disabled).toBe(true)
  expect(parentRepo.remove).not.toHaveBeenCalled()
  unmount()
  const leafRepo = repo(vi.fn().mockResolvedValue([root, child]))
  const navigate = vi.fn()
  render(<OrganizationModule route={{ mode: 'detail', kind: 'offices', id: 'child' }} onNavigate={navigate} repository={leafRepo} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Office / Branch' }))
  fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }))
  await waitFor(() => expect(leafRepo.remove).toHaveBeenCalledWith('child'))
})
