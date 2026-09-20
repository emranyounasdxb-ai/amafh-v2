import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ApplicationShell } from './application-shell'

const destinations = [
  ['dashboard', 'Dashboard', 'layout-dashboard'],
  ['customers', 'Customers', 'users'],
  ['cases', 'Cases', 'briefcase-business'],
  ['administration', 'Administration', 'settings'],
  ['notifications', 'Notifications', 'bell'],
  ['tasks', 'Tasks', 'list-checks'],
  ['finance', 'Finance', 'badge-dollar-sign'],
  ['reports', 'Reports', 'chart-no-axes-combined'],
  ['profile', 'Profile', 'circle-user-round'],
] as const

test('renders named Lucide destinations in expanded and collapsed navigation', () => {
  const { container } = render(<ApplicationShell items={destinations.map(([id, label]) => ({ id, label }))} activeId="cases"><div>Content</div></ApplicationShell>)
  const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
  expect(navigation.querySelectorAll('img')).toHaveLength(0)
  for (const [, label, iconName] of destinations) {
    const button = screen.getByRole('button', { name: label })
    const icon = button.querySelector(`svg.lucide-${iconName}`)
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.getAttribute('width')).toBe('20')
    expect(icon?.getAttribute('stroke-width')).toBe('1.75')
    expect(button.getAttribute('data-tooltip')).toBe(label)
  }
  expect(screen.getByRole('button', { name: 'Cases' }).getAttribute('aria-current')).toBe('page')
  const casesButton = screen.getByRole('button', { name: 'Cases' })
  fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))
  expect(container.querySelector('.amafh-shell--desktop-collapsed')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Cases' })).toBe(casesButton)
  expect(casesButton.querySelector('svg.lucide-briefcase-business')).not.toBeNull()
  fireEvent.click(container.querySelector<HTMLButtonElement>('.amafh-shell__desktop-menu')!)
  expect(container.querySelector('.amafh-shell--desktop-collapsed')).toBeNull()
  expect(screen.getByRole('button', { name: 'Cases' })).toBe(casesButton)
})
