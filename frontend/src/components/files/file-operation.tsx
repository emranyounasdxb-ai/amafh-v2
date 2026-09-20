import type { ReactNode } from 'react'
import { Alert } from '../feedback/alert'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { FileItem } from './file-item'
import './file-item.css'

export type FileOperationKind = 'upload' | 'import' | 'export' | 'pdf' | 'print'
export type FileOperationStage = 'idle' | 'validating' | 'preview' | 'running' | 'success' | 'partial' | 'error'
export interface CsvValidation { total: number; valid: number; invalid: number; duplicate: number }
export interface CsvValidationIssue { row: number; issue: string; detail: string; resolution: string }
export interface FileOperationProps { kind: FileOperationKind; title: string; description?: string; stage: FileOperationStage; fileName?: string; fileDetail?: string; scope?: string; recordCount?: number; validation?: CsvValidation; validationIssues?: CsvValidationIssue[]; preview?: ReactNode; message?: string; errors?: string[]; actionLabel?: string; onAction?: () => void; onCancel?: () => void; onDownload?: () => void }

export function CsvValidationSummary({ result, issues = [] }: { result: CsvValidation; issues?: CsvValidationIssue[] }) {
  const reconciled = result.total === result.valid + result.invalid + result.duplicate
  return <section className="amafh-csv-validation" aria-label="CSV validation result"><h3 className="amafh-h3">Validation result</h3><div className="amafh-csv-validation__metrics">{([['Total rows', result.total, 'neutral'], ['Valid rows', result.valid, 'success'], ['Invalid rows', result.invalid, 'danger'], ['Duplicate rows', result.duplicate, 'warning']] as const).map(([label, count, tone]) => <div key={label} className={`amafh-csv-validation__metric amafh-csv-validation__metric--${tone}`}><strong>{count}</strong><span>{label}</span></div>)}</div>{issues.length > 0 && <div className="amafh-csv-validation__issues" role="region" aria-label="Validation errors, scroll for more columns" tabIndex={0}><h4 className="amafh-h4">Validation errors</h4><table><thead><tr><th scope="col">Row</th><th scope="col">Issue</th><th scope="col">Detail</th><th scope="col">Resolution</th></tr></thead><tbody>{issues.map((item, index) => <tr key={`${item.row}-${index}`}><td>{item.row}</td><td>{item.issue}</td><td>{item.detail}</td><td>{item.resolution}</td></tr>)}</tbody></table></div>}{!reconciled && <Alert tone="danger" title="Validation totals do not match">Check the selected file before continuing.</Alert>}</section>
}

export function FileOperation({ kind, title, description, stage, fileName, fileDetail, scope, recordCount, validation, validationIssues, preview, message, errors = [], actionLabel, onAction, onCancel, onDownload }: FileOperationProps) {
  const pending = stage === 'validating' || stage === 'running'
  const resultTone = stage === 'success' ? 'success' : stage === 'partial' ? 'warning' : stage === 'error' ? 'danger' : 'info'
  const resultTitle = stage === 'success' ? 'Completed' : stage === 'partial' ? 'Partially completed' : stage === 'error' ? 'Could not complete' : stage === 'validating' ? 'Validating' : stage === 'running' ? 'Processing' : 'Review operation'
  return <Card className="amafh-file-operation" role="region" aria-label={`${kind} operation`}>
    <header><h2 className="amafh-h4">{title}</h2>{description && <p>{description}</p>}</header>
    {fileName && <FileItem name={fileName} detail={fileDetail} status={stage === 'validating' ? 'Validating' : stage === 'running' ? 'Processing' : stage === 'success' ? 'Ready' : undefined} tone={stage === 'success' ? 'success' : 'neutral'} onDownload={onDownload} />}
    {(scope || recordCount !== undefined) && <dl className="amafh-file-operation__context">{scope && <div><dt>Scope</dt><dd>{scope}</dd></div>}{recordCount !== undefined && <div><dt>Records</dt><dd>{recordCount}</dd></div>}</dl>}
    {validation && <CsvValidationSummary result={validation} issues={validationIssues} />}
    {preview && <div className="amafh-file-operation__preview"><h3 className="amafh-label">Preview</h3>{preview}</div>}
    {(message || errors.length > 0 || stage !== 'idle') && <Alert tone={resultTone} title={resultTitle}>{message}{errors.length > 0 && <ul>{errors.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>}</Alert>}
    {(onAction || onCancel) && <footer>{onCancel && <Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button>}{onAction && <Button onClick={onAction} loading={pending} disabled={stage === 'success' || Boolean(validation && validation.total !== validation.valid + validation.invalid + validation.duplicate)}>{actionLabel ?? (stage === 'error' ? 'Try again' : 'Continue')}</Button>}</footer>}
  </Card>
}

export interface FileOutputPreviewProps { title: string; description?: string; children: ReactNode; onPrint?: () => void; onDownloadPdf?: () => void }
export function FileOutputPreview({ title, description, children, onPrint, onDownloadPdf }: FileOutputPreviewProps) {
  return <section className="amafh-output-preview" aria-label={`${title} preview`}><div className="amafh-output-preview__toolbar"><Button variant="outline" onClick={onPrint ?? (() => window.print())}>Print</Button>{onDownloadPdf && <Button variant="outline" onClick={onDownloadPdf}>Download PDF</Button>}</div><div className="amafh-output-preview__page"><header><strong>AMAFH</strong><span>{title}</span></header>{description && <p>{description}</p>}{children}</div></section>
}
