import type { ReactNode } from 'react'
import { PageHeader } from '../patterns/page-header/page-header'
import './workspace.css'

export interface WorkspaceProps { title: string; description?: string; breadcrumb?: ReactNode; actions?: ReactNode; toolbar?: ReactNode; children: ReactNode; footer?: ReactNode; supporting?: ReactNode }

export function Workspace({ title, description, breadcrumb, actions, toolbar, children, footer, supporting }: WorkspaceProps) {
  return <main className="amafh-workspace"><PageHeader title={title} description={description} breadcrumb={breadcrumb} actions={actions} />{toolbar && <div className="amafh-workspace__toolbar">{toolbar}</div>}<div className={`amafh-workspace__content ${supporting ? 'amafh-workspace__content--split' : ''}`}><div className="amafh-workspace__primary">{children}</div>{supporting && <aside className="amafh-workspace__supporting">{supporting}</aside>}</div>{footer && <div className="amafh-workspace__footer">{footer}</div>}</main>
}

export interface DashboardGridProps { children: ReactNode }
export function DashboardGrid({ children }: DashboardGridProps) { return <div className="amafh-dashboard-grid">{children}</div> }

export interface FormWorkspaceProps extends Omit<WorkspaceProps, 'supporting'> { aside?: ReactNode }
export function FormWorkspace({ aside, ...props }: FormWorkspaceProps) { return <Workspace {...props} supporting={aside} /> }
