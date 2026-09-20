import type { ApplicationRecord } from '../customers/customer-model'

export type StageSlaStatus = 'On Time' | 'Due Soon' | 'Overdue'
export interface StageAging { stage: string; startedAt: string; expectedDurationHours: number; dueAt: string; elapsedMs: number; remainingMs: number; overdueMs: number; status: StageSlaStatus }
export function caseStageAging(item: ApplicationRecord, now = new Date()): StageAging | null {
  if (!item.stageId || !item.stageStartedAt || !item.stageExpectedDurationHours) return null
  const start = Date.parse(item.stageStartedAt)
  const expectedMs = item.stageExpectedDurationHours * 60 * 60 * 1000
  if (!Number.isFinite(start) || !Number.isFinite(expectedMs) || expectedMs <= 0) return null
  const due = start + expectedMs
  const elapsedMs = Math.max(0, now.getTime() - start)
  const remainingMs = Math.max(0, due - now.getTime())
  const overdueMs = Math.max(0, now.getTime() - due)
  // The final quarter of the configured duration is highlighted as Due Soon.
  const status: StageSlaStatus = overdueMs > 0 ? 'Overdue' : remainingMs <= expectedMs / 4 ? 'Due Soon' : 'On Time'
  return { stage: item.stage, startedAt: item.stageStartedAt, expectedDurationHours: item.stageExpectedDurationHours, dueAt: new Date(due).toISOString(), elapsedMs, remainingMs, overdueMs, status }
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const remainingMinutes = minutes % 60
  return `${days ? `${days}d ` : ''}${hours}h ${remainingMinutes}m`
}
