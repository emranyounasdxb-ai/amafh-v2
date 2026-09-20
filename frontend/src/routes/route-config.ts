import { defaultAdministrationPath } from '../administration/admin-routes'

export type ApplicationRoute = 'dashboard' | 'customers' | 'cases' | 'administration' | 'profile' | 'imports' | 'notifications' | 'tasks' | 'finance' | 'reports'

export const routeItems: { id: ApplicationRoute; label: string; path: string }[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/templates/dashboard' },
  { id: 'customers', label: 'Customers', path: '/customers' },
  { id: 'cases', label: 'Cases', path: '/cases' },
  { id: 'administration', label: 'Administration', path: defaultAdministrationPath },
  { id: 'profile', label: 'Profile', path: '/profile' },
  { id: 'imports', label: 'CSV Imports', path: '/imports/attendance' },
  { id: 'notifications', label: 'Notifications', path: '/notifications' },
  { id: 'tasks', label: 'Tasks', path: '/tasks' },
  { id: 'finance', label: 'Finance', path: '/finance' },
  { id: 'reports', label: 'Reports', path: '/reports' },
]

export const routePath = (id: ApplicationRoute) => routeItems.find(item => item.id === id)!.path
