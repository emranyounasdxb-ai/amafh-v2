import { banksProductsRepository } from '../administration/banks-products/banks-products'
import { mockUsersRepository } from '../administration/users/mock-users-repository'
import { caseRepository } from '../cases/case-repository'
import { requireAction } from './permissions'

export interface CommissionRuleDraft { bank: string; product: string; productVariant: string; method: 'Fixed Amount' | 'Percentage'; value: number; effectiveFrom: string; effectiveUntil: string; active: boolean }
export interface CommissionRule extends CommissionRuleDraft { id: string; createdAt: string; updatedAt: string }
export type CommissionStatus = 'Calculated' | 'Pending' | 'Approved' | 'Paid'
export interface CommissionRecord { id: string; caseId: string; caseOwnerId: string; ruleId: string; basis: number; amount: number; status: CommissionStatus; calculatedAt: string; pendingAt: string; approvedAt: string; paidAt: string; actorId: string }
export interface ClawbackRecord { id: string; commissionId: string; caseId: string; originalAmount: number; amount: number; reason: string; status: 'Open' | 'Resolved'; at: string; actorId: string }
export interface IncentiveDraft { userId: string; ruleId?: string; period: string; metric: string; targetValue: number; achievement: number; amount: number; status: 'Draft' | 'Approved' }
export interface IncentiveRecord extends IncentiveDraft { id: string; createdAt: string; updatedAt: string }
export interface IncentiveRule { id: string; name: string; metric: string; targetValue: number; amount: number; active: boolean; createdAt: string; updatedAt: string }
export interface FinanceStore { rules: CommissionRule[]; commissions: CommissionRecord[]; clawbacks: ClawbackRecord[]; incentives: IncentiveRecord[]; incentiveRules?: IncentiveRule[] }
export const FINANCE_KEY = 'amafh-v2.mock-finance.v1'
const empty = (): FinanceStore => ({ rules: [], commissions: [], clawbacks: [], incentives: [] })
function read(): FinanceStore {
  const raw = localStorage.getItem(FINANCE_KEY)
  if (raw === null) return empty()
  try { const parsed: unknown = JSON.parse(raw); if (parsed && typeof parsed === 'object' && ['rules', 'commissions', 'clawbacks', 'incentives'].every(key => Array.isArray((parsed as Record<string, unknown>)[key]))) return structuredClone(parsed as FinanceStore) } catch { /* handled below */ }
  throw new Error('Local Finance data could not be read.')
}
function write(store: FinanceStore) { try { localStorage.setItem(FINANCE_KEY, JSON.stringify(store)) } catch { throw new Error('Could not save local Finance data.') } }
function validDay(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value }
export async function validateCommissionRule(draft: CommissionRuleDraft, existing: CommissionRule[], editingId?: string) {
  if (!['Fixed Amount', 'Percentage'].includes(draft.method) || !Number.isFinite(draft.value) || draft.value <= 0 || draft.method === 'Percentage' && draft.value > 100) throw new Error('Enter a valid fixed amount or percentage (up to 100%).')
  if (!validDay(draft.effectiveFrom) || draft.effectiveUntil && (!validDay(draft.effectiveUntil) || draft.effectiveUntil < draft.effectiveFrom)) throw new Error('Enter valid effective dates.')
  const records = await banksProductsRepository.list()
  const bank = records.find(item => item.kind === 'banks' && item.name === draft.bank && item.status === 'active')
  const product = draft.product ? records.find(item => item.kind === 'products' && item.name === draft.product && item.parentId === bank?.id && item.status === 'active') : null
  const variant = draft.productVariant ? records.find(item => item.kind === 'variants' && item.name === draft.productVariant && item.parentId === product?.id && item.status === 'active') : null
  if (!bank || draft.product && !product || draft.productVariant && !variant) throw new Error('Select a valid Bank, Product and Product Variant combination.')
  if (existing.some(item => item.id !== editingId && item.bank === draft.bank && item.product === draft.product && item.productVariant === draft.productVariant && item.effectiveFrom <= (draft.effectiveUntil || '9999-12-31') && draft.effectiveFrom <= (item.effectiveUntil || '9999-12-31'))) throw new Error('A commission rule already covers this catalogue scope and date range.')
}
export const financeRepository = {
  async snapshot() { return read() },
  async saveRule(draft: CommissionRuleDraft, actorId: string, id?: string) {
    await requireAction('Finance', 'manage-rules', actorId)
    const store = read(); await validateCommissionRule(draft, store.rules, id)
    const now = new Date().toISOString(); const prior = store.rules.find(item => item.id === id)
    if (id && !prior) throw new Error('Commission Rule was not found.')
    const record: CommissionRule = { ...draft, id: prior?.id ?? crypto.randomUUID(), createdAt: prior?.createdAt ?? now, updatedAt: now }
    write({ ...store, rules: prior ? store.rules.map(item => item.id === id ? record : item) : [...store.rules, record] }); return record
  },
  async removeRule(id: string, actorId: string) { await requireAction('Finance', 'manage-rules', actorId); const store = read(); if (store.commissions.some(item => item.ruleId === id)) throw new Error('Commission Rule is used by a Commission and cannot be deleted.'); write({ ...store, rules: store.rules.filter(item => item.id !== id) }) },
  async calculate(caseId: string, actorId: string) {
    await requireAction('Finance', 'review-commission', actorId)
    const store = read(); const item = (await caseRepository.list()).find(item => item.id === caseId)
    if (!item) throw new Error('Case was not found.')
    if (item.status !== 'SM Approved' || item.stage !== 'Final Outcome' || !item.stageId) throw new Error('Commission requires an approved Case at Final Outcome.')
    if (store.commissions.some(record => record.caseId === caseId)) throw new Error('This Case already has a Commission record.')
    const day = new Date().toISOString().slice(0, 10)
    const rule = store.rules.filter(rule => rule.active && rule.bank === item.bank && (!rule.product || rule.product === item.product) && (!rule.productVariant || rule.productVariant === item.productVariant) && rule.effectiveFrom <= day && (!rule.effectiveUntil || rule.effectiveUntil >= day)).sort((a, b) => Number(Boolean(b.productVariant)) - Number(Boolean(a.productVariant)) || Number(Boolean(b.product)) - Number(Boolean(a.product)))[0]
    if (!rule) throw new Error('No active Commission Rule applies to this Case.')
    const basis = Number(item.requestedAmount)
    const amount = Math.round((rule.method === 'Percentage' ? basis * rule.value / 100 : rule.value) * 100) / 100
    const record: CommissionRecord = { id: crypto.randomUUID(), caseId, caseOwnerId: item.caseOwnerId, ruleId: rule.id, basis, amount, status: 'Calculated', calculatedAt: new Date().toISOString(), pendingAt: '', approvedAt: '', paidAt: '', actorId }
    write({ ...store, commissions: [...store.commissions, record] }); return record
  },
  async advance(id: string, next: 'Pending' | 'Approved' | 'Paid', actorId: string) {
    await requireAction('Finance', next === 'Approved' ? 'approve-commission' : next === 'Paid' ? 'mark-paid' : 'review-commission', actorId)
    const store = read(); const prior = store.commissions.find(item => item.id === id)
    if (!prior) throw new Error('Commission was not found.')
    const expected: Record<typeof next, CommissionStatus> = { Pending: 'Calculated', Approved: 'Pending', Paid: 'Approved' }
    if (prior.status !== expected[next]) throw new Error(`Commission must be ${expected[next]} before ${next}.`)
    const now = new Date().toISOString(); const updated = { ...prior, status: next, ...(next === 'Pending' ? { pendingAt: now } : next === 'Approved' ? { approvedAt: now } : { paidAt: now }) }
    write({ ...store, commissions: store.commissions.map(item => item.id === id ? updated : item) }); return updated
  },
  async addClawback(commissionId: string, amount: number, reason: string, actorId: string) {
    await requireAction('Finance', 'manage-clawback', actorId)
    const store = read(); const commission = store.commissions.find(item => item.id === commissionId)
    if (!commission || commission.status !== 'Paid') throw new Error('Clawback requires a Paid Commission.')
    if (!Number.isFinite(amount) || amount <= 0 || amount + store.clawbacks.filter(item => item.commissionId === commissionId).reduce((sum, item) => sum + item.amount, 0) > commission.amount) throw new Error('Clawback amount exceeds the remaining Commission.')
    if (!reason.trim() || reason.length > 500) throw new Error('Enter a Clawback reason of 500 characters or fewer.')
    const created: ClawbackRecord = { id: crypto.randomUUID(), commissionId, caseId: commission.caseId, originalAmount: commission.amount, amount, reason: reason.trim(), status: 'Open', at: new Date().toISOString(), actorId }
    write({ ...store, clawbacks: [...store.clawbacks, created] }); return created
  },
  async resolveClawback(id: string, actorId: string) { await requireAction('Finance', 'manage-clawback', actorId); const store = read(); const prior = store.clawbacks.find(item => item.id === id); if (!prior) throw new Error('Clawback was not found.'); write({ ...store, clawbacks: store.clawbacks.map(item => item.id === id ? { ...item, status: 'Resolved' } : item) }) },
  async saveIncentive(draft: IncentiveDraft, actorId: string, id?: string) {
    await requireAction('Finance', 'manage-incentives', actorId)
    const users = await mockUsersRepository.list()
    if (!users.some(item => item.id === draft.userId)) throw new Error('Select an existing User.')
    if (!/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/.test(draft.period) || !draft.metric.trim() || draft.metric.length > 120 || ![draft.targetValue, draft.achievement, draft.amount].every(value => Number.isFinite(value) && value >= 0) || draft.targetValue === 0 || !['Draft', 'Approved'].includes(draft.status)) throw new Error('Enter valid Incentive period, metric, target, achievement, amount and status.')
    const store = read()
    if (store.incentives.some(item => item.id !== id && item.userId === draft.userId && item.period === draft.period && item.metric.toLowerCase() === draft.metric.trim().toLowerCase())) throw new Error('An Incentive already exists for this User, period and metric.')
    const prior = store.incentives.find(item => item.id === id)
    if (id && !prior) throw new Error('Incentive was not found.')
    const now = new Date().toISOString(); const record: IncentiveRecord = { ...draft, metric: draft.metric.trim(), id: prior?.id ?? crypto.randomUUID(), createdAt: prior?.createdAt ?? now, updatedAt: now }
    write({ ...store, incentives: prior ? store.incentives.map(item => item.id === id ? record : item) : [...store.incentives, record] }); return record
  },
  async removeIncentive(id: string, actorId: string) { await requireAction('Finance', 'manage-incentives', actorId); const store = read(); if (!store.incentives.some(item => item.id === id)) throw new Error('Incentive was not found.'); write({ ...store, incentives: store.incentives.filter(item => item.id !== id) }) },
}
