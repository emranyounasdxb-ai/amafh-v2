export interface AuditEntry { id: string; event: string; source: string; summary: string; occurredAt: string; actorId?: string; entityId?: string; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; metadata?: Record<string, unknown> }
export const AUDIT_STORAGE_KEY = 'amafh-v2.mock-audit-log.v1'
const seed: AuditEntry[] = [{ id: 'sample-event-1', event: 'Sample event', source: 'Local demonstration', summary: 'Illustrative entry only. This is not an application audit trail.', occurredAt: '2026-09-19T00:00:00.000Z' }]
function isEntry(value: unknown): value is AuditEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['id', 'event', 'source', 'summary', 'occurredAt'].every(key => typeof item[key] === 'string')
}
export interface AuditRepository { list(): Promise<AuditEntry[]> }
export const mockAuditRepository: AuditRepository = {
  async list() {
    let raw: string | null
    try { raw = localStorage.getItem(AUDIT_STORAGE_KEY) } catch { throw new Error('Local audit sample data is unavailable.') }
    if (raw === null) return seed.map(item => ({ ...item }))
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1 && Array.isArray((parsed as { entries?: unknown }).entries)) {
        const entries = (parsed as { entries: unknown[] }).entries
        if (entries.every(isEntry) && new Set(entries.map(item => item.id)).size === entries.length) return entries.map(item => ({ ...item }))
      }
    } catch { /* Invalid local data is reported below. */ }
    throw new Error('Local audit sample data could not be read.')
  },
}
