import { loadApiCatalogue } from '../customers/api-customer-repository'
import type { ClawbackRecord, CommissionRule, CommissionRuleDraft, CommissionRecord, FinanceStore, IncentiveDraft, IncentiveRecord, IncentiveRule } from './finance'

type ApiRule = { id: string; bank_id: string; product_id: string | null; variant_id: string | null; method: CommissionRule['method']; value: string; effective_from: string; effective_until: string | null; active: boolean; created_at: string; updated_at: string }
type ApiCommission = { id: string; case_id: string; case_owner_id: string; rule_id: string; basis: string; amount: string; status: CommissionRecord['status']; calculated_at: string; pending_at: string | null; approved_at: string | null; paid_at: string | null; actor_id: string }
type ApiClawback = { id: string; commission_id: string; case_id: string; original_amount: string; amount: string; reason: string; status: ClawbackRecord['status']; at: string; actor_id: string }
type ApiIncentiveRule = { id: string; name: string; metric: string; target_value: string; amount: string; active: boolean; created_at: string; updated_at: string }
type ApiIncentive = { id: string; user_id: string; rule_id: string; period: string; metric: string; target_value: string; achievement: string; amount: string; status: IncentiveRecord['status']; created_at: string; updated_at: string }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api/v1/finance' + path, {
    credentials: 'include', ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    let message = 'Could not update Finance.'
    try { const data = await response.json() as { error?: { message?: string } }; message = data.error?.message ?? message } catch { /* Use default. */ }
    throw new Error(message)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

async function mapRule(item: ApiRule): Promise<CommissionRule> {
  const catalogue = await loadApiCatalogue()
  return { id: item.id, bank: catalogue.find(record => record.id === item.bank_id)?.name ?? '',
    product: catalogue.find(record => record.id === item.product_id)?.name ?? '',
    productVariant: catalogue.find(record => record.id === item.variant_id)?.name ?? '',
    method: item.method, value: Number(item.value), effectiveFrom: item.effective_from,
    effectiveUntil: item.effective_until ?? '', active: item.active,
    createdAt: item.created_at, updatedAt: item.updated_at }
}

function mapCommission(item: ApiCommission): CommissionRecord {
  return { id: item.id, caseId: item.case_id, caseOwnerId: item.case_owner_id,
    ruleId: item.rule_id, basis: Number(item.basis), amount: Number(item.amount),
    status: item.status, calculatedAt: item.calculated_at, pendingAt: item.pending_at ?? '',
    approvedAt: item.approved_at ?? '', paidAt: item.paid_at ?? '', actorId: item.actor_id }
}

function mapClawback(item: ApiClawback): ClawbackRecord {
  return { id: item.id, commissionId: item.commission_id, caseId: item.case_id,
    originalAmount: Number(item.original_amount), amount: Number(item.amount),
    reason: item.reason, status: item.status, at: item.at, actorId: item.actor_id }
}

function mapIncentiveRule(item: ApiIncentiveRule): IncentiveRule {
  return { id: item.id, name: item.name, metric: item.metric, targetValue: Number(item.target_value),
    amount: Number(item.amount), active: item.active, createdAt: item.created_at, updatedAt: item.updated_at }
}

function mapIncentive(item: ApiIncentive): IncentiveRecord {
  return { id: item.id, userId: item.user_id, ruleId: item.rule_id, period: item.period,
    metric: item.metric, targetValue: Number(item.target_value), achievement: Number(item.achievement),
    amount: Number(item.amount), status: item.status, createdAt: item.created_at, updatedAt: item.updated_at }
}

async function rulePayload(draft: CommissionRuleDraft) {
  const catalogue = await loadApiCatalogue()
  const bank = catalogue.find(item => item.kind === 'banks' && item.name === draft.bank)
  const product = draft.product ? catalogue.find(item => item.kind === 'products' && item.parentId === bank?.id && item.name === draft.product) : null
  const variant = draft.productVariant ? catalogue.find(item => item.kind === 'variants' && item.parentId === product?.id && item.name === draft.productVariant) : null
  if (!bank || draft.product && !product || draft.productVariant && !variant) throw new Error('Select a valid Bank, Product and Product Variant combination.')
  return { bank_id: bank.id, product_id: product?.id ?? null, variant_id: variant?.id ?? null,
    method: draft.method, value: draft.value, effective_from: draft.effectiveFrom,
    effective_until: draft.effectiveUntil || null, active: draft.active }
}

export const apiFinanceRepository = {
  async snapshot(): Promise<FinanceStore> {
    const result = await request<{ rules: ApiRule[]; commissions: ApiCommission[]; clawbacks: ApiClawback[]; incentive_rules: ApiIncentiveRule[]; incentives: ApiIncentive[] }>('/snapshot')
    return { rules: await Promise.all(result.rules.map(mapRule)),
      commissions: result.commissions.map(mapCommission), clawbacks: result.clawbacks.map(mapClawback),
      incentiveRules: result.incentive_rules.map(mapIncentiveRule), incentives: result.incentives.map(mapIncentive) }
  },
  async saveRule(draft: CommissionRuleDraft, _actorId: string, id?: string): Promise<CommissionRule> {
    const item = await request<ApiRule>(id ? '/rules/' + encodeURIComponent(id) : '/rules',
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(await rulePayload(draft)) })
    return mapRule(item)
  },
  async removeRule(id: string, _actorId: string): Promise<void> {
    await request<void>('/rules/' + encodeURIComponent(id), { method: 'DELETE' })
  },
  async calculate(caseId: string, _actorId: string): Promise<CommissionRecord> {
    return mapCommission(await request<ApiCommission>('/commissions/calculate?case_id=' + encodeURIComponent(caseId), { method: 'POST' }))
  },
  async advance(id: string, next: 'Pending' | 'Approved' | 'Paid', _actorId: string): Promise<CommissionRecord> {
    return mapCommission(await request<ApiCommission>('/commissions/' + encodeURIComponent(id) + '/advance',
      { method: 'POST', body: JSON.stringify({ status: next }) }))
  },
  async addClawback(commissionId: string, amount: number, reason: string, _actorId: string): Promise<ClawbackRecord> {
    return mapClawback(await request<ApiClawback>('/clawbacks', {
      method: 'POST', body: JSON.stringify({ commission_id: commissionId, amount, reason }),
    }))
  },
  async resolveClawback(id: string, _actorId: string): Promise<ClawbackRecord> {
    return mapClawback(await request<ApiClawback>('/clawbacks/' + encodeURIComponent(id) + '/resolve', { method: 'POST' }))
  },
  async saveIncentiveRule(draft: Omit<IncentiveRule, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<IncentiveRule> {
    return mapIncentiveRule(await request<ApiIncentiveRule>(id ? '/incentive-rules/' + encodeURIComponent(id) : '/incentive-rules', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ name: draft.name, metric: draft.metric, target_value: draft.targetValue, amount: draft.amount, active: draft.active }),
    }))
  },
  async removeIncentiveRule(id: string): Promise<void> {
    await request<void>('/incentive-rules/' + encodeURIComponent(id), { method: 'DELETE' })
  },
  async saveIncentive(draft: IncentiveDraft, _actorId: string, id?: string): Promise<IncentiveRecord> {
    if (!draft.ruleId) throw new Error('Select an Incentive Rule.')
    return mapIncentive(await request<ApiIncentive>(id ? '/incentives/' + encodeURIComponent(id) : '/incentives', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ user_id: draft.userId, rule_id: draft.ruleId, period: draft.period,
        achievement: draft.achievement, status: draft.status }),
    }))
  },
  async removeIncentive(id: string, _actorId: string): Promise<void> {
    await request<void>('/incentives/' + encodeURIComponent(id), { method: 'DELETE' })
  },
}
