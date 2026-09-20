import type { ManagedRecord } from '../administration/managed/managed-model'
import type { UserRecord } from '../administration/users/users-model'
import type { ApplicationRepository, CustomerRepository } from './mock-customer-repository'
import type { ApplicationDraft, ApplicationRecord, CustomerDraft, CustomerRecord } from './customer-model'

type ApiCustomer = { id: string; type: 'individual' | 'company'; emirates_id: string; passport_number: string; full_name: string; employer: string; company_name: string; contact_person: string; trade_license: string; mobile: string; email: string; active: boolean; created_at: string; updated_at: string; history: { id: string; label: string; at: string }[] }
type ApiApplication = { id: string; customer_id: string; case_number: string; case_owner_id: string; bank_id: string; product_id: string; variant_id: string; requested_amount: string; status: ApplicationRecord['status']; created_at: string; bank?: string; product?: string; product_variant?: string; case_owner?: string }
type ApiCatalogue = { id: string; kind: 'banks' | 'products' | 'variants'; name: string; parent_id: string | null; active: boolean }
type ApiUser = { id: string; name: string; email: string }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  if (!response.ok) {
    let message = 'Could not load application data.'
    try { const body: { error?: { message?: string } } = await response.json(); message = body.error?.message ?? message } catch { /* Keep the recoverable default. */ }
    throw new Error(message)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

const fromApi = (item: ApiCustomer): CustomerRecord => item.type === 'individual'
  ? { id: item.id, type: 'individual', emiratesId: item.emirates_id, passportNumber: item.passport_number, fullName: item.full_name, employer: item.employer, mobile: item.mobile, email: item.email, status: item.active ? 'active' : 'inactive', createdAt: item.created_at, updatedAt: item.updated_at, history: item.history }
  : { id: item.id, type: 'company', companyName: item.company_name, contactPerson: item.contact_person, tradeLicense: item.trade_license, mobile: item.mobile, email: item.email, status: item.active ? 'active' : 'inactive', createdAt: item.created_at, updatedAt: item.updated_at, history: item.history }
const toApi = (draft: CustomerDraft) => draft.type === 'individual'
  ? { type: 'individual', emirates_id: draft.emiratesId, passport_number: draft.passportNumber, full_name: draft.fullName, employer: draft.employer, mobile: draft.mobile, email: draft.email }
  : { type: 'company', company_name: draft.companyName, contact_person: draft.contactPerson, trade_license: draft.tradeLicense, mobile: draft.mobile, email: draft.email }

export const apiCustomerRepository: CustomerRepository = {
  async list() { return (await request<ApiCustomer[]>('/customers')).map(fromApi) },
  async update(id, draft, status) { return fromApi(await request<ApiCustomer>(`/customers/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ customer: toApi(draft), active: status === 'active' }) })) },
  async remove(id) { await request<void>(`/customers/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
}

export async function loadApiCatalogue(): Promise<ManagedRecord[]> {
  return (await request<ApiCatalogue[]>('/catalogue')).map(item => ({ id: item.id, kind: item.kind, name: item.name, parentId: item.parent_id ?? '', status: item.active ? 'active' : 'inactive', description: '', extra: '', createdAt: '', updatedAt: '' }))
}

export async function loadApiCaseOwners(): Promise<UserRecord[]> {
  return (await request<ApiUser[]>('/auth/users')).map(item => ({ id: item.id, fullName: item.name, email: item.email, status: 'active', userType: '', reportingManagerId: '', organization: '', organizationScope: 'organization', officeBranch: '', department: '', team: '' }))
}

function applicationFromApi(item: ApiApplication, catalogue: ManagedRecord[] = [], owners: UserRecord[] = []): ApplicationRecord {
  const bank = item.bank ?? catalogue.find(record => record.id === item.bank_id)?.name ?? ''
  const product = item.product ?? catalogue.find(record => record.id === item.product_id)?.name ?? ''
  const productVariant = item.product_variant ?? catalogue.find(record => record.id === item.variant_id)?.name ?? ''
  const initialCaseOwner = item.case_owner ?? owners.find(user => user.id === item.case_owner_id)?.fullName ?? ''
  return { id: item.id, customerId: item.customer_id, caseNumber: item.case_number, caseOwnerId: item.case_owner_id, initialCaseOwner, bank, product, productVariant, productId: item.product_id, requestedAmount: String(item.requested_amount ?? ''), createdAt: item.created_at, status: item.status, stage: 'Case Created', approvalActorId: '', approvedAt: '', coordinatorId: '', submittedAt: '', bankFileNumber: '', lockedAt: '', history: [] }
}

export const apiApplicationRepository: ApplicationRepository = {
  async list() { return (await request<ApiApplication[]>('/applications')).map(item => applicationFromApi(item)) },
  async createWithCustomer(draft: ApplicationDraft, selection) {
    const [catalogue, owners] = await Promise.all([loadApiCatalogue(), loadApiCaseOwners()])
    const bank = catalogue.find(item => item.kind === 'banks' && item.name === draft.bank && item.status === 'active')
    const product = catalogue.find(item => item.kind === 'products' && item.name === draft.product && item.parentId === bank?.id && item.status === 'active')
    const variant = catalogue.find(item => item.kind === 'variants' && item.name === draft.productVariant && item.parentId === product?.id && item.status === 'active')
    if (!bank || !product || !variant) throw new Error('Select a valid active Bank, Product and Product Variant combination.')
    const payload = { bank_id: bank.id, product_id: product.id, variant_id: variant.id, case_owner_id: draft.caseOwnerId, requested_amount: draft.requestedAmount, ...(selection.mode === 'existing' ? { customer_id: selection.id } : { new_customer: toApi(selection.draft) }) }
    const created = await request<ApiApplication>('/applications', { method: 'POST', body: JSON.stringify(payload) })
    const customer = (await apiCustomerRepository.list()).find(item => item.id === created.customer_id)
    if (!customer) throw new Error('Application was saved, but its customer could not be reloaded.')
    return { application: applicationFromApi(created, catalogue, owners), customer }
  },
}
