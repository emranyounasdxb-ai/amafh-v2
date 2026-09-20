import { lazy, Suspense, useEffect, useState } from 'react'
import { ApplicationShell } from './components/navigation/application-shell'
import { Avatar } from './components/ui/avatar'
import { Button } from './components/ui/button'
import { Workspace } from './templates/workspace'
import { DashboardPage } from './routes/dashboard-page'
import { routeItems, routePath, type ApplicationRoute } from './routes/route-config'
import { administrationAreaFromPath, defaultAdministrationPath } from './administration/admin-routes'
import { customerRouteFromPath, isCreateApplicationPath } from './customers/customer-routes'
import { AuthProvider, useAuth } from './auth/auth-context'
import { LoginPage } from './auth/login-page'
import { SetPasswordPage } from './auth/set-password-page'
import { AccountSecurityPage } from './auth/account-security-page'
import { ProvisionUserPage } from './auth/provision-user-page'
import './auth/auth-ui.css'

const ListPage = lazy(() => import('./routes/list-page').then(module => ({ default: module.ListPage })))
const DetailPage = lazy(() => import('./routes/detail-page').then(module => ({ default: module.DetailPage })))
const FormPage = lazy(() => import('./routes/form-page').then(module => ({ default: module.FormPage })))
const WorkspacePage = lazy(() => import('./routes/workspace-page').then(module => ({ default: module.WorkspacePage })))
const AdministrationPage = lazy(() => import('./administration/administration-page').then(module => ({ default: module.AdministrationPage })))
const CustomerPage = lazy(() => import('./customers/customer-page').then(module => ({ default: module.CustomerPage })))
const CreateApplicationPage = lazy(() => import('./customers/create-application-page').then(module => ({ default: module.CreateApplicationPage })))
const CasePage = lazy(() => import('./cases/case-page').then(module => ({ default: module.CasePage })))
const ProfilePage = lazy(() => import('./operations/profile-page').then(module => ({ default: module.ProfilePage })))
const ImportPage = lazy(() => import('./operations/import-page').then(module => ({ default: module.ImportPage })))
const NotificationPage = lazy(() => import('./operations/notification-page').then(module => ({ default: module.NotificationPage })))
const TaskPage = lazy(() => import('./operations/task-page').then(module => ({ default: module.TaskPage })))
const FinancePage = lazy(() => import('./operations/finance-page').then(module => ({ default: module.FinancePage })))
const ReportPage = lazy(() => import('./operations/report-page').then(module => ({ default: module.ReportPage })))
const isCasePath = (path: string) => path === '/cases' || /^\/cases\/[^/]+$/.test(path)
const isOperationPath = (path: string) => path === '/profile' || /^\/profile\/[^/]+$/.test(path) || /^\/imports\/(attendance|case-stage|users)$/.test(path) || path === '/notifications' || path === '/tasks' || /^\/tasks\/[^/]+$/.test(path) || path === '/finance' || path === '/reports'
const isAccountPath = (path: string) => path === '/account/security' || path === '/account/provision-user'

function routeFromPath(path: string): ApplicationRoute {
  if (path.startsWith('/profile')) return 'profile'
  if (path.startsWith('/imports/')) return 'imports'
  if (path === '/notifications') return 'notifications'
  if (path.startsWith('/tasks')) return 'tasks'
  if (path === '/finance') return 'finance'
  if (path === '/reports') return 'reports'
  if (isCasePath(path)) return 'cases'
  if (customerRouteFromPath(path) || isCreateApplicationPath(path)) return 'customers'
  if (path === '/administration' || administrationAreaFromPath(path)) return 'administration'
  return routeItems.find(item => item.path === path)?.id ?? 'dashboard'
}

function protectedDestination(path: string | null): string {
  if (path === '/administration') return defaultAdministrationPath
  return path && (routeItems.some(item => item.path === path) || administrationAreaFromPath(path) || customerRouteFromPath(path) || isCreateApplicationPath(path) || isCasePath(path) || isOperationPath(path) || isAccountPath(path)) ? path : routePath('dashboard')
}

function AppRouter() {
  const { status, user, signOut } = useAuth()
  const [location, setLocation] = useState(() => window.location.pathname + window.location.search)
  const pathname = location.split('?')[0]

  const replaceLocation = (path: string) => {
    window.history.replaceState(null, '', path)
    setLocation(path)
  }

  useEffect(() => {
    const syncRoute = () => setLocation(window.location.pathname + window.location.search)
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!user && pathname !== '/login' && pathname !== '/set-password') {
      replaceLocation(`/login?returnTo=${encodeURIComponent(protectedDestination(pathname))}`)
    } else if (user && pathname === '/login') {
      const requested = new URLSearchParams(location.split('?')[1] ?? '').get('returnTo')
      replaceLocation(protectedDestination(requested))
    } else if (user && pathname === '/administration') {
      replaceLocation(defaultAdministrationPath)
    } else if (user && pathname !== '/' && pathname !== '/set-password' && !routeItems.some(item => item.path === pathname) && !administrationAreaFromPath(pathname) && !customerRouteFromPath(pathname) && !isCreateApplicationPath(pathname) && !isCasePath(pathname) && !isOperationPath(pathname) && !isAccountPath(pathname)) {
      replaceLocation(routePath('dashboard'))
    }
  }, [status, user, location, pathname])

  if (status === 'loading') return <main className="amafh-auth-loading" role="status">Restoring session…</main>
  if (pathname === '/set-password') return <SetPasswordPage />
  if (!user) return <LoginPage />
  if (pathname === '/login') return <main className="amafh-auth-loading" role="status">Opening workspace…</main>

  const route = routeFromPath(pathname)
  const navigatePath = (path: string) => {
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
    setLocation(path)
    window.scrollTo({ top: 0 })
  }
  const navigate = (next: ApplicationRoute) => navigatePath(routePath(next))

  const current = routeItems.find(item => item.id === route)!
  const content = pathname === '/account/provision-user' ? <ProvisionUserPage onNavigate={navigatePath} />
    : pathname === '/account/security' ? <AccountSecurityPage onNavigate={navigatePath} />
    : route === 'dashboard' ? <DashboardPage />
    : route === 'list' ? <ListPage />
    : route === 'detail' ? <DetailPage />
    : route === 'form' ? <FormPage />
    : route === 'workspace' ? <WorkspacePage />
    : route === 'customers' ? isCreateApplicationPath(pathname) ? <CreateApplicationPage onNavigate={navigatePath} /> : <CustomerPage route={customerRouteFromPath(pathname)!} onNavigate={navigatePath} />
    : route === 'cases' ? <CasePage path={pathname} onNavigate={navigatePath} />
    : route === 'profile' ? <ProfilePage path={pathname} />
    : route === 'imports' ? <ImportPage path={pathname} onNavigate={navigatePath} />
    : route === 'notifications' ? <NotificationPage onNavigate={navigatePath} />
    : route === 'tasks' ? <TaskPage path={pathname} onNavigate={navigatePath} />
    : route === 'finance' ? <FinancePage />
    : route === 'reports' ? <ReportPage />
    : <AdministrationPage path={pathname} onNavigate={navigatePath} />

  const account = <div className="amafh-auth-account"><Avatar name={user.name} size="sm" /><span className="amafh-auth-account__name">{user.name}</span><Button variant="secondary" size="compact" onClick={() => navigatePath('/account/security')}>Account security</Button><Button variant="secondary" size="compact" onClick={() => { void signOut() }}>Log out</Button></div>
  return <ApplicationShell headerTitle={pathname === '/account/provision-user' ? 'Create user account' : isAccountPath(pathname) ? 'Account security' : current.label} items={routeItems.filter(({ id }) => !['list', 'detail', 'form', 'workspace', 'imports'].includes(id)).map(({ id, label }) => ({ id, label }))} activeId={isAccountPath(pathname) ? '' : route} onNavigate={id => navigate(id as ApplicationRoute)} account={account}>
    <Suspense fallback={<Workspace title={current.label}><div role="status">Loading template…</div></Workspace>}>{content}</Suspense>
  </ApplicationShell>
}

export function App() { return <AuthProvider><AppRouter /></AuthProvider> }
