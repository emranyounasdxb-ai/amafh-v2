import { X } from 'lucide-react'
import type { StatusTone } from '../ui/badge'
import './feedback.css'

export interface ToastMessage { id: string; title: string; description?: string; tone?: Exclude<StatusTone, 'brand' | 'neutral'> }
export interface ToastRegionProps { messages: ToastMessage[]; onDismiss: (id: string) => void }
export function ToastRegion({ messages, onDismiss }: ToastRegionProps) { return <div className="amafh-toast-region" aria-label="Notifications">{messages.map(message => <div key={message.id} className={`amafh-toast amafh-toast--${message.tone ?? 'info'}`} role={message.tone === 'danger' ? 'alert' : 'status'}><div><strong>{message.title}</strong>{message.description && <p>{message.description}</p>}</div><button type="button" aria-label={`Dismiss ${message.title}`} onClick={() => onDismiss(message.id)}><X size={16} aria-hidden="true" strokeWidth={1.75} /></button></div>)}</div> }

export function Skeleton({ label = 'Loading', lines = 3 }: { label?: string; lines?: number }) { return <div className="amafh-skeleton" role="status" aria-label={label}>{Array.from({ length: Math.max(1, lines) }, (_, index) => <div key={index} aria-hidden="true" />)}</div> }
