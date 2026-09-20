import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '../components/ui/button'
import { Breadcrumb } from '../components/navigation/breadcrumb'
import { SelectField } from '../components/ui/select-field'
import { TextField } from '../components/ui/text-field'
import { WorkspaceState } from '../components/feedback/workspace-state'
import { FormSection } from '../patterns/shared-patterns'
import { Workspace } from '../templates/workspace'
import { CustomerFields } from './customer-fields'
import { customerName, emptyCompany, emptyIndividual, findCustomerMatches, hasConflictingIdentity, validateApplicationDraft, validateCustomerDraft, type ApplicationDraft, type CustomerDraft, type CustomerErrors, type CustomerRecord, type CustomerType } from './customer-model'
import { mockApplicationRepository, mockCustomerRepository, type ApplicationRepository, type CustomerRepository } from './mock-customer-repository'
import { apiApplicationRepository, apiCustomerRepository, loadApiCatalogue, loadApiCaseOwners } from './api-customer-repository'
import { banksProductsRepository } from '../administration/banks-products/banks-products'
import { mockUsersRepository } from '../administration/users/mock-users-repository'
import type { ManagedRecord } from '../administration/managed/managed-model'
import type { UserRecord } from '../administration/users/users-model'
import { mockUserTypesRepository } from '../administration/user-types/mock-user-types-repository'
import type { UserTypeRecord } from '../administration/user-types/user-types-model'
import { mockPermissionsRepository } from '../administration/permissions/mock-permissions-repository'
import type { PermissionRecord } from '../administration/permissions/permissions-model'
import { CASE_PREVIEW_ACTOR_KEY, caseActionAllowed } from '../cases/case-permissions'
import { usePermissionPreview } from '../operations/permissions'
import './customer.css'

const emptyApplication = (): ApplicationDraft => ({ bank: '', product: '', productVariant: '', requestedAmount: '', caseOwnerId: '' })
const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
export function CreateApplicationPage({ onNavigate, customersRepository = apiMode ? apiCustomerRepository : mockCustomerRepository, applicationsRepository = apiMode ? apiApplicationRepository : mockApplicationRepository }: { onNavigate: (path: string) => void; customersRepository?: CustomerRepository; applicationsRepository?: ApplicationRepository }) {
  const preview = usePermissionPreview()
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [catalogue, setCatalogue] = useState<ManagedRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [types, setTypes] = useState<UserTypeRecord[]>([])
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [actorId, setActorId] = useState(() => sessionStorage.getItem(CASE_PREVIEW_ACTOR_KEY) ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [type, setType] = useState<CustomerType>('individual')
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(emptyIndividual)
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [application, setApplication] = useState<ApplicationDraft>(emptyApplication)
  const [customerErrors, setCustomerErrors] = useState<CustomerErrors>({})
  const [applicationErrors, setApplicationErrors] = useState<CustomerErrors>({})
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(false)
  const reload = useCallback(async () => { setLoading(true); setError(''); try { if (apiMode) { const [customerRecords, catalogueRecords, userRecords] = await Promise.all([customersRepository.list(), loadApiCatalogue(), loadApiCaseOwners()]); setCustomers(customerRecords); setCatalogue(catalogueRecords); setUsers(userRecords) } else { const [customerRecords, catalogueRecords, userRecords, typeRecords, permissionRecords] = await Promise.all([customersRepository.list(), banksProductsRepository.list(), mockUsersRepository.list(), mockUserTypesRepository.list(), mockPermissionsRepository.list()]); setCustomers(customerRecords); setCatalogue(catalogueRecords); setUsers(userRecords); setTypes(typeRecords); setPermissions(permissionRecords) } } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load application data.') } finally { setLoading(false) } }, [customersRepository])
  useEffect(() => { void reload() }, [reload])
  const suggestions = useMemo(() => {
    const typed = findCustomerMatches(customerDraft, customers)
    const search = query.trim().toLocaleLowerCase()
    const searched = search ? customers.filter(item => item.type === type && [customerName(item), item.mobile, item.email, item.type === 'individual' ? item.emiratesId : item.tradeLicense, item.type === 'individual' ? item.passportNumber : item.companyName].some(value => value.toLocaleLowerCase().includes(search))) : []
    return [...new Map([...typed, ...searched].map(item => [item.id, item])).values()]
  }, [customerDraft, customers, query, type])
  const selected = customers.find(item => item.id === selectedId)
  const banks = catalogue.filter(item => item.kind === 'banks' && item.status === 'active')
  const bank = banks.find(item => item.name === application.bank)
  const products = catalogue.filter(item => item.kind === 'products' && item.parentId === bank?.id && item.status === 'active')
  const product = products.find(item => item.name === application.product)
  const variants = catalogue.filter(item => item.kind === 'variants' && item.parentId === product?.id && item.status === 'active')
  const effectiveActorId = apiMode ? preview.actorId : actorId
  const canCreate = apiMode ? preview.can('Cases', 'create') : caseActionAllowed('create', actorId, users, types, permissions)
  const changeType = (value: CustomerType) => { setType(value); setCustomerDraft(value === 'individual' ? emptyIndividual() : emptyCompany()); setSelectedId(''); setQuery(''); setCustomerErrors({}); setSaveError('') }
  const changeApplication = (key: keyof ApplicationDraft, value: string) => { setApplication(current => ({ ...current, [key]: value })); setApplicationErrors({}); setSaveError('') }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (pending) return
    if (!canCreate) { setSaveError(apiMode ? 'Your User Type needs Cases: create permission.' : 'Assign the Case Create action to the acting user’s User Type in Administration → Permissions.'); return }
    const nextApplicationErrors = validateApplicationDraft(application)
    const nextCustomerErrors = selected ? {} : validateCustomerDraft(customerDraft, customers)
    setApplicationErrors(nextApplicationErrors); setCustomerErrors(nextCustomerErrors)
    if (Object.keys(nextApplicationErrors).length || Object.keys(nextCustomerErrors).length) return
    if (!selected && hasConflictingIdentity(customerDraft, customers)) { setSaveError('A matching customer already exists. Select the existing customer.'); return }
    setPending(true); setSaveError('')
    try { const result = await applicationsRepository.createWithCustomer(application, selected ? { mode: 'existing', id: selected.id } : { mode: 'new', draft: customerDraft }, effectiveActorId); onNavigate(`/customers/${encodeURIComponent(result.customer.id)}`) }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not create Application.') }
    finally { setPending(false) }
  }
  return <Workspace title="Create Application" description="Select an existing customer or add a new customer within this Application." breadcrumb={<Breadcrumb items={[{ label: 'Customers', href: '/customers' }, { label: 'Create Application' }]} />}>
    {loading ? <WorkspaceState kind="loading" title="Loading customers" /> : error ? <WorkspaceState kind="error" title="Could not load customers" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} /> : <form className="amafh-customer-form" noValidate onSubmit={event => { void submit(event) }}>
      <FormSection title="Customer type"><SelectField label="Customer Type" value={type} onValueChange={value => changeType(value as CustomerType)} options={[{ value: 'individual', label: 'Individual' }, { value: 'company', label: 'Company / Business' }]} required /></FormSection>
      <FormSection title="Match existing customer" description="Search by name, identity, mobile, or email before creating a new customer."><TextField label="Search existing customers" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={type === 'individual' ? 'Emirates ID, Passport Number, or name' : 'Trade License or Company Name'} />{suggestions.length > 0 && <div className="amafh-customer-matches" role="region" aria-label="Matching customers">{suggestions.map(item => <div key={item.id}><strong>{customerName(item)}</strong><span>{item.type === 'individual' ? `${item.emiratesId} · ${item.passportNumber}` : item.tradeLicense}</span><Button variant="secondary" size="compact" onClick={() => { setSelectedId(item.id); setCustomerErrors({}); setSaveError('') }}>Use existing customer</Button></div>)}</div>}{query && suggestions.length === 0 && <p>No matching customers found.</p>}{selected && <div className="amafh-customer-selected"><strong>Selected customer: {customerName(selected)}</strong><Button variant="secondary" size="compact" onClick={() => setSelectedId('')}>Change customer</Button></div>}</FormSection>
      {!selected && <FormSection title={type === 'individual' ? 'New Individual customer' : 'New Company / Business customer'} description="A customer is saved only when this Application is created."><CustomerFields draft={customerDraft} errors={customerErrors} onChange={value => { setCustomerDraft(value); setCustomerErrors({}); setSaveError('') }} /></FormSection>}
      <FormSection title="Application details"><div className="amafh-customer-fields"><SelectField label="Bank" value={application.bank} onValueChange={value => setApplication(current => ({ ...current, bank: value, product: '', productVariant: '' }))} options={banks.map(item => ({ value: item.name, label: item.name }))} error={applicationErrors.bank} required /><SelectField label="Product" value={application.product} onValueChange={value => setApplication(current => ({ ...current, product: value, productVariant: '' }))} options={products.map(item => ({ value: item.name, label: item.name }))} disabled={!bank} error={applicationErrors.product} required /><SelectField label="Product Variant" value={application.productVariant} onValueChange={value => changeApplication('productVariant', value)} options={variants.map(item => ({ value: item.name, label: item.name }))} disabled={!product} error={applicationErrors.productVariant} required /><TextField label="Requested Amount" type="number" min="0" value={application.requestedAmount} onChange={event => changeApplication('requestedAmount', event.target.value)} error={applicationErrors.requestedAmount} required /><SelectField label="Case Owner" value={application.caseOwnerId} onValueChange={value => changeApplication('caseOwnerId', value)} options={users.filter(item => item.status === 'active').map(item => ({ value: item.id, label: item.fullName }))} error={applicationErrors.caseOwnerId} required /></div></FormSection>
      {apiMode ? !canCreate && <FormSection title="Permission required"><p>Your User Type needs Cases: create permission.</p></FormSection> : <FormSection title="Local permission preview" description="Choose an existing acting user. The Case Create action must be enabled for their User Type in Administration → Permissions."><SelectField label="Acting user (local permission preview)" value={actorId} onValueChange={id => { setActorId(id); sessionStorage.setItem(CASE_PREVIEW_ACTOR_KEY, id); setSaveError('') }} options={users.filter(item => item.status === 'active').map(item => ({ value: item.id, label: `${item.fullName} · ${item.userType}` }))} />{!canCreate && <p>Case Create permission is required in this local preview.</p>}</FormSection>}
      {(Object.keys(customerErrors).length > 0 || Object.keys(applicationErrors).length > 0) && <p role="alert" className="amafh-customer-error">Check the highlighted fields.</p>}{saveError && <p role="alert" className="amafh-customer-error">{saveError}</p>}
      <div className="amafh-customer-actions"><Button variant="secondary" disabled={pending} onClick={() => onNavigate('/customers')}>Cancel</Button><Button type="submit" disabled={!canCreate} loading={pending}>Create Application</Button></div>
    </form>}
  </Workspace>
}
