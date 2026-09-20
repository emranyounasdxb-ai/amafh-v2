import type { ApplicationDraft, ApplicationRecord } from '../customers/customer-model'
import { loadApiCatalogue, loadApiCaseOwners } from '../customers/api-customer-repository'
import type { CaseAction, CaseChange } from './case-repository'

type ApiCase = { id: string; case_number: string; customer_id: string; case_owner_id: string; case_owner: string; bank_id: string; product_id: string; variant_id: string; bank: string; product: string; product_variant: string; requested_amount: string; status: ApplicationRecord['status']; created_at: string; coordinator_id?: string | null; submitted_at?: string | null; bank_file_number?: string | null; locked_at?: string | null; approval_actor_id?: string | null; approved_at?: string | null; current_stage_id?: string | null; stage_name?: string | null; stage_started_at?: string | null; stage_expected_duration_hours?: string | null; history?: { id: string; event: string; actor_id: string; at: string; detail: string; stage_id?: string; expected_duration_hours?: string }[] }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/applications${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  if (!response.ok) {
    let message = 'Could not load Case data.'
    try { const body: { error?: { message?: string } } = await response.json(); message = body.error?.message ?? message } catch { /* Keep recoverable default. */ }
    throw new Error(message)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

function fromApi(item: ApiCase): ApplicationRecord {
  return { id: item.id, customerId: item.customer_id, caseNumber: item.case_number,
    caseOwnerId: item.case_owner_id, initialCaseOwner: item.case_owner,
    bank: item.bank, product: item.product, productVariant: item.product_variant,
    productId: item.product_id, requestedAmount: String(item.requested_amount ?? ''),
    status: item.status, stage: item.stage_name || (item.submitted_at ? 'Submitted to Bank' : item.status === 'Pending SM Approval' ? 'Case Created' : item.status),
    createdAt: item.created_at, approvalActorId: item.approval_actor_id ?? '', approvedAt: item.approved_at ?? '',
    coordinatorId: item.coordinator_id ?? '', submittedAt: item.submitted_at ?? '',
    bankFileNumber: item.bank_file_number ?? '', lockedAt: item.locked_at ?? '',
    stageId: item.current_stage_id ?? undefined, stageStartedAt: item.stage_started_at ?? undefined,
    stageExpectedDurationHours: item.stage_expected_duration_hours ? Number(item.stage_expected_duration_hours) : undefined,
    history: (item.history ?? []).map(entry => ({ id: entry.id, label: entry.event, actorId: entry.actor_id, at: entry.at, detail: entry.detail,
      ...(entry.stage_id ? { stageId: entry.stage_id } : {}),
      ...(entry.expected_duration_hours ? { expectedDurationHours: Number(entry.expected_duration_hours) } : {}) })) }
}

async function resolveDraft(draft: ApplicationDraft) {
  const [catalogue, owners] = await Promise.all([loadApiCatalogue(), loadApiCaseOwners()])
  const bank = catalogue.find(item => item.kind === 'banks' && item.name === draft.bank && item.status === 'active')
  const product = catalogue.find(item => item.kind === 'products' && item.name === draft.product && item.parentId === bank?.id && item.status === 'active')
  const variant = catalogue.find(item => item.kind === 'variants' && item.name === draft.productVariant && item.parentId === product?.id && item.status === 'active')
  if (!bank || !product || !variant || !owners.some(owner => owner.id === draft.caseOwnerId)) throw new Error('Select a valid active Bank, Product, Variant and Case Owner.')
  return { bank_id: bank.id, product_id: product.id, variant_id: variant.id, case_owner_id: draft.caseOwnerId, requested_amount: draft.requestedAmount }
}

export const apiCaseRepository = {
  async list(): Promise<ApplicationRecord[]> { return (await request<ApiCase[]>('')).map(fromApi) },
  async detail(id: string): Promise<ApplicationRecord> { return fromApi(await request<ApiCase>(`/${encodeURIComponent(id)}`)) },
  async update(id: string, change: CaseChange): Promise<ApplicationRecord> {
    const draft = change.action === 'edit' ? change.draft : undefined
    await request<{ status: string }>(`/${encodeURIComponent(id)}/actions`, { method: 'POST', body: JSON.stringify({ action: change.action as CaseAction, value: change.value ?? '', ...(draft ? { draft: await resolveDraft(draft) } : {}) }) })
    return this.detail(id)
  },
  async remove(id: string): Promise<void> { await request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
}
