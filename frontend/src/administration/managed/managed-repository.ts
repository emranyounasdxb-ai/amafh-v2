import { validateManagedDraft, type ManagedConfig, type ManagedDraft, type ManagedRecord } from './managed-model'

export interface ManagedRepository { list(): Promise<ManagedRecord[]>; create(draft: ManagedDraft): Promise<ManagedRecord>; update(id: string, draft: ManagedDraft): Promise<ManagedRecord>; remove(id: string): Promise<void> }
export const managedStorageKey = (slug: string) => `amafh-v2.mock-${slug}.v1`
function isRecord(value: unknown): value is ManagedRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['id', 'kind', 'name', 'description', 'parentId', 'extra', 'createdAt', 'updatedAt'].every(key => typeof item[key] === 'string') && (item.status === 'active' || item.status === 'inactive')
}
export function createManagedRepository(config: ManagedConfig): ManagedRepository {
  const read = (): ManagedRecord[] => {
    let raw: string | null
    try { raw = localStorage.getItem(managedStorageKey(config.slug)) } catch { throw new Error(`Local ${config.label} data is unavailable.`) }
    if (raw === null) return config.seed.map(item => ({ ...item }))
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1 && Array.isArray((parsed as { records?: unknown }).records)) {
        const records = (parsed as { records: unknown[] }).records
        if (records.every(isRecord) && new Set(records.map(item => item.id)).size === records.length && records.every(item => Object.keys(validateManagedDraft(config, item, records, item.id)).length === 0)) return records.map(item => ({ ...item }))
      }
    } catch { /* Invalid local data is reported below. */ }
    throw new Error(`Local ${config.label} data could not be read.`)
  }
  const write = (records: ManagedRecord[]) => {
    try { localStorage.setItem(managedStorageKey(config.slug), JSON.stringify({ version: 1, records })) }
    catch { throw new Error(`Could not save local ${config.label} data.`) }
  }
  return {
    async list() { return read() },
    async create(draft) {
      const records = read()
      if (Object.keys(validateManagedDraft(config, draft, records)).length) throw new Error('Check the highlighted fields and try again.')
      const now = new Date().toISOString()
      const created: ManagedRecord = { ...draft, name: draft.name.trim().replace(/\s+/g, ' '), description: draft.description.trim(), extra: draft.extra.trim(), id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      write([...records, created]); return created
    },
    async update(id, draft) {
      const records = read()
      const previous = records.find(item => item.id === id)
      if (!previous) throw new Error('Record was not found.')
      if (draft.kind !== previous.kind || Object.keys(validateManagedDraft(config, draft, records, id)).length) throw new Error('Check the highlighted fields and try again.')
      const updated: ManagedRecord = { ...previous, ...draft, name: draft.name.trim().replace(/\s+/g, ' '), description: draft.description.trim(), extra: draft.extra.trim(), updatedAt: new Date().toISOString() }
      write(records.map(item => item.id === id ? updated : item)); return updated
    },
    async remove(id) {
      const records = read()
      const record = records.find(item => item.id === id)
      if (!record) throw new Error('Record was not found.')
      const count = records.filter(item => item.parentId === id).length
      if (count) throw new Error(`Cannot delete ${record.name}: ${count} related ${count === 1 ? 'record depends' : 'records depend'} on it.`)
      write(records.filter(item => item.id !== id))
    },
  }
}
