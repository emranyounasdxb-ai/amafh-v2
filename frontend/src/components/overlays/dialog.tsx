import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import './overlays.css'

export interface DialogProps { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; actions?: ReactNode; size?: 'small' | 'medium' | 'large' | 'palette'; mode?: 'modal' | 'drawer'; side?: 'left' | 'right'; showClose?: boolean }

export function Dialog({ open, onClose, title, description, children, actions, size = 'medium', mode = 'modal', side = 'right', showClose = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])
  return <dialog ref={ref} className={`amafh-dialog amafh-dialog--${mode} amafh-dialog--${size} amafh-dialog--${side}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="amafh-dialog__header"><h2 className="amafh-h3" id={titleId}>{title}</h2>{showClose && <button type="button" className="amafh-dialog__close" aria-label="Close" onClick={onClose}><X size={18} strokeWidth={1.75} aria-hidden="true" /></button>}</div>
    {description && <p className="amafh-dialog__description" id={descriptionId}>{description}</p>}
    {children && <div className="amafh-dialog__body">{children}</div>}
    {actions && <div className="amafh-dialog__actions">{actions}</div>}
  </dialog>
}
