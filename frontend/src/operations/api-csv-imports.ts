import type { ImportKind, ImportPreview, ImportResult } from './csv-imports'

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/v1/imports' + path, {
    credentials: 'include', method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    let message = 'Could not complete CSV import.'
    try { const data = await response.json() as { error?: { message?: string } }; message = data.error?.message ?? message } catch { /* Use default. */ }
    throw new Error(message)
  }
  return await response.json() as T
}

export const apiImportRepository = {
  preview(kind: ImportKind, csv: string) { return request<ImportPreview>('/preview', { kind, csv }) },
  confirm(candidate: ImportPreview) {
    if (!candidate.id) throw new Error('Import preview is missing. Upload the CSV again.')
    return request<ImportResult>('/confirm', { preview_id: candidate.id })
  },
  history() { return request<ImportResult[]>('/history') },
}
