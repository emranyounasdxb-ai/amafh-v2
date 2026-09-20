import type { OrganizationRepository } from './mock-organization-repository'
import type { OrganizationDraft, OrganizationRecord } from './organization-model'

type ApiUnit = { id: string; kind: OrganizationRecord['kind']; name: string; description: string; active: boolean; parent_id: string | null; created_at: string; updated_at: string }
const fromApi = (unit: ApiUnit): OrganizationRecord => ({ id: unit.id, kind: unit.kind, name: unit.name, description: unit.description, status: unit.active ? 'active' : 'inactive', parentId: unit.parent_id ?? '', createdAt: unit.created_at, updatedAt: unit.updated_at })
const toApi = (draft: OrganizationDraft) => ({ kind: draft.kind, name: draft.name, description: draft.description, active: draft.status === 'active', parent_id: draft.parentId || null })

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/organization${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  if (!response.ok) {
    let message = 'Could not save organization data.'
    try { const body: { error?: { message?: string } } = await response.json(); message = body.error?.message ?? message } catch { /* Keep the recoverable default. */ }
    throw new Error(message)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

export const apiOrganizationRepository: OrganizationRepository = {
  async list() { return (await request<ApiUnit[]>('')).map(fromApi) },
  async create(draft) { return fromApi(await request<ApiUnit>('', { method: 'POST', body: JSON.stringify(toApi(draft)) })) },
  async update(id, draft) { return fromApi(await request<ApiUnit>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(toApi(draft)) })) },
  async remove(id) { await request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
}
