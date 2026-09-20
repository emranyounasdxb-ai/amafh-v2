import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AuditModule } from './audit-module'
import { mockAuditRepository, AUDIT_STORAGE_KEY, type AuditRepository } from './mock-audit-repository'

beforeEach(() => localStorage.clear())
afterEach(cleanup)
test('audit sample is read-only and malformed data is reported', async () => {
  expect((await mockAuditRepository.list())[0].event).toBe('Sample event')
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify({ version: 1, entries: [] }))
  expect(await mockAuditRepository.list()).toEqual([])
  localStorage.setItem(AUDIT_STORAGE_KEY, '{broken')
  await expect(mockAuditRepository.list()).rejects.toThrow(/could not be read/)
  expect(Object.keys(mockAuditRepository)).toEqual(['list'])
})
test('shows empty and recoverable error states', async () => {
  const { unmount } = render(<AuditModule route={{ mode: 'list' }} onNavigate={vi.fn()} repository={{ list: vi.fn().mockResolvedValue([]) }} />)
  expect(await screen.findByText('Nothing here yet')).toBeTruthy()
  unmount()
  render(<AuditModule route={{ mode: 'list' }} onNavigate={vi.fn()} repository={{ list: vi.fn().mockRejectedValue(new Error('Unavailable')) } as AuditRepository} />)
  expect(await screen.findByText('Could not load records')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})
