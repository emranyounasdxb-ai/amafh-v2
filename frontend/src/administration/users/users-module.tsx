import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { SelectField } from '../../components/ui/select-field'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { WorkspaceState } from '../../components/feedback/workspace-state'
import { DetailSection, FormSection, ProfileHeader } from '../../patterns/shared-patterns'
import { TextField } from '../../components/ui/text-field'
import type { UsersRoute } from '../admin-routes'
import { mockUsersRepository, type UsersRepository } from './mock-users-repository'
import { scopeOptions, userTypeOptions, type UserDraft, type UserRecord } from './users-model'
import { UserForm } from './user-form'
import { profileImagesRepository, type ProfileImages } from '../../operations/profile-images'
import { usePermissionPreview, requireAction } from '../../operations/permissions'
import { PermissionGate } from '../../operations/ui'
import './users-module.css'

const usersPath = '/administration/users'
const detailPath = (id: string) => `${usersPath}/${encodeURIComponent(id)}`

export function UsersModule({ route, onNavigate, repository = mockUsersRepository }: { route: UsersRoute; onNavigate: (path: string) => void; repository?: UsersRepository }) {
  const preview = usePermissionPreview()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [profileImages, setProfileImages] = useState<ProfileImages>({ avatar: '', banner: '' })
  const [setupLink, setSetupLink] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupPending, setSetupPending] = useState(false)
  const detailUserId = route.mode === 'detail' ? route.id : ''
  useEffect(() => { if (detailUserId) void profileImagesRepository.get(detailUserId).then(setProfileImages).catch(() => setProfileImages({ avatar: '', banner: '' })) }, [detailUserId])
  useEffect(() => { setSetupLink(''); setSetupError('') }, [detailUserId])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setUsers(await repository.list()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load users.') }
    finally { setLoading(false) }
  }, [repository])
  useEffect(() => { void reload() }, [reload])

  const columns = useMemo<DataTableColumn<UserRecord>[]>(() => [
    { id: 'fullName', header: 'Name', value: user => user.fullName, width: 220 },
    { id: 'email', header: 'Email', value: user => user.email, width: 240 },
    { id: 'status', header: 'Status', value: user => user.status, width: 120, cell: user => <Badge tone={user.status === 'active' ? 'success' : 'neutral'}>{user.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
    { id: 'userType', header: 'User Type', value: user => user.userType, width: 160 },
    { id: 'organization', header: 'Organization', value: user => user.organization, width: 180 },
    { id: 'officeBranch', header: 'Office / Branch', value: user => user.officeBranch || '—', width: 170 },
  ], [])

  if (route.mode === 'list') return <PermissionGate preview={preview} domain="Users" action="view"><DataTable tableId="administration-users" caption="Users" columns={columns} rows={users} rowId={user => user.id} state={loading ? 'loading' : error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} onRefresh={() => { void reload() }} pageSize={10}
    filters={user => (statusFilter === 'all' || user.status === statusFilter) && (typeFilter === 'all' || user.userType === typeFilter)}
    filterControls={<><SelectField label="Status filter" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /><SelectField label="User Type filter" value={typeFilter} onValueChange={setTypeFilter} options={[{ value: 'all', label: 'All user types' }, ...userTypeOptions.map(value => ({ value, label: value }))]} /></>}
    rowActions={user => <Button variant="secondary" size="compact" onClick={() => onNavigate(detailPath(user.id))}>View</Button>} /></PermissionGate>

  if (loading) return <WorkspaceState kind="loading" title="Loading user" />
  if (error) return <WorkspaceState kind="error" title="Could not load user" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} />
  if (route.mode === 'create') return <PermissionGate preview={preview} domain="Users" action="create"><UserForm users={users} onCancel={() => onNavigate(usersPath)} onSave={async (draft: UserDraft) => {
    await requireAction('Users', 'create', preview.actorId)
    const created = await repository.create(draft, preview.actorId)
    setUsers(current => [...current, created])
    onNavigate(detailPath(created.id))
  }} /></PermissionGate>

  const user = users.find(item => item.id === route.id)
  if (!user) return <WorkspaceState kind="error" title="User not found" description="This local user record is unavailable." action={<Button onClick={() => onNavigate(usersPath)}>Back to Users</Button>} />
  if (route.mode === 'edit') return <PermissionGate preview={preview} domain="Users" action="edit"><UserForm key={user.id} initial={user} editingId={user.id} users={users} onCancel={() => onNavigate(detailPath(user.id))} onSave={async (draft: UserDraft) => {
    await requireAction('Users', 'edit', preview.actorId)
    const updated = await repository.update(user.id, draft, preview.actorId)
    setUsers(current => current.map(item => item.id === user.id ? updated : item))
    onNavigate(detailPath(user.id))
  }} /></PermissionGate>

  const manager = users.find(item => item.id === user.reportingManagerId)
  const scope = scopeOptions.find(option => option.value === user.organizationScope)?.label ?? '—'
  const generateSetupLink = async () => {
    if (setupPending) return
    setSetupPending(true); setSetupLink(''); setSetupError('')
    try {
      const response = await fetch('/api/v1/auth/setup-link', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email }) })
      if (!response.ok) throw new Error(response.status === 403 ? 'Your account needs the manually assigned Users: edit permission.' : response.status === 404 ? 'This user account is not available in the authentication service.' : 'Could not generate a setup link.')
      const result: { setup_url: string } = await response.json()
      if (!result.setup_url.startsWith('/set-password?token=')) throw new Error('Could not generate a setup link.')
      setSetupLink(`${window.location.origin}${result.setup_url}`)
    } catch (cause) { setSetupError(cause instanceof Error ? cause.message : 'Could not generate a setup link.') }
    finally { setSetupPending(false) }
  }
  return <PermissionGate preview={preview} domain="Users" action="view"><div className="amafh-users-detail">
    {profileImages.banner && <img className="amafh-ops-banner" src={profileImages.banner} alt={`${user.fullName} banner`} />}
    <ProfileHeader name={user.fullName} subtitle={user.email} imageSrc={profileImages.avatar || undefined} status={user.status === 'active' ? 'Active' : 'Inactive'} statusTone={user.status === 'active' ? 'success' : 'neutral'} actions={<><Button variant="secondary" onClick={() => onNavigate(`/profile/${encodeURIComponent(user.id)}`)}>Profile images</Button>{preview.can('Users', 'edit') && <Button onClick={() => onNavigate(`${detailPath(user.id)}/edit`)}>Edit User</Button>}</>} />
    <DetailSection title="User information" items={[{ label: 'Email', value: user.email }, { label: 'Status', value: user.status === 'active' ? 'Active' : 'Inactive' }, { label: 'User Type', value: user.userType }, { label: 'Reporting Manager', value: manager?.fullName ?? 'None' }]} />
    <DetailSection title="Organization assignment" items={[{ label: 'Organization', value: user.organization }, { label: 'Organization Scope', value: scope }, { label: 'Office / Branch', value: user.officeBranch || '—' }, { label: 'Department', value: user.department || '—' }, { label: 'Team', value: user.team || '—' }]} />
    {preview.can('Users', 'edit') && <FormSection title="Password setup" description="Generate a one-time link and send it to the user yourself. Generating another link revokes the previous one.">
      <Button variant="secondary" loading={setupPending} onClick={() => { void generateSetupLink() }}>Generate setup link</Button>
      {setupLink && <TextField label="One-time setup link" value={setupLink} readOnly onFocus={event => event.currentTarget.select()} helperText="Share this link with the user. It expires after 30 minutes." />}
      {setupError && <p role="alert">{setupError}</p>}
    </FormSection>}
  </div></PermissionGate>
}
