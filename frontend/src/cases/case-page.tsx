import { useCallback, useEffect, useState } from 'react'
import { banksProductsRepository } from '../administration/banks-products/banks-products'
import type { ManagedRecord } from '../administration/managed/managed-model'
import { mockPermissionsRepository } from '../administration/permissions/mock-permissions-repository'
import type { PermissionRecord } from '../administration/permissions/permissions-model'
import { mockUserTypesRepository } from '../administration/user-types/mock-user-types-repository'
import type { UserTypeRecord } from '../administration/user-types/user-types-model'
import { mockUsersRepository } from '../administration/users/mock-users-repository'
import type { UserRecord } from '../administration/users/users-model'
import { DataTable, type DataTableColumn } from '../components/data-table/data-table'
import { Breadcrumb } from '../components/navigation/breadcrumb'
import { Button } from '../components/ui/button'
import { SelectField } from '../components/ui/select-field'
import { TextField } from '../components/ui/text-field'
import { Badge } from '../components/ui/badge'
import { WorkspaceState } from '../components/feedback/workspace-state'
import { ActivityTimeline, ConfirmationDialog, DetailSection, FormSection } from '../patterns/shared-patterns'
import { Workspace } from '../templates/workspace'
import { customerName, type ApplicationDraft, type ApplicationRecord, type CustomerRecord } from '../customers/customer-model'
import { mockCustomerRepository } from '../customers/mock-customer-repository'
import { CASE_PREVIEW_ACTOR_KEY, caseActionAllowed } from './case-permissions'
import { caseRepository, isCaseLocked, type CaseAction } from './case-repository'
import { apiCaseRepository } from './api-case-repository'
import { apiCustomerRepository, loadApiCatalogue, loadApiCaseOwners } from '../customers/api-customer-repository'
import { productStagesRepository, type ProductStageRecord } from '../administration/banks-products/product-stages'
import { apiProductStagesRepository } from '../administration/banks-products/api-product-stages'
import { caseStageAging, formatDuration } from './case-aging'
import { hasAction, usePermissionPreview } from '../operations/permissions'
import { notificationsRepository, type NotificationRecord } from '../operations/notifications'
import { apiNotificationsRepository } from '../operations/api-notifications'
import './case.css'

const date = (value: string) => value ? new Date(value).toLocaleString() : '—'
const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
export function CasePage({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const preview = usePermissionPreview()
  const repository = apiMode ? apiCaseRepository : caseRepository
  const selectedId = path === '/cases' ? '' : decodeURIComponent(path.slice('/cases/'.length))
  const [cases, setCases] = useState<ApplicationRecord[]>([])
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [types, setTypes] = useState<UserTypeRecord[]>([])
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [catalogue, setCatalogue] = useState<ManagedRecord[]>([])
  const [productStages, setProductStages] = useState<ProductStageRecord[]>([])
  const [clock, setClock] = useState(() => new Date())
  const [actorId, setActorId] = useState(() => sessionStorage.getItem(CASE_PREVIEW_ACTOR_KEY) ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState<ApplicationDraft | null>(null)
  const [value, setValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [communications, setCommunications] = useState<NotificationRecord[]>([])
  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (apiMode) {
        const [caseRecords, customerRecords, userRecords, catalogueRecords] = await Promise.all([apiCaseRepository.list(), apiCustomerRepository.list(), loadApiCaseOwners(), loadApiCatalogue()])
        const selected = selectedId ? await apiCaseRepository.detail(selectedId) : null
        setCases(selected ? caseRecords.some(record => record.id === selected.id) ? caseRecords.map(record => record.id === selected.id ? selected : record) : [...caseRecords, selected] : caseRecords)
        const products = selected ? catalogueRecords.filter(record => record.kind === 'products' && record.id === selected.productId) : []
        const stageGroups = await Promise.all(products.map(record => apiProductStagesRepository.list(record.id)))
        setCustomers(customerRecords); setUsers(userRecords); setCatalogue(catalogueRecords); setProductStages(stageGroups.flat())
      } else {
        const [caseRecords, customerRecords, userRecords, typeRecords, permissionRecords, catalogueRecords] = await Promise.all([caseRepository.list(), mockCustomerRepository.list(), mockUsersRepository.list(), mockUserTypesRepository.list(), mockPermissionsRepository.list(), banksProductsRepository.list()])
        const products = catalogueRecords.filter(record => record.kind === 'products')
        const stageGroups = await Promise.all(products.map(record => productStagesRepository.list(record.id)))
        setCases(caseRecords); setCustomers(customerRecords); setUsers(userRecords); setTypes(typeRecords); setPermissions(permissionRecords); setCatalogue(catalogueRecords); setProductStages(stageGroups.flat())
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load Cases.') }
    finally { setLoading(false) }
  }, [selectedId])
  useEffect(() => { void reload() }, [reload])
  useEffect(() => { const interval = window.setInterval(() => setClock(new Date()), 60_000); return () => window.clearInterval(interval) }, [])
  const item = cases.find(record => record.id === selectedId)
  const effectiveActorId = apiMode ? preview.actorId : actorId
  const canViewCases = apiMode ? preview.can('Cases', 'view') : hasAction('Cases', 'view', actorId, users, types, permissions)
  const canViewCommunications = apiMode ? preview.can('Notifications', 'view-communication-history') : hasAction('Notifications', 'view-communication-history', actorId, users, types, permissions)
  useEffect(() => { if (!selectedId || !canViewCommunications) { setCommunications([]); return }; void (apiMode ? apiNotificationsRepository.forCase(selectedId) : notificationsRepository.forCase(selectedId, actorId)).then(setCommunications).catch(() => setCommunications([])) }, [selectedId, actorId, canViewCommunications, item?.history.length])
  const customer = customers.find(record => record.id === item?.customerId)
  const userName = (id: string) => users.find(user => user.id === id)?.fullName ?? (id ? 'User unavailable' : '—')
  const allowed = (action: string) => apiMode ? preview.can('Cases', action) : caseActionAllowed(action, actorId, users, types, permissions)
  const changeActor = (id: string) => { setActorId(id); sessionStorage.setItem(CASE_PREVIEW_ACTOR_KEY, id); setActionError(''); setShowHistory(false) }
  const act = async (action: CaseAction, nextValue = value, nextDraft = draft) => {
    if (!item || busy) return
    if (!allowed(action)) { setActionError(apiMode ? `Your User Type needs Cases: ${action} permission.` : 'Assign this Case action to the acting user’s User Type in Administration → Permissions.'); return }
    setBusy(true); setActionError('')
    try { const updated = await repository.update(item.id, { action, actorId: effectiveActorId, value: nextValue, ...(nextDraft ? { draft: nextDraft } : {}) }); setCases(current => current.map(record => record.id === updated.id ? updated : record)); setValue(''); setEdit(false) }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not update Case.') }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!item || !allowed('delete')) return
    setBusy(true); setActionError('')
    try { await repository.remove(item.id, effectiveActorId); setConfirmDelete(false); onNavigate('/cases') }
    catch (cause) { setConfirmDelete(false); setActionError(cause instanceof Error ? cause.message : 'Could not delete Case.') }
    finally { setBusy(false) }
  }
  const actorPicker = apiMode ? null : <div className="amafh-case-actor"><SelectField label="Acting user (local permission preview)" value={actorId} onValueChange={changeActor} options={users.filter(user => user.status === 'active').map(user => ({ value: user.id, label: `${user.fullName} · ${user.userType}` }))} placeholder="Choose an existing user" /><p>Actions use the enabled Case permissions assigned to this user’s User Type. This local preview is not authentication or access enforcement.</p></div>
  const columns: DataTableColumn<ApplicationRecord>[] = [
    { id: 'number', header: 'Case Number', value: record => record.caseNumber ?? record.id, width: 200 },
    { id: 'customer', header: 'Customer', value: record => customers.find(customer => customer.id === record.customerId) ? customerName(customers.find(customer => customer.id === record.customerId)!) : 'Customer unavailable' },
    { id: 'type', header: 'Customer Type', value: record => customers.find(customer => customer.id === record.customerId)?.type ?? 'Missing' },
    { id: 'bank', header: 'Bank', value: record => record.bank }, { id: 'product', header: 'Product', value: record => record.product },
    { id: 'variant', header: 'Product Variant', value: record => record.productVariant }, { id: 'amount', header: 'Requested Amount', value: record => record.requestedAmount },
    { id: 'owner', header: 'Case Owner', value: record => userName(record.caseOwnerId) }, { id: 'coordinator', header: 'Case Coordinator', value: record => userName(record.coordinatorId) },
    { id: 'stage', header: 'Current Stage', value: record => record.stage }, { id: 'status', header: 'Status', value: record => record.status },
    { id: 'sla', header: 'Stage SLA', value: record => caseStageAging(record, clock)?.status ?? '—', cell: record => { const aging = caseStageAging(record, clock); return aging ? <Badge tone={aging.status === 'Overdue' ? 'danger' : aging.status === 'Due Soon' ? 'warning' : 'success'}>{aging.status}{aging.status === 'Overdue' ? ` · ${formatDuration(aging.overdueMs)}` : ''}</Badge> : '—' } },
    { id: 'created', header: 'Created Date', value: record => record.createdAt, cell: record => date(record.createdAt) },
  ]
  if (!selectedId) return <Workspace title="Cases" description={apiMode ? 'Customer-linked application records.' : 'Customer-linked local application records.'} breadcrumb={<Breadcrumb items={[{ label: 'Cases' }]} />} actions={allowed('create') && <Button onClick={() => onNavigate('/applications/new')}>Create Application</Button>}>
    {actorPicker}{!loading && !error && !canViewCases ? <WorkspaceState kind="permission" title="Permission required" description={apiMode ? 'Your User Type needs Cases: view permission.' : 'Select an acting user whose User Type has Cases: view permission in Administration → Permissions.'} /> : <DataTable tableId="application-cases" caption="Cases" columns={columns} rows={cases} rowId={record => record.id} state={loading ? 'loading' : error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} onRefresh={() => { void reload() }} pageSize={10} filter={(record, query) => [record.caseNumber, record.id, record.bank, record.product, record.productVariant, record.stage, record.status, customers.find(customer => customer.id === record.customerId)?.type ?? '', customers.find(customer => customer.id === record.customerId) ? customerName(customers.find(customer => customer.id === record.customerId)!) : '', userName(record.caseOwnerId)].some(text => text.toLowerCase().includes(query.toLowerCase()))} filters={record => (statusFilter === 'all' || record.status === statusFilter) && (stageFilter === 'all' || record.stage === stageFilter)} filterControls={<div className="amafh-case-filters"><SelectField label="Status" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "all", label: "All statuses" }, ...["Pending SM Approval", "SM Approved", "SM Rejected"].map(state => ({ value: state, label: state }))]} /><SelectField label="Stage" value={stageFilter} onValueChange={setStageFilter} options={[{ value: "all", label: "All stages" }, ...[...new Set(cases.map(record => record.stage))].map(stage => ({ value: stage, label: stage }))]} /></div>} rowActions={record => <Button size="compact" variant="secondary" onClick={() => onNavigate(`/cases/${encodeURIComponent(record.id)}`)}>View</Button>} />}
  </Workspace>
  if (loading) return <Workspace title="Case workspace"><WorkspaceState kind="loading" title="Loading Case" /></Workspace>
  if (error) return <Workspace title="Case workspace"><WorkspaceState kind="error" title="Could not load Case" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} /></Workspace>
  if (!canViewCases) return <Workspace title="Case workspace">{actorPicker}<WorkspaceState kind="permission" title="Permission required" description={apiMode ? 'Your User Type needs Cases: view permission.' : 'Select an acting user whose User Type has Cases: view permission in Administration → Permissions.'} /></Workspace>
  if (!item) return <Workspace title="Case workspace"><WorkspaceState kind="empty" title="Case was not found" action={<Button onClick={() => onNavigate('/cases')}>Back to Cases</Button>} /></Workspace>
  const locked = isCaseLocked(item)
  const aging = caseStageAging(item, clock)
  const caseProduct = catalogue.find(record => record.kind === 'products' && record.id === item.productId) ?? catalogue.find(record => record.kind === 'products' && record.name === item.product && catalogue.some(bank => bank.id === record.parentId && bank.name === item.bank))
  const availableStages = productStages.filter(stage => stage.productId === caseProduct?.id && stage.status === 'active' && stage.id !== item.stageId).sort((a, b) => a.sequence - b.sequence)
  const banks = catalogue.filter(record => record.kind === 'banks' && record.status === 'active')
  const bank = banks.find(record => record.name === draft?.bank)
  const products = catalogue.filter(record => record.kind === 'products' && record.parentId === bank?.id && record.status === 'active')
  const product = products.find(record => record.name === draft?.product)
  const variants = catalogue.filter(record => record.kind === 'variants' && record.parentId === product?.id && record.status === 'active')
  const activeUsers = users.filter(user => user.status === 'active').map(user => ({ value: user.id, label: user.fullName }))
  const button = (label: string, action: CaseAction, condition: boolean, actionValue?: string) => condition && allowed(action) && <Button key={action} variant="secondary" disabled={busy} onClick={() => { void act(action, actionValue) }}>{label}</Button>
  return <Workspace title="Case workspace" description={item.caseNumber} breadcrumb={<Breadcrumb items={[{ label: 'Cases', href: '/cases' }, { label: item.caseNumber }]} />} actions={<Button variant="secondary" onClick={() => onNavigate('/cases')}>Back to Cases</Button>}>
    {actorPicker}{actionError && <p role="alert" className="amafh-case-error">{actionError}</p>}
    <DetailSection title="Case Summary" items={[{ label: 'Case Number', value: item.caseNumber }, { label: 'Status', value: item.status }, { label: 'Current Stage', value: item.stage }, { label: 'Locked', value: locked ? 'Locked · original submission protected' : 'Unlocked' }, { label: 'Created Date / Time', value: date(item.createdAt) }]} />
    {aging ? <DetailSection title="Current Stage SLA" items={[{ label: 'Stage', value: aging.stage }, { label: 'Stage Started', value: date(aging.startedAt) }, { label: 'Expected Time', value: `${aging.expectedDurationHours} hours · captured at stage entry` }, { label: 'Due', value: date(aging.dueAt) }, { label: 'Elapsed / Aging', value: formatDuration(aging.elapsedMs) }, { label: 'Remaining Time', value: aging.remainingMs ? formatDuration(aging.remainingMs) : '—' }, { label: 'Overdue Duration', value: aging.overdueMs ? formatDuration(aging.overdueMs) : '—' }, { label: 'Stage Status', value: <Badge tone={aging.status === 'Overdue' ? 'danger' : aging.status === 'Due Soon' ? 'warning' : 'success'}>{aging.status}</Badge> }]} /> : item.stageId ? <FormSection title="Current Stage SLA"><p>Stage timing is unavailable for this historical Case entry.</p></FormSection> : null}
    {customer ? <DetailSection title="Customer" items={[{ label: 'Name', value: customerName(customer) }, { label: 'Customer Type', value: customer.type }, { label: customer.type === 'individual' ? 'Emirates ID / Passport Number' : 'Trade License', value: customer.type === 'individual' ? `${customer.emiratesId} / ${customer.passportNumber}` : customer.tradeLicense }, { label: 'Contact', value: `${customer.mobile} · ${customer.email}` }, { label: 'Customer record', value: <Button variant="outline" size="compact" onClick={() => onNavigate(`/customers/${encodeURIComponent(customer.id)}`)}>Open Customer</Button> }]} /> : <WorkspaceState kind="error" title="Customer unavailable" description="The linked Customer could not be found." />}
    <DetailSection title="Case Ownership" items={[{ label: 'Case Owner', value: userName(item.caseOwnerId) }, { label: 'Case Coordinator', value: userName(item.coordinatorId) }]} />
    <DetailSection title="Application" items={[{ label: 'Bank', value: item.bank }, { label: 'Product', value: item.product }, { label: 'Product Variant', value: item.productVariant }, { label: 'Requested Amount', value: item.requestedAmount }, { label: 'Bank File Number', value: item.bankFileNumber || '—' }, { label: 'Submitted to Bank', value: date(item.submittedAt) }, ...(apiMode && item.productId && ['add-stage', 'edit-stage', 'set-stage-duration', 'reorder-stage', 'activate-stage', 'delete-stage'].some(allowed) ? [{ label: 'Product Stages', value: <Button variant="secondary" size="compact" onClick={() => onNavigate(`/administration/banks-products/products/${encodeURIComponent(item.productId!)}/stages`)}>Manage Product Stages</Button> }] : [])]} />
    <DetailSection title="SM Approval" items={[{ label: 'Status', value: item.status }, { label: 'Approval actor', value: userName(item.approvalActorId) }, { label: 'Review date / time', value: date(item.approvedAt) }]} />
    <FormSection title="Case actions" description="Only enabled actions assigned to the selected acting user’s User Type appear here."><div className="amafh-case-actions">
      {button('Approve', 'approve', item.status === 'Pending SM Approval')}{button('Reject', 'reject', item.status === 'Pending SM Approval')}
      {item.status === 'Pending SM Approval' && !locked && allowed('edit') && <Button variant="secondary" onClick={() => { setDraft({ bank: item.bank, product: item.product, productVariant: item.productVariant, requestedAmount: item.requestedAmount, caseOwnerId: item.caseOwnerId }); setEdit(true) }}>Edit Application</Button>}
      {item.status === 'Pending SM Approval' && allowed('assign-owner') && <><SelectField label="Change Case Owner" value={value} onValueChange={setValue} options={activeUsers} /><Button variant="secondary" disabled={!value || busy} onClick={() => { void act('assign-owner') }}>Save Case Owner</Button></>}
      {item.status === 'SM Approved' && allowed('assign-coordinator') && <><SelectField label="Case Coordinator" value={value} onValueChange={setValue} options={activeUsers} /><Button variant="secondary" disabled={!value || busy} onClick={() => { void act('assign-coordinator') }}>Assign Case Coordinator</Button></>}
      {button('Submit to Bank', 'submit-to-bank', item.status === 'SM Approved' && item.coordinatorId === effectiveActorId && !item.submittedAt)}
      {item.status === 'SM Approved' && item.coordinatorId === effectiveActorId && item.submittedAt && !item.bankFileNumber && allowed('add-bank-file-number') && <><TextField label="Bank File Number" value={value} onChange={event => setValue(event.target.value)} /><Button variant="secondary" disabled={!value.trim() || busy} onClick={() => { void act('add-bank-file-number') }}>Add Bank File Number</Button></>}
      {item.status === 'SM Approved' && item.coordinatorId === effectiveActorId && item.submittedAt && allowed('update-stage') && <><SelectField label="Next Case Stage" value={value} onValueChange={setValue} options={availableStages.map(stage => ({ value: stage.id, label: stage.name }))} /><Button variant="secondary" disabled={!value || busy || !availableStages.some(stage => stage.id === value)} onClick={() => { void act('update-stage') }}>Update Stage</Button></>}
      {allowed('edit-history') && <><TextField label="History information" value={value} onChange={event => setValue(event.target.value)} /><Button variant="secondary" disabled={!value.trim() || busy} onClick={() => { void act('edit-history') }}>Add History Information</Button></>}
      {allowed('view-history') && <Button variant="secondary" onClick={() => setShowHistory(show => !show)}>{showHistory ? 'Hide History' : 'View History'}</Button>}
      {item.status === 'Pending SM Approval' && allowed('delete') && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete Case</Button>}
    </div></FormSection>
    {edit && draft && <FormSection title="Edit Application"><div className="amafh-case-form"><SelectField label="Bank" value={draft.bank} onValueChange={bank => setDraft({ ...draft, bank, product: '', productVariant: '' })} options={banks.map(record => ({ value: record.name, label: record.name }))} /><SelectField label="Product" value={draft.product} onValueChange={product => setDraft({ ...draft, product, productVariant: '' })} options={products.map(record => ({ value: record.name, label: record.name }))} disabled={!bank} /><SelectField label="Product Variant" value={draft.productVariant} onValueChange={productVariant => setDraft({ ...draft, productVariant })} options={variants.map(record => ({ value: record.name, label: record.name }))} disabled={!product} /><TextField label="Requested Amount" type="number" min="0" value={draft.requestedAmount} onChange={event => setDraft({ ...draft, requestedAmount: event.target.value })} /><SelectField label="Case Owner" value={draft.caseOwnerId} onValueChange={caseOwnerId => setDraft({ ...draft, caseOwnerId })} options={activeUsers} /></div><div className="amafh-case-actions"><Button disabled={busy} onClick={() => { void act('edit', '', draft) }}>Save Application</Button><Button variant="secondary" onClick={() => setEdit(false)}>Cancel</Button></div></FormSection>}
    {showHistory && allowed('view-history') && <ActivityTimeline title="Case History" events={[...item.history].sort((a, b) => a.at.localeCompare(b.at)).map(event => ({ id: event.id, title: event.label, detail: `${userName(event.actorId)}${event.detail ? ` · ${event.detail}` : ''}`, time: date(event.at) }))} />}
    {canViewCommunications && <ActivityTimeline title="Operational notifications" events={communications.map(event => ({ id: event.id, title: event.category.replaceAll('-', ' '), detail: `${event.message} · To ${userName(event.recipientId)} · By ${userName(event.actorId)}`, time: date(event.at) }))} />}
    <ConfirmationDialog open={confirmDelete} title="Delete Case" description={item.history.length > 1 ? 'This Case has related history and cannot be deleted.' : 'Delete this pending Case? The Customer record will remain.'} confirmLabel="Delete" danger onClose={() => setConfirmDelete(false)} onConfirm={() => { void remove() }} pending={busy} />
  </Workspace>
}
