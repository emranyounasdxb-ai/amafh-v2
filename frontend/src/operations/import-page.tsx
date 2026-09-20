import { useEffect, useState } from 'react'
import { Workspace } from '../templates/workspace'
import { FormSection, DetailSection } from '../patterns/shared-patterns'
import { Button } from '../components/ui/button'
import { FileUpload } from '../components/files/file-upload'
import { DataTable, type DataTableColumn } from '../components/data-table/data-table'
import { WorkspaceState } from '../components/feedback/workspace-state'
import { usePermissionPreview } from './permissions'
import { PermissionActor, PermissionGate } from './ui'
import { importRepository, previewImport, readCsvFile, type ImportKind, type ImportPreview, type ImportResult, type ImportRow } from './csv-imports'
import { apiImportRepository } from './api-csv-imports'
import './operations.css'

const options: { id: ImportKind; label: string }[] = [{ id: 'attendance', label: 'Attendance' }, { id: 'case-stage', label: 'Case Status / Stage' }, { id: 'users', label: 'One-time Users / Employees' }]
const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
export function ImportPage({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const kind = (path.split('/')[2] ?? 'attendance') as ImportKind
  const preview = usePermissionPreview()
  const [candidate, setCandidate] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [history, setHistory] = useState<ImportResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setCandidate(null); setResult(null); setError(''); void (apiMode ? apiImportRepository : importRepository).history().then(setHistory).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load import history.')) }, [kind])
  const columns: DataTableColumn<ImportRow>[] = [{ id: 'line', header: 'Line', value: item => item.line }, { id: 'values', header: 'Values', value: item => Object.values(item.values).join(' · '), width: 340 }, { id: 'validation', header: 'Validation', value: item => item.errors.length ? item.errors.join(' ') : 'Valid', width: 300 }]
  const load = async (files: File[]) => {
    setCandidate(null); setResult(null); setError('')
    if (!files[0]) return
    setBusy(true)
    try { const csv = await readCsvFile(files[0]); setCandidate(await (apiMode ? apiImportRepository.preview(kind, csv) : previewImport(kind, csv))) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not validate CSV.') }
    finally { setBusy(false) }
  }
  const confirm = async () => {
    if (!candidate || !preview.can('Imports', kind)) return
    setBusy(true); setError('')
    try { const imported = apiMode ? await apiImportRepository.confirm(candidate) : await importRepository.confirm(candidate, preview.actorId); setResult(imported); setHistory(await (apiMode ? apiImportRepository : importRepository).history()); setCandidate(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not import CSV.') }
    finally { setBusy(false) }
  }
  return <Workspace title="CSV Imports" description="Controlled intake with validation and preview before confirmation.">
    <div className="amafh-ops-actions">{options.map(item => <Button key={item.id} variant={item.id === kind ? 'primary' : 'secondary'} onClick={() => onNavigate(`/imports/${item.id}`)}>{item.label}</Button>)}</div>
    <PermissionActor preview={preview} />
    {!options.some(item => item.id === kind) ? <WorkspaceState kind="empty" title="Import type not found" /> : <PermissionGate preview={preview} domain="Imports" action={kind}><div className="amafh-ops-grid amafh-import-results">
      <FormSection title={`${options.find(item => item.id === kind)?.label} CSV`} description="CSV files only. Invalid rows remain excluded and visible in the validation report."><FileUpload key={kind} label={`Upload ${options.find(item => item.id === kind)?.label} CSV`} accept=".csv,text/csv" maxSizeBytes={2 * 1024 * 1024} onFilesSelected={files => { void load(files) }} /><p>Required headers: {kind === 'attendance' ? 'userEmail, date, status' : kind === 'case-stage' ? 'caseNumber, stage' : 'fullName, email, userType, organization, organizationScope, officeBranch, department, team'}</p></FormSection>
      {busy && <WorkspaceState kind="loading" title="Validating import" />}{error && <p role="alert" className="amafh-case-error">{error}</p>}
      {candidate && <><DetailSection title="Validation summary" items={[{ label: 'Valid rows', value: candidate.valid }, { label: 'Invalid rows', value: candidate.invalid }, ...(kind === 'case-stage' ? [{ label: 'Matched Cases', value: candidate.matchedCases }, { label: 'Unmatched Cases', value: candidate.unmatchedCases }] : [])]} /><DataTable tableId={`csv-preview-${kind}`} caption="Import preview" columns={columns} rows={candidate.rows} rowId={item => String(item.line)} pageSize={10} /><Button disabled={!candidate.valid || busy} onClick={() => { void confirm() }}>Confirm Import</Button></>}
      {result && <DetailSection title="Import result" items={[{ label: 'Imported by', value: preview.users.find(item => item.id === result.actorId)?.fullName ?? result.actorId }, { label: 'Imported at', value: new Date(result.at).toLocaleString() }, { label: 'Successful', value: result.success }, { label: 'Failed / skipped', value: result.failed }, { label: 'Details', value: result.details.length ? result.details.join(' · ') : 'No errors' }]} />}
      <FormSection title="Import history">{history.length ? <ul>{[...history].reverse().map(item => <li key={item.id}>{item.kind} · {new Date(item.at).toLocaleString()} · {item.success} imported · {item.failed} failed/skipped</li>)}</ul> : <p>No imports yet.</p>}</FormSection>
    </div></PermissionGate>}
  </Workspace>
}
