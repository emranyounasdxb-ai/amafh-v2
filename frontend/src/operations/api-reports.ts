import type { ApplicationRecord } from '../customers/customer-model'
import { casesToCsv } from './reports'

type ApiCase = { id: string; case_number: string; customer_id: string; case_owner_id: string; coordinator_id: string | null; bank: string; product: string; product_variant: string; status: ApplicationRecord['status']; stage: string; stage_id: string | null; stage_started_at: string | null; stage_expected_duration_hours: string | null; created_at: string; submitted_at: string | null }
type Snapshot = { cases: ApiCase[]; tasks: { id: string; case_id: string | null; status: string }[]; finance: { commissions: { case_id: string; status: string; amount: string }[]; clawbacks: { case_id: string; amount: string }[]; incentives: { amount: string }[] } | null }

async function snapshot(): Promise<Snapshot> {
  const response = await fetch('/api/v1/reports/snapshot', { credentials: 'include' })
  if (!response.ok) {
    let message = 'Could not load Reports.'
    try { const body = await response.json() as { error?: { message?: string } }; message = body.error?.message ?? message } catch { /* Use fallback. */ }
    throw new Error(message)
  }
  return await response.json() as Snapshot
}

function mapCase(item: ApiCase): ApplicationRecord {
  return { id: item.id, customerId: item.customer_id, caseNumber: item.case_number, caseOwnerId: item.case_owner_id,
    initialCaseOwner: '', coordinatorId: item.coordinator_id ?? '', bank: item.bank, product: item.product,
    productVariant: item.product_variant, requestedAmount: '', status: item.status, stage: item.stage,
    stageId: item.stage_id ?? undefined, stageStartedAt: item.stage_started_at ?? undefined,
    stageExpectedDurationHours: item.stage_expected_duration_hours ? Number(item.stage_expected_duration_hours) : undefined,
    createdAt: item.created_at, submittedAt: item.submitted_at ?? '', bankFileNumber: '', lockedAt: '',
    approvalActorId: '', approvedAt: '', history: [] }
}

export const apiReportsRepository = {
  async load() { const data = await snapshot(); return { cases: data.cases.map(mapCase), tasks: data.tasks.map(item => ({ caseId: item.case_id ?? '', status: item.status })) } },
  async finance() { const data = await snapshot(); return data.finance && {
    commissions: data.finance.commissions.map(item => ({ caseId: item.case_id, status: item.status, amount: Number(item.amount) })),
    clawbacks: data.finance.clawbacks.map(item => ({ caseId: item.case_id, amount: Number(item.amount) })),
    incentives: data.finance.incentives.map(item => ({ amount: Number(item.amount) })),
  } },
  async exportCsv(cases: ApplicationRecord[]) {
    const response = await fetch('/api/v1/reports/export-check', { credentials: 'include' })
    if (!response.ok) throw new Error('Report export permission required.')
    return casesToCsv(cases)
  },
}
