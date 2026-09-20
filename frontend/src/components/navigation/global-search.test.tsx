import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { allowed, GlobalSearch } from './global-search'

vi.mock('../../operations/permissions', () => ({ usePermissionPreview: () => ({ loading: false, error: '', can: (domain: string, action: string) => domain === 'Customers' && action === 'view', reload: vi.fn() }) }))

test('only admits navigation destinations with their relevant read grants', () => {
  const can = (domain: string, action: string) => domain === 'Customers' && action === 'view'
  expect(allowed('dashboard', can)).toBe(true)
  expect(allowed('profile', can)).toBe(true)
  expect(allowed('customers', can)).toBe(true)
  expect(allowed('cases', can)).toBe(false)
  expect(allowed('administration', can)).toBe(false)
  expect(allowed('finance', can)).toBe(false)
  expect(allowed('reports', can)).toBe(false)
  expect(allowed('list', can)).toBe(false)
})

test('searches accessible routes with keyboard selection and hides unauthorized routes', () => {
  const navigate = vi.fn()
  render(<GlobalSearch onNavigate={navigate} />)
  const input = screen.getByRole('combobox', { name: 'Search destinations' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'Cust' } })
  expect(screen.getByRole('option', { name: 'Customers' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Cases' })).toBeNull()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(navigate).toHaveBeenCalledWith('/customers')
})
