import type { ReactNode } from 'react'
import { Breadcrumb } from '../components/navigation/breadcrumb'
import { Card } from '../components/ui/card'
import './template-routes.css'

export function TemplateBreadcrumb({ current }: { current: string }) {
  return <Breadcrumb items={[{ label: 'Templates', href: '/templates/dashboard' }, { label: current }]} />
}

export function Slot({ title, children, className = '' }: { title: string; children?: ReactNode; className?: string }) {
  return <Card className={`amafh-route-slot ${className}`}><h2>{title}</h2>{children && <div className="amafh-route-slot__body">{children}</div>}</Card>
}
