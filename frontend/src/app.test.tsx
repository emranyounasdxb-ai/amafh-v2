import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { App } from './app'

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/templates/dashboard')
})

test('protects the application shell until a local session exists', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  expect(screen.getByRole('img', { name: 'AMAFH' }).getAttribute('src')).toBe('/brand/amafh-core-full-logo-exact.svg')
  expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).toBeNull()
  await waitFor(() => expect(window.location.pathname).toBe('/login'))
})
