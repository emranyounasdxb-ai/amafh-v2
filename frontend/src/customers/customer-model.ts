export type CustomerType = 'individual' | 'company'
export type CustomerStatus = 'active' | 'inactive'
export interface IndividualDraft { type: 'individual'; emiratesId: string; passportNumber: string; fullName: string; employer: string; mobile: string; email: string }
export interface CompanyDraft { type: 'company'; companyName: string; contactPerson: string; tradeLicense: string; mobile: string; email: string }
export type CustomerDraft = IndividualDraft | CompanyDraft
export interface CustomerHistoryEntry { id: string; label: string; at: string }
export type CustomerRecord = (IndividualDraft | CompanyDraft) & { id: string; status: CustomerStatus; createdAt: string; updatedAt: string; history: CustomerHistoryEntry[] }
export interface ApplicationDraft { bank: string; product: string; productVariant: string; requestedAmount: string; caseOwnerId: string }
export interface CaseHistoryEntry { id: string; label: string; actorId: string; at: string; detail?: string; stageId?: string; expectedDurationHours?: number }
export interface ApplicationRecord extends ApplicationDraft { id: string; customerId: string; createdAt: string; caseNumber: string; initialCaseOwner: string; status: 'Pending SM Approval' | 'SM Approved' | 'SM Rejected'; stage: string; productId?: string; stageId?: string; stageStartedAt?: string; stageExpectedDurationHours?: number; approvalActorId: string; approvedAt: string; coordinatorId: string; submittedAt: string; bankFileNumber: string; lockedAt: string; history: CaseHistoryEntry[] }
export type CustomerErrors = Record<string, string>
export const emptyIndividual = (): IndividualDraft => ({ type: 'individual', emiratesId: '', passportNumber: '', fullName: '', employer: '', mobile: '', email: '' })
export const emptyCompany = (): CompanyDraft => ({ type: 'company', companyName: '', contactPerson: '', tradeLicense: '', mobile: '', email: '' })
export const customerName = (customer: CustomerDraft | CustomerRecord) => customer.type === 'individual' ? customer.fullName : customer.companyName
export const normalizeIdentity = (value: string) => value.trim().replace(/[\s-]/g, '').toLocaleUpperCase()
const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
export function findCustomerMatches(draft: CustomerDraft, customers: CustomerRecord[]): CustomerRecord[] {
  if (draft.type === 'individual') return customers.filter(customer => customer.type === 'individual' && (Boolean(draft.emiratesId.trim()) && normalizeIdentity(customer.emiratesId) === normalizeIdentity(draft.emiratesId) || Boolean(draft.passportNumber.trim()) && normalizeIdentity(customer.passportNumber) === normalizeIdentity(draft.passportNumber)))
  return customers.filter(customer => customer.type === 'company' && (Boolean(draft.tradeLicense.trim()) && normalizeIdentity(customer.tradeLicense) === normalizeIdentity(draft.tradeLicense) || Boolean(draft.companyName.trim()) && normalizeName(customer.companyName) === normalizeName(draft.companyName)))
}
export function hasConflictingIdentity(draft: CustomerDraft, customers: CustomerRecord[]): boolean {
  if (draft.type === 'individual') return findCustomerMatches(draft, customers).length > 0
  return Boolean(draft.tradeLicense.trim()) && customers.some(customer => customer.type === 'company' && normalizeIdentity(customer.tradeLicense) === normalizeIdentity(draft.tradeLicense))
}
export function validateCustomerDraft(draft: CustomerDraft, customers: CustomerRecord[], editingId?: string): CustomerErrors {
  const errors: CustomerErrors = {}
  if (draft.type === 'individual') {
    if (!draft.fullName.trim()) errors.fullName = 'Full Name is required.'
    else if (draft.fullName.trim().length > 120) errors.fullName = 'Use 120 characters or fewer.'
    const others = customers.filter((customer): customer is CustomerRecord & IndividualDraft => customer.type === 'individual' && customer.id !== editingId)
    if (draft.emiratesId.trim() && others.some(customer => normalizeIdentity(customer.emiratesId) === normalizeIdentity(draft.emiratesId))) errors.emiratesId = 'Emirates ID is already assigned to another Individual customer.'
    if (draft.passportNumber.trim() && others.some(customer => normalizeIdentity(customer.passportNumber) === normalizeIdentity(draft.passportNumber))) errors.passportNumber = 'Passport Number is already assigned to another Individual customer.'
  } else {
    if (!draft.companyName.trim()) errors.companyName = 'Company Name is required.'
    else if (draft.companyName.trim().length > 120) errors.companyName = 'Use 120 characters or fewer.'
  }
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = 'Enter a valid email address.'
  for (const key of ['mobile', 'email'] as const) if (draft[key].length > 120) errors[key] = 'Use 120 characters or fewer.'
  return errors
}
export function validateApplicationDraft(draft: ApplicationDraft): CustomerErrors {
  const errors: CustomerErrors = {}
  if (!draft.bank.trim()) errors.bank = 'Bank is required.'
  if (!draft.product.trim()) errors.product = 'Product is required.'
  if (!draft.productVariant.trim()) errors.productVariant = 'Product Variant is required.'
  if (!draft.caseOwnerId.trim()) errors.caseOwnerId = 'Case Owner is required.'
  if (!draft.requestedAmount.trim() || !Number.isFinite(Number(draft.requestedAmount)) || Number(draft.requestedAmount) <= 0) errors.requestedAmount = 'Enter a positive Requested Amount.'
  return errors
}
