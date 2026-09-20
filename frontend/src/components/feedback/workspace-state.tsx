import type { ReactNode } from 'react'
import './feedback.css'

export type WorkspaceStateKind = 'loading' | 'empty' | 'no-results' | 'error' | 'permission'
export interface WorkspaceStateProps { kind: WorkspaceStateKind; title: string; description?: string; action?: ReactNode }

export function WorkspaceState({ kind, title, description, action }: WorkspaceStateProps) {
  return <section className="amafh-workspace-state" role={kind === 'error' ? 'alert' : 'status'} aria-busy={kind === 'loading' || undefined}>
    {kind === 'loading' && <div className="amafh-workspace-state__skeleton" aria-hidden="true" />}
    <h2 className="amafh-h3">{title}</h2>
    {description && <p>{description}</p>}
    {action && <div className="amafh-workspace-state__action">{action}</div>}
  </section>
}
