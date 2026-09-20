import { mockUsersRepository } from '../administration/users/mock-users-repository'
import { emptyUserDraft, validateUserDraft, type UserDraft } from '../administration/users/users-model'
import { banksProductsRepository } from '../administration/banks-products/banks-products'
import { productStagesRepository } from '../administration/banks-products/product-stages'
import { caseRepository } from '../cases/case-repository'
import { requireAction } from './permissions'

export type ImportKind = 'attendance' | 'case-stage' | 'users'
export interface ImportRow { line: number; values: Record<string, string>; errors: string[] }
export interface ImportPreview { id?: string; kind: ImportKind; rows: ImportRow[]; valid: number; invalid: number; matchedCases: number; unmatchedCases: number }
export interface ImportResult { id: string; kind: ImportKind; at: string; actorId: string; success: number; failed: number; details: string[] }
export interface AttendanceRecord { id: string; userId: string; date: string; status: 'Present' | 'Absent' | 'Late'; importedAt: string; importedBy: string }
export const IMPORT_RESULTS_KEY = 'amafh-v2.mock-import-results.v1'
export const ATTENDANCE_KEY = 'amafh-v2.mock-attendance.v1'
const headers: Record<ImportKind, string[]> = {
  attendance: ['userEmail', 'date', 'status'],
  'case-stage': ['caseNumber', 'stage'],
  users: ['fullName', 'email', 'userType', 'organization', 'organizationScope', 'officeBranch', 'department', 'team'],
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (quoted) { if (char === '"' && source[index + 1] === '"') { cell += '"'; index++ } else if (char === '"') quoted = false; else cell += char }
    else if (char === '"' && !cell) quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') { if (char === '\r' && source[index + 1] === '\n') index++; row.push(cell); if (row.some(value => value.trim())) rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted value.')
  if (cell || row.length) { row.push(cell); if (row.some(value => value.trim())) rows.push(row) }
  return rows
}
export async function readCsvFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv') || file.size > 2 * 1024 * 1024 || file.size === 0) throw new Error('Choose a non-empty CSV file no larger than 2 MB.')
  const text = await file.text()
  if (text.includes('\0')) throw new Error('Binary files are not supported.')
  return text
}
function readArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key)
  if (raw === null) return []
  try { const value: unknown = JSON.parse(raw); if (Array.isArray(value)) return value as T[] } catch { /* handled below */ }
  throw new Error('Local import data could not be read.')
}
function writeArray<T>(key: string, rows: T[]) { try { localStorage.setItem(key, JSON.stringify(rows)) } catch { throw new Error('Could not save local import results.') } }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value }
export async function previewImport(kind: ImportKind, csv: string): Promise<ImportPreview> {
  const parsed = parseCsv(csv)
  if (!parsed.length || parsed[0].map(value => value.trim()).join('|') !== headers[kind].join('|')) throw new Error(`CSV headers must be: ${headers[kind].join(', ')}`)
  if (parsed.length > 1001) throw new Error('Import at most 1000 rows at a time.')
  const [users, cases, catalogue, existingAttendance] = await Promise.all([mockUsersRepository.list(), caseRepository.list(), banksProductsRepository.list(), Promise.resolve(readArray<AttendanceRecord>(ATTENDANCE_KEY))])
  const stages = (await Promise.all(catalogue.filter(item => item.kind === 'products').map(item => productStagesRepository.list(item.id)))).flat()
  const seen = new Set<string>()
  let matchedCases = 0; let unmatchedCases = 0
  const rows: ImportRow[] = parsed.slice(1).map((cells, index) => {
    const values = Object.fromEntries(headers[kind].map((header, position) => [header, cells[position]?.trim() ?? '']))
    const errors: string[] = []
    if (cells.length !== headers[kind].length) errors.push('Incorrect column count.')
    if (kind === 'attendance') {
      const user = users.find(item => item.email.toLowerCase() === values.userEmail.toLowerCase())
      if (!user) errors.push('User email was not found.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || Number.isNaN(Date.parse(`${values.date}T00:00:00Z`)) || !validDate(values.date)) errors.push('Invalid date.')
      if (!['Present', 'Absent', 'Late'].includes(values.status)) errors.push('Invalid attendance status.')
      const key = `${values.userEmail.toLowerCase()}:${values.date}`
      if (seen.has(key) || existingAttendance.some(item => item.userId === user?.id && item.date === values.date)) errors.push('Duplicate attendance entry.')
      seen.add(key)
    } else if (kind === 'case-stage') {
      const item = cases.find(record => record.caseNumber === values.caseNumber || record.id === values.caseNumber)
      if (!item) { errors.push('Case was not found.'); unmatchedCases++ } else {
        matchedCases++
        const product = catalogue.find(record => record.kind === 'products' && (record.id === item.productId || record.name === item.product && catalogue.some(bank => bank.kind === 'banks' && bank.id === record.parentId && bank.name === item.bank)))
        const stage = stages.find(record => record.productId === product?.id && record.name === values.stage && record.status === 'active')
        if (!stage) errors.push('Stage is not active for this Case Product.')
        if (item.status !== 'SM Approved' || !item.coordinatorId || !item.submittedAt) errors.push('Case is not ready for stage tracking.')
        if (item.stageId === stage?.id) errors.push('Case is already in this Stage.')
      }
      if (seen.has(values.caseNumber)) errors.push('Duplicate Case row.'); seen.add(values.caseNumber)
    } else {
      const email = values.email.toLowerCase()
      const userDraft: UserDraft = { ...emptyUserDraft(), fullName: values.fullName, email, userType: values.userType, organization: values.organization, organizationScope: values.organizationScope as UserDraft['organizationScope'], officeBranch: values.officeBranch, department: values.department, team: values.team }
      errors.push(...Object.values(validateUserDraft(userDraft, users)))
      if (seen.has(email)) errors.push('Duplicate email in CSV.'); seen.add(email)
    }
    return { line: index + 2, values, errors }
  })
  return { kind, rows, valid: rows.filter(row => !row.errors.length).length, invalid: rows.filter(row => row.errors.length).length, matchedCases, unmatchedCases }
}
export const importRepository = {
  async history() { return readArray<ImportResult>(IMPORT_RESULTS_KEY) },
  async attendance() { return readArray<AttendanceRecord>(ATTENDANCE_KEY) },
  async confirm(preview: ImportPreview, actorId: string) {
    await requireAction('Imports', preview.kind, actorId)
    if (!preview.rows.length || preview.valid === 0) throw new Error('No valid rows are available to import.')
    const fresh = await previewImport(preview.kind, [headers[preview.kind].join(','), ...preview.rows.map(row => headers[preview.kind].map(header => `"${row.values[header].replaceAll('"', '""')}"`).join(','))].join('\n'))
    const results: string[] = []; let success = 0
    const [users, cases, catalogue] = await Promise.all([mockUsersRepository.list(), caseRepository.list(), banksProductsRepository.list()])
    const stages = (await Promise.all(catalogue.filter(item => item.kind === 'products').map(item => productStagesRepository.list(item.id)))).flat()
    const attendance = readArray<AttendanceRecord>(ATTENDANCE_KEY)
    for (const row of fresh.rows) {
      if (row.errors.length) { results.push(`Line ${row.line}: ${row.errors.join(' ')}`); continue }
      try {
        if (preview.kind === 'attendance') {
          const user = users.find(item => item.email.toLowerCase() === row.values.userEmail.toLowerCase())!
          attendance.push({ id: crypto.randomUUID(), userId: user.id, date: row.values.date, status: row.values.status as AttendanceRecord['status'], importedAt: new Date().toISOString(), importedBy: actorId })
        } else if (preview.kind === 'case-stage') {
          await requireAction('Cases', 'update-stage', actorId)
          const item = cases.find(record => record.caseNumber === row.values.caseNumber || record.id === row.values.caseNumber)!
          const product = catalogue.find(record => record.kind === 'products' && (record.id === item.productId || record.name === item.product && catalogue.some(bank => bank.kind === 'banks' && bank.id === record.parentId && bank.name === item.bank)))!
          const stage = stages.find(record => record.productId === product.id && record.name === row.values.stage)!
          if (item.coordinatorId !== actorId) throw new Error('Acting user is not the assigned Case Coordinator.')
          await caseRepository.update(item.id, { action: 'update-stage', actorId, value: stage.id })
        } else {
          const values = row.values
          await mockUsersRepository.createFromImport({ ...emptyUserDraft(), fullName: values.fullName, email: values.email, userType: values.userType, organization: values.organization, organizationScope: values.organizationScope as UserDraft['organizationScope'], officeBranch: values.officeBranch, department: values.department, team: values.team }, actorId)
        }
        success++
      } catch (cause) { results.push(`Line ${row.line}: ${cause instanceof Error ? cause.message : 'Import failed.'}`) }
    }
    if (preview.kind === 'attendance') writeArray(ATTENDANCE_KEY, attendance)
    const result: ImportResult = { id: crypto.randomUUID(), kind: preview.kind, at: new Date().toISOString(), actorId, success, failed: preview.rows.length - success, details: results }
    writeArray(IMPORT_RESULTS_KEY, [...readArray<ImportResult>(IMPORT_RESULTS_KEY), result]); return result
  },
}
