import { banksProductsRepository } from '../administration/banks-products/banks-products'
import { mockUsersRepository } from '../administration/users/mock-users-repository'
import { readCustomerStore, writeCustomerStore } from '../customers/mock-customer-repository'
import { validateApplicationDraft, type ApplicationDraft, type ApplicationRecord } from '../customers/customer-model'
import { productStagesRepository } from '../administration/banks-products/product-stages'
import { notificationsRepository, type NotificationCategory } from '../operations/notifications'
import { requireAction } from '../operations/permissions'

export const isCaseLocked = (item: ApplicationRecord) => item.status === 'SM Approved' && Boolean(item.bankFileNumber.trim())
export type CaseAction = 'approve' | 'reject' | 'assign-coordinator' | 'submit-to-bank' | 'add-bank-file-number' | 'update-stage' | 'assign-owner' | 'edit' | 'edit-history' | 'delete'
export interface CaseChange { action: CaseAction; actorId: string; value?: string; draft?: ApplicationDraft }

export async function validateCaseDraft(draft: ApplicationDraft) {
  const errors = validateApplicationDraft(draft)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const [catalogue, users] = await Promise.all([banksProductsRepository.list(), mockUsersRepository.list()])
  const bank = catalogue.find(item => item.kind === 'banks' && item.name === draft.bank && item.status === 'active')
  const product = catalogue.find(item => item.kind === 'products' && item.name === draft.product && item.parentId === bank?.id && item.status === 'active')
  const variant = catalogue.find(item => item.kind === 'variants' && item.name === draft.productVariant && item.parentId === product?.id && item.status === 'active')
  if (!bank || !product || !variant) throw new Error('Select a valid active Bank, Product and Product Variant combination.')
  const owner = users.find(item => item.id === draft.caseOwnerId && item.status === 'active')
  if (!owner) throw new Error('Select an active existing Case Owner.')
  return owner
}

export const caseRepository = {
  async list() { return readCustomerStore().applications },
  async update(id: string, change: CaseChange): Promise<ApplicationRecord> {
    await requireAction('Cases', change.action, change.actorId)
    const store = readCustomerStore()
    const previous = store.applications.find(item => item.id === id)
    if (!previous) throw new Error('Case was not found.')
    const users = await mockUsersRepository.list()
    const actor = users.find(item => item.id === change.actorId && item.status === 'active')
    if (!actor) throw new Error('Select an active existing acting user.')
    const now = new Date().toISOString()
    const value = change.value?.trim() ?? ''
    let updated: ApplicationRecord = { ...previous, history: [...previous.history] }
    let label = ''; let detail = ''
    switch (change.action) {
      case 'edit': {
        if (isCaseLocked(previous) || previous.status !== 'Pending SM Approval') throw new Error('Original case information is protected after review or lock.')
        if (!change.draft) throw new Error('Enter application details.')
        const owner = await validateCaseDraft(change.draft)
        const catalogue = await banksProductsRepository.list()
        const bank = catalogue.find(item => item.kind === 'banks' && item.name === change.draft!.bank)
        const product = catalogue.find(item => item.kind === 'products' && item.name === change.draft!.product && item.parentId === bank?.id)
        updated = { ...updated, ...change.draft, productId: product?.id, initialCaseOwner: owner.fullName }; label = 'Application updated'; break
      }
      case 'assign-owner': {
        if (isCaseLocked(previous) || previous.status !== 'Pending SM Approval') throw new Error('Case Owner cannot be changed after review or lock.')
        const owner = users.find(item => item.id === value && item.status === 'active')
        if (!owner) throw new Error('Select an active existing Case Owner.')
        updated.caseOwnerId = owner.id; updated.initialCaseOwner = owner.fullName; label = 'Case Owner changed'; detail = owner.fullName; break
      }
      case 'approve':
      case 'reject': {
        if (previous.status !== 'Pending SM Approval') throw new Error('This case has already been reviewed.')
        updated.status = change.action === 'approve' ? 'SM Approved' : 'SM Rejected'
        updated.stage = updated.status; updated.approvalActorId = actor.id; updated.approvedAt = now
        label = updated.status; break
      }
      case 'assign-coordinator': {
        if (previous.status !== 'SM Approved') throw new Error('SM approval is required before coordinator handover.')
        const coordinator = users.find(item => item.id === value && item.status === 'active')
        if (!coordinator) throw new Error('Select an active existing Case Coordinator.')
        updated.coordinatorId = coordinator.id; label = 'Case Coordinator assigned'; detail = coordinator.fullName; break
      }
      case 'submit-to-bank':
        if (previous.status !== 'SM Approved' || !previous.coordinatorId || previous.submittedAt) throw new Error('Approve and assign a coordinator before bank submission.')
        if (previous.coordinatorId !== actor.id) throw new Error('Only the assigned Case Coordinator can submit to the bank.')
        updated.submittedAt = now; updated.stage = 'Submitted to Bank'; label = 'Submitted to Bank'; break
      case 'add-bank-file-number':
        if (previous.status !== 'SM Approved' || !previous.coordinatorId || !previous.submittedAt) throw new Error('Submit an approved case to the bank first.')
        if (previous.coordinatorId !== actor.id) throw new Error('Only the assigned Case Coordinator can add the Bank File Number.')
        if (!value || value.length > 120) throw new Error('Enter a Bank File Number of 120 characters or fewer.')
        if (previous.bankFileNumber) throw new Error('Bank File Number is already recorded.')
        updated.bankFileNumber = value; label = 'Bank File Number Added'; detail = value; break
      case 'update-stage':
        if (previous.status !== 'SM Approved' || !previous.coordinatorId || !previous.submittedAt) throw new Error('Submit the approved case before tracking stages.')
        if (previous.coordinatorId !== actor.id) throw new Error('Only the assigned Case Coordinator can update the stage.')
        {
          const catalogue = await banksProductsRepository.list()
          const bank = catalogue.find(item => item.kind === 'banks' && item.name === previous.bank)
          const product = catalogue.find(item => item.kind === 'products' && item.id === previous.productId || item.kind === 'products' && item.parentId === bank?.id && item.name === previous.product)
          if (!product) throw new Error('The Case Product is unavailable.')
          const stage = (await productStagesRepository.list(product.id)).find(item => item.id === value && item.status === 'active')
          if (!stage) throw new Error('Select an active Stage configured for this Product.')
          if (previous.stageId === stage.id) throw new Error('The Case is already in this Stage.')
          updated.stage = stage.name; updated.stageId = stage.id; updated.stageStartedAt = now; updated.stageExpectedDurationHours = stage.expectedDurationHours
          label = stage.name; detail = `Expected Duration: ${stage.expectedDurationHours} hours.`
          break
        }
      case 'edit-history':
        if (!value || value.length > 500) throw new Error('Enter history information of 500 characters or fewer.')
        label = 'Case history updated'; detail = value; break
      default: throw new Error('Unsupported case action.')
    }
    updated.history.push({ id: crypto.randomUUID(), label, actorId: actor.id, at: now, ...(detail ? { detail } : {}), ...(change.action === 'update-stage' ? { stageId: updated.stageId, expectedDurationHours: updated.stageExpectedDurationHours } : {}) })
    if (!isCaseLocked(previous) && isCaseLocked(updated)) {
      updated.lockedAt = now
      updated.history.push({ id: crypto.randomUUID(), label: 'Case Locked', actorId: actor.id, at: now })
    }
    writeCustomerStore({ ...store, applications: store.applications.map(item => item.id === id ? updated : item) })
    const category: NotificationCategory | null = change.action === 'approve' || change.action === 'reject' ? 'case-reviewed' : change.action === 'assign-coordinator' ? 'coordinator-assigned' : change.action === 'update-stage' ? 'case-stage' : change.action === 'assign-owner' ? 'case-assigned' : null
    const recipientId = change.action === 'assign-coordinator' ? updated.coordinatorId : change.action === 'assign-owner' ? updated.caseOwnerId : change.action === 'update-stage' ? updated.caseOwnerId : updated.caseOwnerId
    if (category && recipientId) try { await notificationsRepository.create({ recipientId, category, message: `${updated.caseNumber}: ${label}`, relatedType: 'case', relatedId: updated.id, actorId: actor.id }) } catch { /* Case history remains authoritative. */ }
    return updated
  },
  async remove(id: string, actorId: string) {
    await requireAction('Cases', 'delete', actorId)
    const store = readCustomerStore(); const item = store.applications.find(item => item.id === id)
    if (!item) throw new Error('Case was not found.')
    if (item.status !== 'Pending SM Approval' || item.submittedAt || item.bankFileNumber || item.history.length > 1) throw new Error('Cannot delete a reviewed or changed Case: its history must be preserved.')
    writeCustomerStore({ ...store, applications: store.applications.filter(record => record.id !== id) })
  },
}
