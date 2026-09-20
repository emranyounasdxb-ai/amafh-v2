import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApprovalModule } from './approval-module'
import { mockApprovalRepository, APPROVAL_STORAGE_KEY, type ApprovalRepository } from './mock-approval-repository'

beforeEach(() => { localStorage.clear(); Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } }); Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } }) })
afterEach(() => { cleanup(); delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close })
test('creates, validates, decides, edits and removes a local request', async () => {
  const draft = { title: 'Local request', description: 'Example only.' }
  const item = await mockApprovalRepository.create(draft)
  await expect(mockApprovalRepository.create({ ...draft, title: ' LOCAL   REQUEST ' })).rejects.toThrow()
  expect((await mockApprovalRepository.decide(item.id, 'approved')).status).toBe('approved')
  expect((await mockApprovalRepository.update(item.id, { ...draft, description: 'Updated.' })).description).toBe('Updated.')
  await mockApprovalRepository.remove(item.id)
  expect((await mockApprovalRepository.list()).some(record => record.id === item.id)).toBe(false)
  localStorage.setItem(APPROVAL_STORAGE_KEY, '{broken')
  await expect(mockApprovalRepository.list()).rejects.toThrow(/could not be read/)
})
test('shows recoverable list error and local decision action', async () => {
  const broken = { list: vi.fn().mockRejectedValue(new Error('Unavailable')) } as unknown as ApprovalRepository
  const { unmount } = render(<ApprovalModule route={{ mode: 'list' }} onNavigate={vi.fn()} repository={broken} />)
  expect(await screen.findByText('Could not load records')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  unmount()
  render(<ApprovalModule route={{ mode: 'detail', id: 'sample-request-1' }} onNavigate={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Approve locally' }))
  await waitFor(() => expect(screen.getByText('Approved')).toBeTruthy())
})
