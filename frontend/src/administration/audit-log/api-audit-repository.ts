import type { AuditEntry, AuditRepository } from './mock-audit-repository'

type ApiEntry = { id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null; metadata: Record<string, unknown>; at: string }

export const apiAuditRepository: AuditRepository = {
  async list(): Promise<AuditEntry[]> {
    const response = await fetch('/api/v1/audit-logs', { credentials: 'include' })
    if (!response.ok) {
      let message = 'Could not load Audit Log.'
      try { const data = await response.json() as { error?: { message?: string } }; message = data.error?.message ?? message } catch { /* Use fallback. */ }
      throw new Error(message)
    }
    return ((await response.json()) as ApiEntry[]).map(item => ({ id: item.id, event: item.action,
      source: item.entity, summary: [item.entity_id, item.actor_id].filter(Boolean).join(' · '),
      occurredAt: item.at, actorId: item.actor_id ?? '', entityId: item.entity_id ?? '',
      before: item.before, after: item.after, metadata: item.metadata }))
  },
}
