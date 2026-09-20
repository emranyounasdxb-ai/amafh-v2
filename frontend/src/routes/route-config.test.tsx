import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { DashboardPage } from './dashboard-page'
import { routeItems } from './route-config'

test('production destinations exclude reference templates and keep profile outside primary navigation', () => {
  expect(routeItems.filter(item => !['profile', 'imports'].includes(item.id)).map(item => item.label)).toEqual([
    'Dashboard', 'Customers', 'Cases', 'Administration', 'Notifications', 'Tasks', 'Finance', 'Reports',
  ])
  expect(routeItems.some(item => ['/templates/list', '/templates/detail', '/templates/form', '/templates/workspace'].includes(item.path))).toBe(false)
})

test('Dashboard breadcrumb has no template destination', () => {
  render(<DashboardPage />)
  expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toBe('Dashboard')
  expect(screen.queryByRole('link', { name: 'Templates' })).toBeNull()
})
