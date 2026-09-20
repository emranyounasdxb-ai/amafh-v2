import { Download, Printer, Send } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import type { StatusTone } from '../ui/badge'
import { Card } from '../ui/card'
import { FileItem } from '../files/file-item'
import { WorkspaceState } from '../feedback/workspace-state'
import './document.css'

export interface DocumentRecord { id: string; name: string; detail?: string; status?: string; tone?: StatusTone; onDownload?: () => void }
export function DocumentList({ documents, emptyMessage = 'No documents available.' }: { documents: DocumentRecord[]; emptyMessage?: string }) { return documents.length ? <div className="amafh-document-list">{documents.map(document => <FileItem key={document.id} name={document.name} detail={document.detail} status={document.status} tone={document.tone} onDownload={document.onDownload} />)}</div> : <WorkspaceState kind="empty" title={emptyMessage} /> }

export interface DocumentViewerProps { title: string; pdfUrl?: string; status?: string; tone?: StatusTone; metadata?: ReactNode; onDownload?: () => void; onPrint?: () => void; onSend?: () => void; actions?: ReactNode }
export function DocumentViewer({ title, pdfUrl, status, tone = 'neutral', metadata, onDownload, onPrint, onSend, actions }: DocumentViewerProps) { return <Card className="amafh-document-viewer"><div className="amafh-document-viewer__header"><div><h2 className="amafh-h4">{title}</h2>{metadata && <div className="amafh-document-viewer__metadata">{metadata}</div>}</div>{status && <Badge tone={tone}>{status}</Badge>}</div><div className="amafh-document-viewer__actions">{onDownload && <Button variant="outline" onClick={onDownload} icon={<Download size={16} aria-hidden="true" strokeWidth={1.75} />}>Download</Button>}{onPrint && <Button variant="outline" onClick={onPrint} icon={<Printer size={16} aria-hidden="true" strokeWidth={1.75} />}>Print</Button>}{onSend && <Button variant="outline" onClick={onSend} icon={<Send size={16} aria-hidden="true" strokeWidth={1.75} />}>Send</Button>}{actions}</div>{pdfUrl ? <iframe className="amafh-document-viewer__preview" title={`Preview: ${title}`} src={pdfUrl} /> : <WorkspaceState kind="empty" title="Preview unavailable" description="Download the document to view it." />}</Card> }
