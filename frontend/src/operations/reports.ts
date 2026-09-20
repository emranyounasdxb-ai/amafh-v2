import type { ApplicationRecord } from '../customers/customer-model'
import { caseRepository } from '../cases/case-repository'
import { caseStageAging } from '../cases/case-aging'
import { tasksRepository } from './tasks'
import { financeRepository } from './finance'
import { requireAction } from './permissions'

export interface ReportFilters { from: string; until: string; bank: string; product: string; variant: string; owner: string; coordinator: string; status: string; stage: string }
export const emptyReportFilters = (): ReportFilters => ({ from: '', until: '', bank: '', product: '', variant: '', owner: '', coordinator: '', status: '', stage: '' })
export function filterCases(cases: ApplicationRecord[], filters: ReportFilters) {
  return cases.filter(item => (!filters.from || item.createdAt.slice(0, 10) >= filters.from) && (!filters.until || item.createdAt.slice(0, 10) <= filters.until) && (!filters.bank || item.bank === filters.bank) && (!filters.product || item.product === filters.product) && (!filters.variant || item.productVariant === filters.variant) && (!filters.owner || item.caseOwnerId === filters.owner) && (!filters.coordinator || item.coordinatorId === filters.coordinator) && (!filters.status || item.status === filters.status) && (!filters.stage || item.stage === filters.stage))
}
export function countBy(cases: ApplicationRecord[], pick: (item: ApplicationRecord) => string) { const counts = new Map<string, number>(); for (const item of cases) { const label = pick(item) || 'Unassigned'; counts.set(label, (counts.get(label) ?? 0) + 1) } return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) }
export function caseMetrics(cases: ApplicationRecord[]) {
  return { total: cases.length, pending: cases.filter(item => item.status === 'Pending SM Approval').length, approved: cases.filter(item => item.status === 'SM Approved').length, submitted: cases.filter(item => Boolean(item.submittedAt)).length, inProgress: cases.filter(item => item.status === 'SM Approved' && Boolean(item.submittedAt) && item.stage !== 'Final Outcome').length, completed: cases.filter(item => item.status === 'SM Approved' && item.stage === 'Final Outcome').length, rejected: cases.filter(item => item.status === 'SM Rejected').length, overdue: cases.filter(item => caseStageAging(item)?.status === 'Overdue').length }
}
function quote(value: string | number) { const text = String(value); return `"${text.replaceAll('"', '""')}"` }
export function casesToCsv(cases: ApplicationRecord[]) {
  const header = ['Case', 'Created', 'Status', 'Bank', 'Product', 'Variant', 'Stage', 'Case Owner ID', 'Coordinator ID', 'SLA Status', 'Stage Started', 'Stage Due']
  const rows = cases.map(item => { const aging = caseStageAging(item); return [item.caseNumber, item.createdAt, item.status, item.bank, item.product, item.productVariant, item.stage, item.caseOwnerId, item.coordinatorId, aging?.status ?? '', aging?.startedAt ?? '', aging?.dueAt ?? ''] })
  return '\uFEFF' + [header, ...rows].map(row => row.map(quote).join(',')).join('\r\n')
}
export const reportsRepository = {
  async load(actorId: string) { await requireAction('Reports', 'view', actorId); const [cases, tasks] = await Promise.all([caseRepository.list(), tasksRepository.rawList()]); return { cases, tasks } },
  async finance(actorId: string) { await requireAction('Reports', 'view', actorId); await requireAction('Reports', 'view-financial', actorId); return financeRepository.snapshot() },
  async exportCsv(cases: ApplicationRecord[], actorId: string) { await requireAction('Reports', 'export', actorId); return casesToCsv(cases) },
}
