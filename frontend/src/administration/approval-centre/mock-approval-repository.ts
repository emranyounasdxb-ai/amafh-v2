import { validateApprovalDraft, type ApprovalDraft, type ApprovalRecord, type ApprovalStatus } from './approval-model'
export const APPROVAL_STORAGE_KEY = 'amafh-v2.mock-approval-centre.v1'
const seed: ApprovalRecord[] = [{ id: 'sample-request-1', title: 'Sample Request', description: 'Local approval queue example.', status: 'pending', createdAt: '2026-09-19T00:00:00.000Z', updatedAt: '2026-09-19T00:00:00.000Z' }]
function isRecord(value: unknown): value is ApprovalRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['id', 'title', 'description', 'createdAt', 'updatedAt'].every(key => typeof item[key] === 'string') && ['pending', 'approved', 'rejected'].includes(String(item.status))
}
function read(): ApprovalRecord[] {
  let raw: string | null
  try { raw = localStorage.getItem(APPROVAL_STORAGE_KEY) } catch { throw new Error('Local approval data is unavailable.') }
  if (raw === null) return seed.map(item => ({ ...item }))
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1 && Array.isArray((parsed as { requests?: unknown }).requests)) {
      const records = (parsed as { requests: unknown[] }).requests
      if (records.every(isRecord) && new Set(records.map(item => item.id)).size === records.length && records.every(item => Object.keys(validateApprovalDraft(item, records, item.id)).length === 0)) return records.map(item => ({ ...item }))
    }
  } catch { /* Invalid local data is reported below. */ }
  throw new Error('Local approval data could not be read.')
}
function write(records: ApprovalRecord[]) { try { localStorage.setItem(APPROVAL_STORAGE_KEY, JSON.stringify({ version: 1, requests: records })) } catch { throw new Error('Could not save local approval data.') } }
export interface ApprovalRepository { list(): Promise<ApprovalRecord[]>; create(draft: ApprovalDraft): Promise<ApprovalRecord>; update(id: string, draft: ApprovalDraft): Promise<ApprovalRecord>; decide(id: string, status: ApprovalStatus): Promise<ApprovalRecord>; remove(id: string): Promise<void> }
export const mockApprovalRepository: ApprovalRepository = {
  async list() { return read() },
  async create(draft) { const records = read(); if (Object.keys(validateApprovalDraft(draft, records)).length) throw new Error('Check the request details and try again.'); const now = new Date().toISOString(); const created: ApprovalRecord = { id: crypto.randomUUID(), title: draft.title.trim().replace(/\s+/g, ' '), description: draft.description.trim(), status: 'pending', createdAt: now, updatedAt: now }; write([...records, created]); return created },
  async update(id, draft) { const records = read(); const previous = records.find(item => item.id === id); if (!previous) throw new Error('Request was not found.'); if (Object.keys(validateApprovalDraft(draft, records, id)).length) throw new Error('Check the request details and try again.'); const updated = { ...previous, title: draft.title.trim().replace(/\s+/g, ' '), description: draft.description.trim(), updatedAt: new Date().toISOString() }; write(records.map(item => item.id === id ? updated : item)); return updated },
  async decide(id, status) { if (status !== 'approved' && status !== 'rejected' && status !== 'pending') throw new Error('Invalid decision.'); const records = read(); const previous = records.find(item => item.id === id); if (!previous) throw new Error('Request was not found.'); const updated = { ...previous, status, updatedAt: new Date().toISOString() }; write(records.map(item => item.id === id ? updated : item)); return updated },
  async remove(id) { const records = read(); if (!records.some(item => item.id === id)) throw new Error('Request was not found.'); write(records.filter(item => item.id !== id)) },
}
