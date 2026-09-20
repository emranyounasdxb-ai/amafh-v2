import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { DataTable, type DataTableColumn } from '../components/data-table/data-table'
import { WorkspaceState } from '../components/feedback/workspace-state'
import { Dialog } from '../components/overlays/dialog'
import { SelectField } from '../components/ui/select-field'
import { Breadcrumb } from '../components/navigation/breadcrumb'
import { Workspace } from '../templates/workspace'
import { ActivityTimeline, DetailSection, FormSection, ProfileHeader } from '../patterns/shared-patterns'
import { CustomerFields } from './customer-fields'
import { customerName, validateCustomerDraft, type ApplicationRecord, type CustomerDraft, type CustomerErrors, type CustomerRecord, type CustomerStatus } from './customer-model'
import { mockApplicationRepository, mockCustomerRepository, type ApplicationRepository, type CustomerRepository } from './mock-customer-repository'
import { apiApplicationRepository, apiCustomerRepository } from './api-customer-repository'
import type { CustomerRoute } from './customer-routes'
import { usePermissionPreview, requireAction } from '../operations/permissions'
import { PermissionActor, PermissionGate } from '../operations/ui'
import './customer.css'

const detailPath = (id: string) => `/customers/${encodeURIComponent(id)}`
const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
function CustomerEditForm({ customer, customers, onSave, onCancel }: { customer: CustomerRecord; customers: CustomerRecord[]; onSave: (draft: CustomerDraft, status: CustomerStatus) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<CustomerDraft>(() => ({ ...customer }))
  const [status, setStatus] = useState<CustomerStatus>(customer.status)
  const [errors, setErrors] = useState<CustomerErrors>({})
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const save = async () => { setPending(true); setSaveError(''); try { await onSave(draft, status); setConfirmOpen(false) } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not save customer.') } finally { setPending(false) } }
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (pending) return; const next = validateCustomerDraft(draft, customers, customer.id); setErrors(next); if (Object.keys(next).length) return; if (customer.status === 'active' && status === 'inactive') setConfirmOpen(true); else void save() }
  return <form className="amafh-customer-form" noValidate onSubmit={submit}><FormSection title={customer.type === 'individual' ? 'Individual customer' : 'Company / Business customer'}><div className="amafh-customer-fields"><SelectField label="Status" value={status} onValueChange={value => setStatus(value as CustomerStatus)} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></div><CustomerFields draft={draft} errors={errors} onChange={value => { setDraft(value); setErrors({}); setSaveError('') }} /></FormSection>{Object.keys(errors).length > 0 && <p role="alert" className="amafh-customer-error">Check the highlighted fields.</p>}{saveError && <p role="alert" className="amafh-customer-error">{saveError}</p>}<div className="amafh-customer-actions"><Button variant="secondary" disabled={pending} onClick={onCancel}>Cancel</Button><Button type="submit" loading={pending}>Save changes</Button></div><Dialog open={confirmOpen} onClose={() => { if (!pending) setConfirmOpen(false) }} title="Deactivate Customer" description={`Set ${customerName(customer)} to Inactive? Related Cases remain linked.`} actions={<><Button variant="secondary" disabled={pending} onClick={() => setConfirmOpen(false)}>Cancel</Button><Button variant="danger" loading={pending} onClick={() => { void save() }}>Deactivate</Button></>}>{saveError && <p role="alert" className="amafh-customer-error">{saveError}</p>}</Dialog></form>
}

export function CustomerPage({ route, onNavigate, customersRepository = apiMode ? apiCustomerRepository : mockCustomerRepository, applicationsRepository = apiMode ? apiApplicationRepository : mockApplicationRepository }: { route: CustomerRoute; onNavigate: (path: string) => void; customersRepository?: CustomerRepository; applicationsRepository?: ApplicationRepository }) {
  const preview = usePermissionPreview()
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const reload = useCallback(async () => { setLoading(true); setError(''); try { const [nextCustomers, nextApplications] = await Promise.all([customersRepository.list(), applicationsRepository.list()]); setCustomers(nextCustomers); setApplications(nextApplications) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load customers.') } finally { setLoading(false) } }, [customersRepository, applicationsRepository])
  useEffect(() => { void reload() }, [reload])
  const title = route.mode === 'list' ? 'Customers' : route.mode === 'edit' ? 'Edit Customer' : 'Customer detail'
  const breadcrumb = route.mode === 'list' ? [{ label: 'Customers' }] : [{ label: 'Customers', href: '/customers' }, { label: title }]
  const columns = useMemo<DataTableColumn<CustomerRecord>[]>(() => [
    { id: 'name', header: 'Customer', value: customerName, width: 220 },
    { id: 'type', header: 'Type', value: item => item.type === 'individual' ? 'Individual' : 'Company / Business', width: 170 },
    { id: 'identifier', header: 'Identity', value: item => item.type === 'individual' ? item.emiratesId || item.passportNumber : item.tradeLicense, width: 180 },
    { id: 'mobile', header: 'Mobile', value: item => item.mobile, width: 150 },
    { id: 'status', header: 'Status', value: item => item.status, width: 120, cell: item => <Badge tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
    { id: 'applications', header: 'Cases', value: item => applications.filter(application => application.customerId === item.id).length, width: 170 },
  ], [applications])
  if (route.mode === 'list') return <Workspace title={title} description="Independent customer master records" breadcrumb={<Breadcrumb items={breadcrumb} />} actions={preview.can('Cases', 'create') && <Button onClick={() => onNavigate('/applications/new')}>Create Application</Button>}><PermissionActor preview={preview} /><PermissionGate preview={preview} domain="Customers" action="view"><DataTable tableId="customers" caption="Customers" columns={columns} rows={customers} rowId={item => item.id} state={loading ? 'loading' : error ? 'error' : 'ready'} error={error} onRetry={() => { void reload() }} onRefresh={() => { void reload() }} filters={item => (typeFilter === 'all' || item.type === typeFilter) && (statusFilter === 'all' || item.status === statusFilter)} filterControls={<div className="amafh-customer-filters"><SelectField label="Customer Type" value={typeFilter} onValueChange={setTypeFilter} options={[{ value: "all", label: "All types" }, { value: "individual", label: "Individual" }, { value: "company", label: "Company / Business" }]} /><SelectField label="Status" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></div>} rowActions={item => <Button variant="secondary" size="compact" onClick={() => onNavigate(detailPath(item.id))}>View</Button>} /></PermissionGate></Workspace>
  if (loading) return <Workspace title={title}><WorkspaceState kind="loading" title="Loading customer" /></Workspace>
  if (error) return <Workspace title={title}><WorkspaceState kind="error" title="Could not load customer" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} /></Workspace>
  const customer = customers.find(item => item.id === route.id)
  if (!customer) return <Workspace title={title}><WorkspaceState kind="error" title="Customer not found" action={<Button onClick={() => onNavigate('/customers')}>Back to Customers</Button>} /></Workspace>
  if (route.mode === 'edit') return <Workspace title={title} breadcrumb={<Breadcrumb items={breadcrumb} />}><PermissionActor preview={preview} /><PermissionGate preview={preview} domain="Customers" action="edit"><CustomerEditForm key={customer.id} customer={customer} customers={customers} onCancel={() => onNavigate(detailPath(customer.id))} onSave={async (draft, status) => { await requireAction('Customers', 'edit', preview.actorId); const updated = await customersRepository.update(customer.id, draft, status, preview.actorId); setCustomers(current => current.map(item => item.id === customer.id ? updated : item)); onNavigate(detailPath(customer.id)) }} /></PermissionGate></Workspace>
  const related = applications.filter(item => item.customerId === customer.id)
  const remove = async () => { if (deletePending || related.length) return; setDeletePending(true); setDeleteError(''); try { await requireAction('Customers', 'delete', preview.actorId); await customersRepository.remove(customer.id, preview.actorId); setCustomers(current => current.filter(item => item.id !== customer.id)); setDeleteOpen(false); onNavigate('/customers') } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'Could not delete customer.') } finally { setDeletePending(false) } }
  const fields = customer.type === 'individual' ? [{ label: 'Emirates ID', value: customer.emiratesId }, { label: 'Passport Number', value: customer.passportNumber }, { label: 'Full Name', value: customer.fullName }, { label: 'Employer', value: customer.employer }] : [{ label: 'Company Name', value: customer.companyName }, { label: 'Contact Person', value: customer.contactPerson }, { label: 'Trade License', value: customer.tradeLicense }]
  return <Workspace title={title} breadcrumb={<Breadcrumb items={breadcrumb} />}><PermissionActor preview={preview} /><PermissionGate preview={preview} domain="Customers" action="view"><div className="amafh-customer-detail"><ProfileHeader name={customerName(customer)} subtitle={customer.type === 'individual' ? 'Individual' : 'Company / Business'} status={customer.status === 'active' ? 'Active' : 'Inactive'} statusTone={customer.status === 'active' ? 'success' : 'neutral'} actions={<>{preview.can('Customers', 'edit') && <Button onClick={() => onNavigate(`${detailPath(customer.id)}/edit`)}>Edit Customer</Button>}{preview.can('Customers', 'delete') && <Button variant="danger" onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>Delete Customer</Button>}</>} /><DetailSection title="Customer information" items={[...fields, { label: 'Mobile', value: customer.mobile }, { label: 'Email', value: customer.email }, { label: 'Status', value: customer.status }, { label: 'Customer ID', value: customer.id }, { label: 'Created', value: new Date(customer.createdAt).toLocaleDateString() }, { label: 'Updated', value: new Date(customer.updatedAt).toLocaleDateString() }]} /><FormSection title="Related Cases" description={`${related.length} linked ${related.length === 1 ? 'Case' : 'Cases'}`}><div className="amafh-customer-related">{related.length ? related.map(item => <div key={item.id}><strong>{item.id}</strong><span>{item.bank} · {item.product} · {item.productVariant}</span><span>Requested Amount: {item.requestedAmount}</span><span>Initial Case Owner: {item.initialCaseOwner}</span><Button variant="secondary" size="compact" onClick={() => onNavigate(`/cases/${encodeURIComponent(item.id)}`)}>Open Case</Button></div>) : <p>No Cases are linked.</p>}</div></FormSection><ActivityTimeline title="Customer history" events={customer.history.map(item => ({ id: item.id, title: item.label, time: new Date(item.at).toLocaleString() }))} /><Dialog open={deleteOpen} onClose={() => { if (!deletePending) setDeleteOpen(false) }} title="Delete Customer" description={related.length ? `Cannot delete ${customerName(customer)}: ${related.length} related ${related.length === 1 ? 'Case depends' : 'Cases depend'} on this customer.` : `Delete ${customerName(customer)}? This removes the local customer record.`} actions={<><Button variant="secondary" disabled={deletePending} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" disabled={related.length > 0} loading={deletePending} onClick={() => { void remove() }}>Delete</Button></>}>{deleteError && <p role="alert" className="amafh-customer-error">{deleteError}</p>}</Dialog></div></PermissionGate></Workspace>
}
