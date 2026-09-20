import type { ReactNode } from 'react'
import { Card } from '../ui/card'
import '../ui/ui.css'

export interface KpiProps { label: string; value?: string | number; change?: string; tone?: 'positive' | 'negative' | 'neutral'; state?: 'ready' | 'loading' | 'empty' | 'error'; footer?: ReactNode }

export function Kpi({ label, value, change, tone = 'neutral', state = 'ready', footer }: KpiProps) {
  return <Card className="amafh-kpi"><span className="amafh-label-sm">{label}</span><strong className="amafh-h2">{state === 'loading' ? '…' : state === 'error' ? 'Unavailable' : state === 'empty' ? '—' : value}</strong>{change && state === 'ready' && <span className={`amafh-kpi__change amafh-kpi__change--${tone}`}>{change}</span>}{footer}</Card>
}
