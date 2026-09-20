import { FileText, Download, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import type { StatusTone } from '../ui/badge'
import './file-item.css'

export interface FileItemProps { name: string; detail?: string; status?: string; tone?: StatusTone; onDownload?: () => void; onRemove?: () => void }
export function FileItem({ name, detail, status, tone = 'neutral', onDownload, onRemove }: FileItemProps) {
  return <div className="amafh-file-item"><FileText size={24} strokeWidth={1.75} aria-hidden="true" /><div className="amafh-file-item__identity"><strong>{name}</strong>{detail && <span>{detail}</span>}</div>{status && <Badge tone={tone}>{status}</Badge>}<div className="amafh-file-item__actions">{onDownload && <Button variant="outline" size="compact" onClick={onDownload} icon={<Download size={16} aria-hidden="true" strokeWidth={1.75} />}>Download</Button>}{onRemove && <Button variant="outline" size="compact" onClick={onRemove} icon={<X size={16} aria-hidden="true" strokeWidth={1.75} />}>Remove</Button>}</div></div>
}
