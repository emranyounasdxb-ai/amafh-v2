import { departmentOptions, officeOptions, organizationOptions, teamOptions } from '../users/users-model'
import { validateOrganizationDraft, type OrganizationDraft, type OrganizationRecord } from './organization-model'

export const ORGANIZATION_STORAGE_KEY = 'amafh-v2.mock-organization.v1'
const seedTime = '2026-09-19T00:00:00.000Z'
const record = (id: string, kind: OrganizationRecord['kind'], name: string, parentId: string, status: OrganizationRecord['status'] = 'active'): OrganizationRecord => ({ id, kind, name, parentId, status, description: `Local ${name.toLowerCase()} structure.`, createdAt: seedTime, updatedAt: seedTime })
const seeded: OrganizationRecord[] = [
  ...organizationOptions.map((name, index) => record(`organization-${index + 1}`, 'organizations', name, '')),
  ...officeOptions.map((name, index) => record(`office-${index + 1}`, 'offices', name, 'organization-1')),
  ...departmentOptions.map((name, index) => record(`department-${index + 1}`, 'departments', name, index === 2 ? 'office-2' : 'office-1')),
  ...teamOptions.map((name, index) => record(`team-${index + 1}`, 'teams', name, `department-${index + 1}`, index === 2 ? 'inactive' : 'active')),
  record('business-unit-1', 'business-units', 'Business Unit A', 'department-3'),
]
function isRecord(value: unknown): value is OrganizationRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['id', 'kind', 'name', 'description', 'parentId', 'createdAt', 'updatedAt'].every(key => typeof item[key] === 'string') && (item.status === 'active' || item.status === 'inactive')
}
function read(): OrganizationRecord[] {
  let raw: string | null
  try { raw = localStorage.getItem(ORGANIZATION_STORAGE_KEY) }
  catch { throw new Error('Local organization data is unavailable.') }
  if (raw === null) return seeded.map(item => ({ ...item }))
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1 && Array.isArray((parsed as { records?: unknown }).records)) {
      const records = (parsed as { records: unknown[] }).records
      if (records.every(isRecord) && new Set(records.map(item => item.id)).size === records.length && records.every(item => Object.keys(validateOrganizationDraft(item, records, item.id)).length === 0)) return records.map(item => ({ ...item }))
    }
  } catch { /* Invalid local data is reported below. */ }
  throw new Error('Local organization data could not be read.')
}
function write(records: OrganizationRecord[]) {
  try { localStorage.setItem(ORGANIZATION_STORAGE_KEY, JSON.stringify({ version: 1, records })) }
  catch { throw new Error('Could not save local organization data.') }
}
export interface OrganizationRepository { list(): Promise<OrganizationRecord[]>; create(draft: OrganizationDraft): Promise<OrganizationRecord>; update(id: string, draft: OrganizationDraft): Promise<OrganizationRecord>; remove(id: string): Promise<void> }
export const mockOrganizationRepository: OrganizationRepository = {
  async list() { return read() },
  async create(draft) {
    const records = read()
    if (Object.keys(validateOrganizationDraft(draft, records)).length) throw new Error('Check the organization details and try again.')
    const now = new Date().toISOString()
    const created: OrganizationRecord = { ...draft, name: draft.name.trim().replace(/\s+/g, ' '), description: draft.description.trim(), id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    write([...records, created])
    return created
  },
  async update(id, draft) {
    const records = read()
    const previous = records.find(item => item.id === id)
    if (!previous) throw new Error('Organization record was not found.')
    if (draft.kind !== previous.kind || Object.keys(validateOrganizationDraft(draft, records, id)).length) throw new Error('Check the organization details and try again.')
    const updated: OrganizationRecord = { ...previous, ...draft, name: draft.name.trim().replace(/\s+/g, ' '), description: draft.description.trim(), updatedAt: new Date().toISOString() }
    write(records.map(item => item.id === id ? updated : item))
    return updated
  },
  async remove(id) {
    const records = read()
    const existing = records.find(item => item.id === id)
    if (!existing) throw new Error('Organization record was not found.')
    const children = records.filter(item => item.parentId === id)
    if (children.length) throw new Error(`Cannot delete ${existing.name}: ${children.length} related ${children.length === 1 ? 'record depends' : 'records depend'} on it.`)
    write(records.filter(item => item.id !== id))
  },
}
