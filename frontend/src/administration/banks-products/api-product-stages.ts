import type { ProductStageDraft, ProductStageRecord } from './product-stages'

type ApiStage = { id: string; product_id: string; name: string; sequence: number; expected_duration_hours: string; active: boolean; created_at: string; updated_at: string; used: boolean }
const usedById = new Map<string, boolean>()

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  if (!response.ok) {
    let message = 'Could not load Product Stages.'
    try { const body: { error?: { message?: string } } = await response.json(); message = body.error?.message ?? message } catch { /* Keep the recoverable default. */ }
    throw new Error(message)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}
const fromApi = (item: ApiStage): ProductStageRecord => {
  usedById.set(item.id, item.used)
  return { id: item.id, productId: item.product_id, name: item.name, sequence: item.sequence, expectedDurationHours: Number(item.expected_duration_hours), status: item.active ? 'active' : 'inactive', createdAt: item.created_at, updatedAt: item.updated_at }
}
const toApi = (draft: ProductStageDraft) => ({ name: draft.name, expected_duration_hours: draft.expectedDurationHours, active: draft.status === 'active' })

export const apiProductStagesRepository = {
  async list(productId: string): Promise<ProductStageRecord[]> { return (await request<ApiStage[]>(`/products/${encodeURIComponent(productId)}/stages`)).map(fromApi) },
  async create(productId: string, draft: ProductStageDraft): Promise<ProductStageRecord> { return fromApi(await request<ApiStage>(`/products/${encodeURIComponent(productId)}/stages`, { method: 'POST', body: JSON.stringify(toApi(draft)) })) },
  async update(id: string, draft: ProductStageDraft): Promise<ProductStageRecord> { return fromApi(await request<ApiStage>(`/stages/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(toApi(draft)) })) },
  async move(id: string, direction: -1 | 1): Promise<ProductStageRecord[]> { return (await request<ApiStage[]>(`/stages/${encodeURIComponent(id)}/move`, { method: 'POST', body: JSON.stringify({ direction }) })).map(fromApi) },
  async remove(id: string): Promise<void> { await request<void>(`/stages/${encodeURIComponent(id)}`, { method: 'DELETE' }); usedById.delete(id) },
  async isUsed(id: string): Promise<boolean> { return usedById.get(id) ?? false },
}
