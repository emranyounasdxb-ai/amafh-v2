import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { WorkspaceState } from '../../components/feedback/workspace-state'
import { Dialog } from '../../components/overlays/dialog'
import { DetailSection, ProfileHeader } from '../../patterns/shared-patterns'
import { mockUsersRepository, type UsersRepository } from '../users/mock-users-repository'
import type { UserRecord } from '../users/users-model'
import type { UserTypesRoute } from '../admin-routes'
import { mockUserTypesRepository, type UserTypesRepository } from './mock-user-types-repository'
import { normalizedTypeName, type UserTypeDraft, type UserTypeRecord } from './user-types-model'
import { UserTypeForm } from './user-type-form'
import './user-types-module.css'

const listPath = '/administration/user-types'
const detailPath = (id: string) => `${listPath}/${encodeURIComponent(id)}`
const dateLabel = (value: string) => new Date(value).toLocaleDateString()

export function UserTypesModule({ route, onNavigate, repository = mockUserTypesRepository, usersRepository = mockUsersRepository }: { route: UserTypesRoute; onNavigate: (path: string) => void; repository?: UserTypesRepository; usersRepository?: UsersRepository }) {
  const [types, setTypes] = useState<UserTypeRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextTypes, nextUsers] = await Promise.all([repository.list(), usersRepository.list()])
      setTypes(nextTypes)
      setUsers(nextUsers)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load user types.') }
    finally { setLoading(false) }
  }, [repository, usersRepository])
  useEffect(() => { void reload() }, [reload])

  const countFor = useCallback((type: UserTypeRecord) => users.filter(user => normalizedTypeName(user.userType) === normalizedTypeName(type.name)).length, [users])
  const columns = useMemo<DataTableColumn<UserTypeRecord>[]>(() => [
    { id: 'name', header: 'Name', value: type => type.name, width: 220 },
    { id: 'description', header: 'Description', value: type => type.description, width: 300 },
    { id: 'status', header: 'Status', value: type => type.status, width: 120, cell: type => <Badge tone={type.status === 'active' ? 'success' : 'neutral'}>{type.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
    { id: 'userCount', header: 'Users', value: type => countFor(type), width: 100 },
    { id: 'updatedAt', header: 'Updated', value: type => dateLabel(type.updatedAt), width: 150 },
  ], [countFor])

  if (route.mode === 'list') return <DataTable tableId="administration-user-types" caption="User Types" columns={columns} rows={types} rowId={type => type.id} state={loading ? 'loading' : error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} onRefresh={() => { void reload() }} pageSize={10} rowActions={type => <Button variant="secondary" size="compact" onClick={() => onNavigate(detailPath(type.id))}>View</Button>} />
  if (loading) return <WorkspaceState kind="loading" title="Loading user type" />
  if (error) return <WorkspaceState kind="error" title="Could not load user type" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} />
  if (route.mode === 'create') return <UserTypeForm types={types} onCancel={() => onNavigate(listPath)} onSave={async (draft: UserTypeDraft) => {
    const created = await repository.create(draft)
    setTypes(current => [...current, created])
    onNavigate(detailPath(created.id))
  }} />

  const type = types.find(item => item.id === route.id)
  if (!type) return <WorkspaceState kind="error" title="User Type not found" description="This local user type is unavailable." action={<Button onClick={() => onNavigate(listPath)}>Back to User Types</Button>} />
  const assignedCount = countFor(type)
  if (route.mode === 'edit') return <UserTypeForm key={type.id} initial={type} editingId={type.id} assignedCount={assignedCount} types={types} onCancel={() => onNavigate(detailPath(type.id))} onSave={async (draft: UserTypeDraft) => {
    const updated = await repository.update(type.id, draft)
    setTypes(current => current.map(item => item.id === type.id ? updated : item))
    onNavigate(detailPath(type.id))
  }} />

  const confirmDelete = async () => {
    if (deletePending || assignedCount > 0) return
    setDeletePending(true)
    setDeleteError('')
    try {
      await repository.remove(type.id)
      setTypes(current => current.filter(item => item.id !== type.id))
      setDeleteOpen(false)
      onNavigate(listPath)
    } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'Could not delete the user type.') }
    finally { setDeletePending(false) }
  }

  return <div className="amafh-user-types-detail">
    <ProfileHeader name={type.name} subtitle="User Type" status={type.status === 'active' ? 'Active' : 'Inactive'} statusTone={type.status === 'active' ? 'success' : 'neutral'} actions={<><Button onClick={() => onNavigate(`${detailPath(type.id)}/edit`)}>Edit User Type</Button><Button variant="danger" onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>Delete User Type</Button></>} />
    <DetailSection title="User Type information" items={[{ label: 'Description', value: type.description }, { label: 'Status', value: type.status === 'active' ? 'Active' : 'Inactive' }, { label: 'Users', value: assignedCount }, { label: 'Created', value: dateLabel(type.createdAt) }, { label: 'Updated', value: dateLabel(type.updatedAt) }, { label: 'Local ID', value: type.id }]} />
    <Dialog open={deleteOpen} onClose={() => { if (!deletePending) setDeleteOpen(false) }} title="Delete User Type" description={assignedCount > 0 ? `Cannot delete ${type.name}: ${assignedCount} ${assignedCount === 1 ? 'user is' : 'users are'} assigned.` : `Delete ${type.name}? This removes the local user type.`} actions={<><Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deletePending}>Cancel</Button><Button variant="danger" disabled={assignedCount > 0} loading={deletePending} onClick={() => { void confirmDelete() }}>Delete</Button></>}>
      {deleteError && <p className="amafh-user-types-form__error" role="alert">{deleteError}</p>}
    </Dialog>
  </div>
}
