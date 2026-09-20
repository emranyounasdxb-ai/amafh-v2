import { useEffect, useRef } from 'react'
import { Breadcrumb } from '../components/navigation/breadcrumb'
import { Card } from '../components/ui/card'
import { Workspace } from '../templates/workspace'
import { Button } from '../components/ui/button'
import { UsersModule } from './users/users-module'
import { UserTypesModule } from './user-types/user-types-module'
import { PermissionsModule } from './permissions/permissions-module'
import { OrganizationModule } from './organization/organization-module'
import { kindDefinition } from './organization/organization-model'
import { ManagedModule } from './managed/managed-module'
import { managedTitle } from './managed/managed-routes'
import { managedModuleForPath } from './managed/registry'
import { ApprovalModule } from './approval-centre/approval-module'
import { approvalRouteFromPath } from './approval-centre/approval-routes'
import { AuditModule } from './audit-log/audit-module'
import { apiAuditRepository } from './audit-log/api-audit-repository'
import { ProductStagesModule } from './banks-products/product-stages-module'
import { auditRouteFromPath } from './audit-log/audit-routes'
import { usePermissionPreview } from '../operations/permissions'
import { PermissionActor } from '../operations/ui'
import { administrationAreaFromPath, administrationAreas, usersRouteFromPath, userTypesRouteFromPath, permissionsRouteFromPath, organizationRouteFromPath } from './admin-routes'
import './administration-page.css'

export function AdministrationPage({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const preview = usePermissionPreview()
  const area = administrationAreaFromPath(path) ?? administrationAreas[0]
  const usersRoute = usersRouteFromPath(path)
  const userTypesRoute = userTypesRouteFromPath(path)
  const permissionsRoute = permissionsRouteFromPath(path)
  const organizationRoute = organizationRouteFromPath(path)
  const managed = managedModuleForPath(path)
  const stagesMatch = /^\/administration\/banks-products\/products\/([^/]+)\/stages$/.exec(path)
  const stagesProductId = stagesMatch ? decodeURIComponent(stagesMatch[1]) : null
  const approvalRoute = approvalRouteFromPath(path)
  const auditRoute = auditRouteFromPath(path)
  const title = usersRoute?.mode === 'create' ? 'Create User' : usersRoute?.mode === 'edit' ? 'Edit User' : usersRoute?.mode === 'detail' ? 'User detail'
    : userTypesRoute?.mode === 'create' ? 'Create User Type' : userTypesRoute?.mode === 'edit' ? 'Edit User Type' : userTypesRoute?.mode === 'detail' ? 'User Type detail'
      : permissionsRoute?.mode === 'create' ? 'Create Permission' : permissionsRoute?.mode === 'edit' ? 'Edit Permission' : permissionsRoute?.mode === 'detail' ? 'Permission detail'
        : organizationRoute && organizationRoute.mode !== 'overview' ? organizationRoute.mode === 'create' ? `Create ${kindDefinition(organizationRoute.kind).singular}` : organizationRoute.mode === 'edit' ? `Edit ${kindDefinition(organizationRoute.kind).singular}` : organizationRoute.mode === 'detail' ? `${kindDefinition(organizationRoute.kind).singular} detail` : kindDefinition(organizationRoute.kind).label
          : stagesProductId ? 'Product Stages' : managed ? managedTitle(managed.config, managed.route) : approvalRoute?.mode === 'create' ? 'Create Request' : approvalRoute?.mode === 'edit' ? 'Edit Request' : approvalRoute?.mode === 'detail' ? 'Request detail' : auditRoute?.mode === 'detail' ? 'Audit detail' : area.label
  const navigationRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const navigation = navigationRef.current
    const active = navigation?.querySelector<HTMLElement>('[aria-current="page"]')
    if (navigation && active) navigation.scrollTo({ left: active.offsetLeft - navigation.offsetLeft - (navigation.clientWidth - active.clientWidth) / 2 })
  }, [area.id])

  const navigation = <nav ref={navigationRef} className="amafh-admin-navigation" aria-label="Administration navigation">
    {administrationAreas.map(item => <button key={item.id} type="button" className="amafh-admin-navigation__item" aria-current={item.id === area.id ? 'page' : undefined} onClick={() => onNavigate(item.path)}>{item.label}</button>)}
  </nav>

  const nested = Boolean(stagesProductId) || (usersRoute && usersRoute.mode !== 'list') || (userTypesRoute && userTypesRoute.mode !== 'list') || (permissionsRoute && permissionsRoute.mode !== 'list') || (organizationRoute && organizationRoute.mode !== 'overview') || (managed && (managed.route.mode !== 'list' || managed.route.kind !== null)) || (approvalRoute && approvalRoute.mode !== 'list') || (auditRoute && auditRoute.mode !== 'list')
  const breadcrumb = organizationRoute && organizationRoute.mode !== 'overview' ? [{ label: 'Administration', href: '/administration' }, { label: area.label, href: area.path }, ...(organizationRoute.mode === 'list' ? [{ label: title }] : [{ label: kindDefinition(organizationRoute.kind).label, href: `${area.path}/${organizationRoute.kind}` }, { label: title }])] : nested ? [{ label: 'Administration', href: '/administration' }, { label: area.label, href: area.path }, { label: title }] : [{ label: 'Administration', href: '/administration' }, { label: area.label }]
  const actions = usersRoute?.mode === 'list' && preview.can('Users', 'create') ? <Button onClick={() => onNavigate('/administration/users/new')}>Create User</Button>
    : userTypesRoute?.mode === 'list' ? <Button onClick={() => onNavigate('/administration/user-types/new')}>Create User Type</Button>
      : permissionsRoute?.mode === 'list' ? <Button onClick={() => onNavigate('/administration/permissions/new')}>Create Permission</Button>
        : organizationRoute?.mode === 'list' && (import.meta.env.MODE === 'test' || import.meta.env.VITE_AUTH_PROVIDER === 'mock' || preview.can('Organization', 'edit')) ? <Button onClick={() => onNavigate(`/administration/organization/${organizationRoute.kind}/new`)}>Create {kindDefinition(organizationRoute.kind).singular}</Button>
          : managed?.route.mode === 'list' && managed.route.kind ? <Button onClick={() => onNavigate(`/administration/${managed.config.slug}/${managed.route.kind}/new`)}>Create {managed.config.kinds.find(item => item.id === managed.route.kind)?.singular}</Button>
            : approvalRoute?.mode === 'list' ? <Button onClick={() => onNavigate('/administration/approval-centre/new')}>Create Request</Button> : undefined
  return <Workspace title={title} description="Administration" breadcrumb={<Breadcrumb items={breadcrumb} />} toolbar={navigation} actions={actions}>
    {usersRoute && <PermissionActor preview={preview} />}
    {usersRoute ? <UsersModule route={usersRoute} onNavigate={onNavigate} /> : userTypesRoute ? <UserTypesModule route={userTypesRoute} onNavigate={onNavigate} /> : permissionsRoute ? <PermissionsModule route={permissionsRoute} onNavigate={onNavigate} /> : organizationRoute ? <OrganizationModule route={organizationRoute} onNavigate={onNavigate} /> : stagesProductId ? <ProductStagesModule productId={stagesProductId} /> : managed ? <ManagedModule config={managed.config} repository={managed.repository} route={managed.route} onNavigate={onNavigate} /> : approvalRoute ? <ApprovalModule route={approvalRoute} onNavigate={onNavigate} /> : auditRoute ? <AuditModule route={auditRoute} onNavigate={onNavigate} repository={import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock' ? apiAuditRepository : undefined} /> : <Card className="amafh-admin-placeholder" aria-label={`${area.label} placeholder`}>
      <h2>Page content</h2>
      <p>{area.label} area placeholder.</p>
    </Card>}
  </Workspace>
}
