import type { ReactNode } from 'react'
import './page-header.css'

export interface PageHeaderProps { title: string; description?: string; actions?: ReactNode; breadcrumb?: ReactNode }

export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return <header className="amafh-page-header">
    {breadcrumb && <div className="amafh-page-header__breadcrumb">{breadcrumb}</div>}
    <div className="amafh-page-header__row"><div className="amafh-page-header__copy"><h1 className="amafh-h2">{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="amafh-page-header__actions">{actions}</div>}</div>
  </header>
}
