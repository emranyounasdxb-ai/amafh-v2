import { customerName, hasConflictingIdentity, validateApplicationDraft, validateCustomerDraft, type ApplicationDraft, type ApplicationRecord, type CustomerDraft, type CustomerHistoryEntry, type CustomerRecord, type CustomerStatus } from './customer-model'
import { banksProductsRepository } from '../administration/banks-products/banks-products'
import { mockUsersRepository } from '../administration/users/mock-users-repository'
import { notificationsRepository } from '../operations/notifications'
import { requireAction } from '../operations/permissions'

export const CUSTOMER_STORAGE_KEY = 'amafh-v2.mock-customer-management.v1'
const seedTime = '2026-09-19T00:00:00.000Z'
const history = (id: string): CustomerHistoryEntry[] => [{ id: `${id}-created`, label: 'Customer created', at: seedTime }]
const seedCustomers: CustomerRecord[] = [
  { id: 'sample-individual-1', type: 'individual', emiratesId: '784-1990-0000000-1', passportNumber: 'P0000001', fullName: 'Aisha Rahman', employer: 'Sample Employer', mobile: '0500000001', email: 'aisha@example.test', status: 'active', createdAt: seedTime, updatedAt: seedTime, history: history('sample-individual-1') },
  { id: 'sample-individual-2', type: 'individual', emiratesId: '784-1988-0000000-2', passportNumber: 'P0000002', fullName: 'Omar Hassan', employer: 'Example Employer', mobile: '0500000002', email: 'omar@example.test', status: 'inactive', createdAt: seedTime, updatedAt: seedTime, history: history('sample-individual-2') },
  { id: 'sample-company-1', type: 'company', companyName: 'Gulf Sample Trading LLC', contactPerson: 'Mariam Ali', tradeLicense: 'TL-00001', mobile: '0500000003', email: 'contact@example.test', status: 'active', createdAt: seedTime, updatedAt: seedTime, history: history('sample-company-1') },
]
const seedApplications: ApplicationRecord[] = [
  ...[['sample-case-1', 'sample-individual-1', 'Sample Variant', '100000'], ['sample-case-2', 'sample-individual-1', 'Another Variant', '50000'], ['sample-case-3', 'sample-company-1', 'Business Variant', '250000']].map(([id, customerId, productVariant, requestedAmount], index) => ({ id, customerId, bank: 'Sample Bank', product: 'Sample Product', productId: 'sample-product-1', productVariant, requestedAmount, caseOwnerId: 'sample-aisha', initialCaseOwner: 'Aisha Rahman', createdAt: seedTime, caseNumber: `CASE-${String(index + 1).padStart(4, '0')}`, status: 'Pending SM Approval' as const, stage: 'Case Created', approvalActorId: '', approvedAt: '', coordinatorId: '', submittedAt: '', bankFileNumber: '', lockedAt: '', history: [{ id: `${id}-created`, label: 'Case Created', actorId: 'sample-aisha', at: seedTime, detail: 'Customer attached and application submitted.' }] })),
]
export interface CustomerStore { customers: CustomerRecord[]; applications: ApplicationRecord[] }
function isCustomer(value: unknown): value is CustomerRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || (item.type !== 'individual' && item.type !== 'company') || (item.status !== 'active' && item.status !== 'inactive') || typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string' || !Array.isArray(item.history) || !item.history.every(event => event && typeof event.id === 'string' && typeof event.label === 'string' && typeof event.at === 'string')) return false
  const fields = item.type === 'individual' ? ['emiratesId', 'passportNumber', 'fullName', 'employer', 'mobile', 'email'] : ['companyName', 'contactPerson', 'tradeLicense', 'mobile', 'email']
  return fields.every(field => typeof item[field] === 'string')
}
function isApplication(value: unknown): value is ApplicationRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['id', 'customerId', 'bank', 'product', 'productVariant', 'requestedAmount', 'initialCaseOwner', 'createdAt'].every(field => typeof item[field] === 'string')
}
export function readCustomerStore(): CustomerStore {
  let raw: string | null
  try { raw = localStorage.getItem(CUSTOMER_STORAGE_KEY) } catch { throw new Error('Local customer data is unavailable.') }
  if (raw === null) return { customers: structuredClone(seedCustomers), applications: structuredClone(seedApplications) }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1) {
      const candidate = parsed as { customers?: unknown; applications?: unknown }
      if (Array.isArray(candidate.customers) && Array.isArray(candidate.applications) && candidate.customers.every(isCustomer) && candidate.applications.every(isApplication)) {
        const customers = candidate.customers as CustomerRecord[]
        const applications = candidate.applications as ApplicationRecord[]
        if (new Set(customers.map(item => item.id)).size === customers.length && new Set(applications.map(item => item.id)).size === applications.length && customers.every(item => Object.keys(validateCustomerDraft(item, customers, item.id)).length === 0) && applications.every(item => customers.some(customer => customer.id === item.customerId))) return structuredClone({ customers, applications: applications.map(item => ({ ...item, caseOwnerId: item.caseOwnerId ?? '', caseNumber: item.caseNumber ?? item.id, status: item.status ?? 'Pending SM Approval', stage: item.stage ?? 'Case Created', approvalActorId: item.approvalActorId ?? '', approvedAt: item.approvedAt ?? '', coordinatorId: item.coordinatorId ?? '', submittedAt: item.submittedAt ?? '', bankFileNumber: item.bankFileNumber ?? '', lockedAt: item.lockedAt ?? '', history: item.history ?? [{ id: `${item.id}-created`, label: 'Case Created', actorId: '', at: item.createdAt }] })) })
      }
    }
  } catch { /* Invalid local data is reported below. */ }
  throw new Error('Local customer data could not be read.')
}
export function writeCustomerStore(store: CustomerStore) { try { localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ version: 1, ...store })) } catch { throw new Error('Could not save local customer data.') } }
const read = readCustomerStore
const write = writeCustomerStore
export interface CustomerRepository { list(): Promise<CustomerRecord[]>; update(id: string, draft: CustomerDraft, status: CustomerStatus, actorId: string): Promise<CustomerRecord>; remove(id: string, actorId: string): Promise<void> }
export interface ApplicationRepository { list(): Promise<ApplicationRecord[]>; createWithCustomer(draft: ApplicationDraft, customer: { mode: 'existing'; id: string } | { mode: 'new'; draft: CustomerDraft }, actorId: string): Promise<{ application: ApplicationRecord; customer: CustomerRecord }> }
export const mockCustomerRepository: CustomerRepository = {
  async list() { return read().customers },
  async update(id, draft, status, actorId) {
    await requireAction('Customers', 'edit', actorId)
    const store = read(); const previous = store.customers.find(item => item.id === id)
    if (!previous) throw new Error('Customer was not found.')
    if (draft.type !== previous.type || (status !== 'active' && status !== 'inactive')) throw new Error('Invalid customer update.')
    const errors = validateCustomerDraft(draft, store.customers, id)
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
    const now = new Date().toISOString()
    const updated: CustomerRecord = { ...draft, id, status, createdAt: previous.createdAt, updatedAt: now, history: [...previous.history, { id: crypto.randomUUID(), label: status !== previous.status ? `Status changed to ${status}` : 'Customer updated', at: now }] }
    write({ ...store, customers: store.customers.map(item => item.id === id ? updated : item) }); return updated
  },
  async remove(id, actorId) { await requireAction('Customers', 'delete', actorId); const store = read(); const customer = store.customers.find(item => item.id === id); if (!customer) throw new Error('Customer was not found.'); const count = store.applications.filter(item => item.customerId === id).length; if (count) throw new Error(`Cannot delete ${customerName(customer)}: ${count} related ${count === 1 ? 'Case depends' : 'Cases depend'} on this customer.`); write({ ...store, customers: store.customers.filter(item => item.id !== id) }) },
}
export const mockApplicationRepository: ApplicationRepository = {
  async list() { return read().applications },
  async createWithCustomer(draft, selection, actorId) {
    await requireAction('Cases', 'create', actorId)
    const store = read(); const applicationErrors = validateApplicationDraft(draft)
    if (Object.keys(applicationErrors).length) throw new Error(Object.values(applicationErrors)[0])
    const [catalogue, users] = await Promise.all([banksProductsRepository.list(), mockUsersRepository.list()])
    const bank = catalogue.find(item => item.kind === 'banks' && item.name === draft.bank && item.status === 'active')
    const product = catalogue.find(item => item.kind === 'products' && item.name === draft.product && item.parentId === bank?.id && item.status === 'active')
    const variant = catalogue.find(item => item.kind === 'variants' && item.name === draft.productVariant && item.parentId === product?.id && item.status === 'active')
    if (!bank || !product || !variant) throw new Error('Select a valid active Bank, Product and Product Variant combination.')
    const owner = users.find(item => item.id === draft.caseOwnerId && item.status === 'active')
    if (!owner) throw new Error('Select an active existing Case Owner.')
    let customer: CustomerRecord
    if (selection.mode === 'existing') {
      const existing = store.customers.find(item => item.id === selection.id)
      if (!existing) throw new Error('Select an existing customer.')
      customer = existing
    } else {
      const errors = validateCustomerDraft(selection.draft, store.customers)
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
      if (hasConflictingIdentity(selection.draft, store.customers)) throw new Error('A matching customer already exists. Select the existing customer.')
      const now = new Date().toISOString(); const id = crypto.randomUUID()
      customer = { ...selection.draft, id, status: 'active', createdAt: now, updatedAt: now, history: [{ id: crypto.randomUUID(), label: 'Customer created through Application', at: now }] }
      store.customers.push(customer)
    }
    const now = new Date().toISOString(); const id = crypto.randomUUID()
    const application: ApplicationRecord = { ...draft, id, customerId: customer.id, createdAt: now, productId: product.id, initialCaseOwner: owner.fullName, caseNumber: `CASE-${id.slice(0, 8).toUpperCase()}`, status: 'Pending SM Approval', stage: 'Case Created', approvalActorId: '', approvedAt: '', coordinatorId: '', submittedAt: '', bankFileNumber: '', lockedAt: '', history: [{ id: crypto.randomUUID(), label: 'Case Created', actorId: owner.id, at: now, detail: 'Customer attached and application submitted.' }] }
    store.applications.push(application)
    store.customers = store.customers.map(item => item.id === customer.id ? { ...item, updatedAt: now, history: [...item.history, { id: crypto.randomUUID(), label: 'Application linked', at: now }] } : item)
    write(store)
    try { await notificationsRepository.create({ recipientId: owner.id, category: 'case-assigned', message: `${application.caseNumber}: Case Owner assigned`, relatedType: 'case', relatedId: application.id, actorId: owner.id }) } catch { /* Customer and Case remain saved. */ }
    return { application, customer: store.customers.find(item => item.id === customer.id)! }
  },
}
