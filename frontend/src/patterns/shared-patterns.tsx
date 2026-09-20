import type { ReactNode } from 'react'
import { Avatar } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import type { BadgeProps } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Dialog } from '../components/overlays/dialog'
import { TextField } from '../components/ui/text-field'
import './shared-patterns.css'

export interface SearchToolbarProps { query: string; onQueryChange: (query: string) => void; filters?: ReactNode; actions?: ReactNode; resultCount?: number }
export function SearchToolbar({ query, onQueryChange, filters, actions, resultCount }: SearchToolbarProps) { return <div className="amafh-toolbar"><div className="amafh-toolbar__search"><TextField label="Search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search" /></div>{filters}{resultCount !== undefined && <span className="amafh-toolbar__count">{resultCount} results</span>}{actions && <div className="amafh-toolbar__actions">{actions}</div>}</div> }

export interface BulkActionToolbarProps { count: number; actions: ReactNode; onClear: () => void }
export function BulkActionToolbar({ count, actions, onClear }: BulkActionToolbarProps) { return <div className="amafh-toolbar amafh-toolbar--bulk" role="region" aria-label="Selected item actions"><strong>{count} selected</strong><div className="amafh-toolbar__actions">{actions}</div><Button variant="secondary" onClick={onClear}>Clear selection</Button></div> }

export interface FormSectionProps { title: string; description?: string; children: ReactNode; actions?: ReactNode }
export function FormSection({ title, description, children, actions }: FormSectionProps) { return <Card className="amafh-section"><div className="amafh-section__header"><div><h2 className="amafh-h4">{title}</h2>{description && <p>{description}</p>}</div>{actions}</div><div className="amafh-section__body">{children}</div></Card> }

export interface DetailItem { label: string; value: ReactNode }
export function DetailSection({ title, items, actions }: { title: string; items: DetailItem[]; actions?: ReactNode }) { return <FormSection title={title} actions={actions}><dl className="amafh-detail-grid">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></FormSection> }

export interface ProfileHeaderProps { name: string; subtitle?: string; imageSrc?: string; status?: string; statusTone?: BadgeProps['tone']; actions?: ReactNode; metadata?: ReactNode }
export function ProfileHeader({ name, subtitle, imageSrc, status, statusTone = 'neutral', actions, metadata }: ProfileHeaderProps) { return <div className="amafh-profile"><div className="amafh-profile__banner" /><div className="amafh-profile__main"><Avatar name={name} src={imageSrc} size="lg" /><div className="amafh-profile__identity"><h2 className="amafh-h3">{name}</h2>{subtitle && <p>{subtitle}</p>}{metadata}</div>{status && <Badge tone={statusTone}>{status}</Badge>}{actions && <div className="amafh-profile__actions">{actions}</div>}</div></div> }

export interface TimelineEvent { id: string; title: string; detail?: string; time?: string; tone?: BadgeProps['tone'] }
export function ActivityTimeline({ title, events }: { title: string; events: TimelineEvent[] }) { return <Card className="amafh-timeline"><h2 className="amafh-h4">{title}</h2>{events.length ? <ol>{events.map(event => <li key={event.id}><div><strong>{event.title}</strong>{event.tone && <Badge tone={event.tone}>{event.tone}</Badge>}</div>{event.detail && <p>{event.detail}</p>}{event.time && <time>{event.time}</time>}</li>)}</ol> : <p>No activity available.</p>}</Card> }

export interface ApprovalPanelProps { title: string; summary: ReactNode; status: string; tone?: BadgeProps['tone']; actions?: ReactNode; history?: ReactNode }
export function ApprovalPanel({ title, summary, status, tone = 'neutral', actions, history }: ApprovalPanelProps) { return <Card className="amafh-approval"><div className="amafh-section__header"><h2 className="amafh-h4">{title}</h2><Badge tone={tone}>{status}</Badge></div><div>{summary}</div>{history}{actions && <div className="amafh-approval__actions">{actions}</div>}</Card> }

export interface ConfirmationDialogProps { open: boolean; title: string; description: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; pending?: boolean; danger?: boolean }
export function ConfirmationDialog({ open, title, description, confirmLabel, onConfirm, onClose, pending, danger }: ConfirmationDialogProps) { return <Dialog open={open} onClose={onClose} title={title} description={description} actions={<><Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={pending}>{confirmLabel}</Button></>} /> }
