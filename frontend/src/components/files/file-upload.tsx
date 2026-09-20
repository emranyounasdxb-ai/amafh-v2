import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '../ui/button'
import { Alert } from '../feedback/alert'
import { FileItem } from './file-item'
import './file-item.css'

export interface FileUploadProps { label: string; accept?: string; multiple?: boolean; maxSizeBytes?: number; progress?: number; status?: 'idle' | 'uploading' | 'success' | 'error'; statusMessage?: string; onFilesSelected: (files: File[]) => void }

export function FileUpload({ label, accept, multiple = false, maxSizeBytes, progress, status = 'idle', statusMessage, onFilesSelected }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<File[]>([])
  const [error, setError] = useState('')
  const handleFiles = (files: File[]) => {
    const next = multiple ? files : files.slice(0, 1)
    const accepted = accept?.split(',').map(part => part.trim().toLowerCase()).filter(Boolean)
    const invalid = accepted?.length ? next.find(file => !accepted.some(rule => rule.startsWith('.') ? file.name.toLowerCase().endsWith(rule) : rule.endsWith('/*') ? file.type.toLowerCase().startsWith(rule.slice(0, -1)) : file.type.toLowerCase() === rule)) : undefined
    if (invalid) { setError(`${invalid.name} is not an accepted file type.`); return }
    const oversized = next.find(file => maxSizeBytes !== undefined && file.size > maxSizeBytes)
    if (oversized) { setError(`${oversized.name} exceeds the allowed file size.`); return }
    const duplicate = next.find(file => selected.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))
    if (duplicate) { setError(`${duplicate.name} is already selected. Remove it before choosing the same file again.`); return }
    const updated = multiple ? [...selected, ...next] : next
    setSelected(updated)
    setError('')
    onFilesSelected(updated)
  }
  const onChange = (event: ChangeEvent<HTMLInputElement>) => { handleFiles(Array.from(event.target.files ?? [])); event.target.value = '' }
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); handleFiles(Array.from(event.dataTransfer.files)) }
  return <div className="amafh-file-upload">
    <div className="amafh-file-upload__dropzone" onDragOver={event => event.preventDefault()} onDrop={onDrop}>
      <Upload size={24} strokeWidth={1.75} aria-hidden="true" />
      <strong>{label}</strong>
      <span>Choose a file or drop it here.</span>
      <Button variant="outline" onClick={() => inputRef.current?.click()}>Choose file</Button>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="amafh-sr-only" tabIndex={-1} aria-label={label} onChange={onChange} />
    </div>
    {error && <Alert tone="danger" title="File not accepted">{error}</Alert>}
    {status === 'uploading' && <div className="amafh-file-upload__progress" role="status"><span>{statusMessage ?? 'Uploading files'}</span><progress value={Math.max(0, Math.min(100, progress ?? 0))} max={100} aria-label="Upload progress" /><span>{Math.round(Math.max(0, Math.min(100, progress ?? 0)))}%</span></div>}
    {status === 'success' && <Alert tone="success" title="Upload complete">{statusMessage}</Alert>}
    {status === 'error' && <Alert tone="danger" title="Upload failed">{statusMessage ?? 'Try again.'}</Alert>}
    {selected.map((file, index) => <FileItem key={`${file.name}-${file.lastModified}-${index}`} name={file.name} detail={`${Math.ceil(file.size / 1024)} KB · Selected`} onRemove={() => { const next = selected.filter((_, item) => item !== index); setSelected(next); onFilesSelected(next) }} />)}
  </div>
}
