import { banksProductsRepository } from './banks-products'
import { readCustomerStore } from '../../customers/mock-customer-repository'
import { requireAction } from '../../operations/permissions'

export interface ProductStageDraft { name: string; expectedDurationHours: number; status: 'active' | 'inactive' }
export interface ProductStageRecord extends ProductStageDraft { id: string; productId: string; sequence: number; createdAt: string; updatedAt: string }
export const PRODUCT_STAGES_STORAGE_KEY = 'amafh-v2.mock-product-stages.v1'
const time = '2026-09-19T00:00:00.000Z'
const seed: ProductStageRecord[] = ['Stage 1', 'Stage 2', 'Stage 3', 'Final Outcome'].map((name, index) => ({ id: `sample-stage-${index + 1}`, productId: 'sample-product-1', name, sequence: index + 1, expectedDurationHours: 24, status: 'active', createdAt: time, updatedAt: time }))
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
const ordered = (records: ProductStageRecord[]) => records.sort((a, b) => a.productId.localeCompare(b.productId) || a.sequence - b.sequence)
function read(): ProductStageRecord[] {
  let raw: string | null
  try { raw = localStorage.getItem(PRODUCT_STAGES_STORAGE_KEY) } catch { throw new Error('Local Product Stages are unavailable.') }
  if (raw === null) return structuredClone(seed)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1 && Array.isArray((parsed as { records?: unknown }).records)) {
      const records = (parsed as { records: unknown[] }).records
      if (records.every(item => {
        if (!item || typeof item !== 'object') return false
        const stage = item as Record<string, unknown>
        return ['id', 'productId', 'name', 'createdAt', 'updatedAt'].every(key => typeof stage[key] === 'string') && typeof stage.sequence === 'number' && Number.isInteger(stage.sequence) && stage.sequence > 0 && typeof stage.expectedDurationHours === 'number' && Number.isFinite(stage.expectedDurationHours) && stage.expectedDurationHours > 0 && (stage.status === 'active' || stage.status === 'inactive')
      }) && new Set(records.map(item => (item as ProductStageRecord).id)).size === records.length && new Set(records.map(item => { const stage = item as ProductStageRecord; return `${stage.productId}:${normalize(stage.name)}` })).size === records.length && new Set(records.map(item => { const stage = item as ProductStageRecord; return `${stage.productId}:${stage.sequence}` })).size === records.length) return ordered(structuredClone(records as ProductStageRecord[]))
    }
  } catch { /* Invalid local data is reported below. */ }
  throw new Error('Local Product Stages could not be read.')
}
function write(records: ProductStageRecord[]) { try { localStorage.setItem(PRODUCT_STAGES_STORAGE_KEY, JSON.stringify({ version: 1, records: ordered(records) })) } catch { throw new Error('Could not save local Product Stages.') } }
function used(stage: ProductStageRecord, productName: string) {
  return readCustomerStore().applications.some(item => (item.productId ? item.productId === stage.productId : item.product === productName) && (item.stageId === stage.id || !item.stageId && item.stage === stage.name || item.history.some(event => event.stageId === stage.id || !event.stageId && event.label === stage.name)))
}
async function product(id: string) {
  const found = (await banksProductsRepository.list()).find(item => item.id === id && item.kind === 'products')
  if (!found) throw new Error('Product was not found.')
  return found
}
function validate(draft: ProductStageDraft, productId: string, records: ProductStageRecord[], editingId?: string) {
  const name = draft.name.trim().replace(/\s+/g, ' ')
  if (!name || name.length > 120) throw new Error('Stage name must be 1–120 characters.')
  if (!Number.isFinite(draft.expectedDurationHours) || draft.expectedDurationHours <= 0 || draft.expectedDurationHours > 87600) throw new Error('Expected Duration must be greater than zero and at most 87600 hours.')
  if (draft.status !== 'active' && draft.status !== 'inactive') throw new Error('Select a valid stage state.')
  if (records.some(item => item.productId === productId && item.id !== editingId && normalize(item.name) === normalize(name))) throw new Error('A Stage with this name already exists for this Product.')
  return name
}
export const productStagesRepository = {
  async list(productId: string) { await product(productId); return read().filter(item => item.productId === productId) },
  async create(productId: string, draft: ProductStageDraft, actorId: string) {
    await requireAction('Cases', 'add-stage', actorId)
    await product(productId); const records = read(); const name = validate(draft, productId, records)
    const now = new Date().toISOString(); const siblings = records.filter(item => item.productId === productId)
    const created: ProductStageRecord = { ...draft, name, productId, id: crypto.randomUUID(), sequence: Math.max(0, ...siblings.map(item => item.sequence)) + 1, createdAt: now, updatedAt: now }
    write([...records, created]); return created
  },
  async update(id: string, draft: ProductStageDraft, actorId: string) {
    const records = read(); const previous = records.find(item => item.id === id)
    if (!previous) throw new Error('Product Stage was not found.')
    if (draft.name.trim().replace(/\s+/g, ' ') !== previous.name) await requireAction('Cases', 'edit-stage', actorId)
    if (draft.status !== previous.status) await requireAction('Cases', 'activate-stage', actorId)
    if (draft.expectedDurationHours !== previous.expectedDurationHours) await requireAction('Cases', 'set-stage-duration', actorId)
    if (draft.name.trim().replace(/\s+/g, ' ') === previous.name && draft.status === previous.status && draft.expectedDurationHours === previous.expectedDurationHours) await requireAction('Cases', 'edit-stage', actorId)
    const parent = await product(previous.productId); const name = validate(draft, previous.productId, records, id)
    if (used(previous, parent.name) && (name !== previous.name || draft.status !== previous.status)) throw new Error('A Case uses this Stage. Only Expected Duration may change; its identity and state are protected.')
    const updated = { ...previous, ...draft, name, updatedAt: new Date().toISOString() }
    write(records.map(item => item.id === id ? updated : item)); return updated
  },
  async move(id: string, direction: -1 | 1, actorId: string) {
    await requireAction('Cases', 'reorder-stage', actorId)
    const records = read(); const stage = records.find(item => item.id === id)
    if (!stage) throw new Error('Product Stage was not found.')
    const siblings = records.filter(item => item.productId === stage.productId).sort((a, b) => a.sequence - b.sequence)
    const neighbor = siblings[siblings.findIndex(item => item.id === id) + direction]
    if (!neighbor) throw new Error('Stage is already at the end of the sequence.')
    const parent = await product(stage.productId)
    if (used(stage, parent.name) || used(neighbor, parent.name)) throw new Error('A Case uses one of these Stages. Its sequence is protected.')
    const now = new Date().toISOString()
    write(records.map(item => item.id === stage.id ? { ...item, sequence: neighbor.sequence, updatedAt: now } : item.id === neighbor.id ? { ...item, sequence: stage.sequence, updatedAt: now } : item))
    return read().filter(item => item.productId === stage.productId)
  },
  async remove(id: string, actorId: string) {
    await requireAction('Cases', 'delete-stage', actorId)
    const records = read(); const stage = records.find(item => item.id === id)
    if (!stage) throw new Error('Product Stage was not found.')
    const parent = await product(stage.productId)
    if (used(stage, parent.name)) throw new Error('Cannot delete this Stage: a Case uses it in current or historical progression.')
    const now = new Date().toISOString()
    write(records.filter(item => item.id !== id).map(item => item.productId === stage.productId && item.sequence > stage.sequence ? { ...item, sequence: item.sequence - 1, updatedAt: now } : item))
  },
  async isUsed(id: string) { const stage = read().find(item => item.id === id); return stage ? used(stage, (await product(stage.productId)).name) : false },
}
