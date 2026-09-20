import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { FileOperation } from './file-operation'

afterEach(cleanup)

test('CSV validation reconciles counts and exposes row corrections', () => {
  render(<FileOperation kind="import" title="CSV validation" stage="preview" validation={{ total: 4, valid: 2, invalid: 1, duplicate: 1 }} validationIssues={[{ row: 3, issue: 'Invalid format', detail: 'Date is invalid.', resolution: 'Use the template format.' }]} />)
  expect(screen.getByText('Validation result')).toBeTruthy()
  expect(screen.getByRole('table').textContent).toContain('Date is invalid.')
  expect(screen.queryByText('Validation totals do not match')).toBeNull()
})

test('CSV import action stays disabled when validation counts conflict', () => {
  render(<FileOperation kind="import" title="CSV validation" stage="preview" validation={{ total: 4, valid: 2, invalid: 1, duplicate: 0 }} onAction={() => {}} actionLabel="Import" />)
  expect(screen.getByText('Validation totals do not match')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(true)
})
