import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AccountMenu } from './account-menu'

test('opens an accessible account menu with password navigation and logout', async () => {
  const navigate = vi.fn()
  const logout = vi.fn(async () => {})
  render(<AccountMenu user={{ id: 'user-1', name: 'Case Owner', email: 'owner@example.test' }} onNavigate={navigate} onLogout={logout} />)
  expect(screen.queryByRole('menuitem', { name: 'Logout' })).toBeNull()
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu for Case Owner' }), { button: 0, ctrlKey: false })
  expect(await screen.findByText('owner@example.test')).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: 'Change Password', hidden: true })).toBeTruthy()
  const item = await screen.findByRole('menuitem', { name: 'Logout', hidden: true })
  fireEvent.click(item)
  expect(logout).toHaveBeenCalledOnce()
  expect(navigate).not.toHaveBeenCalled()
})
