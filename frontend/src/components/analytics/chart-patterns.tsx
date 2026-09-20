import type { ReactNode } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { WorkspaceState } from '../feedback/workspace-state'
import './chart.css'

export type ChartState = 'ready' | 'loading' | 'empty' | 'no-results' | 'error' | 'partial' | 'disabled'
export interface ChartPanelProps { title: string; description?: string; period?: string; controls?: ReactNode; actions?: ReactNode; state?: ChartState; onRetry?: () => void; children?: ReactNode }

function ChartStateMessage({ title, state, onRetry }: { title: string; state: Exclude<ChartState, 'ready'>; onRetry?: () => void }) {
  const content = state === 'loading' ? ['Loading', 'Loading analytics…'] : state === 'empty' ? ['Empty', 'No data available for this period.'] : state === 'no-results' ? ['No data for selected filters', 'Adjust filters or choose another period.'] : state === 'error' ? ['Error', 'Unable to load analytics. Try again.'] : state === 'partial' ? ['Partial data', 'Some data is incomplete.'] : ['Disabled', 'Chart content and visible labels remain available.']
  return <Card className={`amafh-chart-state amafh-chart-state--${state}`} role={state === 'error' ? 'alert' : 'status'} aria-label={`${title}: ${content[0]}`}><span className="amafh-chart-state__marker" aria-hidden="true" /><strong>{content[0]}</strong><p>{content[1]}</p>{state === 'error' && onRetry && <Button size="compact" onClick={onRetry}>Try again</Button>}</Card>
}

export function ChartPanel({ title, description, period, controls, actions, state = 'ready', onRetry, children }: ChartPanelProps) {
  if (state !== 'ready') return <ChartStateMessage title={title} state={state} onRetry={onRetry} />
  return <Card className="amafh-chart amafh-chart-panel" role="group" aria-label={title}>
    <header className="amafh-chart-panel__header"><div><h3 className="amafh-h4">{title}</h3>{(description || period) && <p className="amafh-caption">{[description, period].filter(Boolean).join(' · ')}</p>}</div>{controls}<div className="amafh-chart-panel__actions">{actions}</div></header>
    {children}
  </Card>
}

export interface RankingDatum { label: string; value: number; comparison?: number }
export interface RankingProps { title: string; data: RankingDatum[]; variant?: 'horizontal' | 'top' | 'comparison' | 'compact'; valueLabel?: (value: number) => string }
export function Ranking({ title, data, variant = 'horizontal', valueLabel = value => String(value) }: RankingProps) {
  return <Card className={`amafh-ranking-card amafh-ranking-card--${variant}`} role="group" aria-label={title}>
    <h3 className="amafh-ranking__title">{title}</h3>
    {data.length ? <ol className="amafh-ranking">{data.map((item, index) => <li key={`${item.label}-${index}`}><span className="amafh-ranking__number">{index + 1}</span><span className="amafh-ranking__label">{item.label}</span><strong className={index === 0 ? 'amafh-ranking__leader' : ''}>{valueLabel(item.value)}</strong></li>)}</ol> : <WorkspaceState kind="empty" title="No data available" description="No ranking data is available for this period." />}
  </Card>
}
