import './application-shell.css'

export interface BreadcrumbItem { label: string; href?: string }
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) { return <nav className="amafh-breadcrumb" aria-label="Breadcrumb"><ol>{items.map((item, index) => <li key={`${item.label}-${index}`}>{index > 0 && <span aria-hidden="true">/</span>}{index === items.length - 1 ? <span aria-current="page">{item.label}</span> : item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}</li>)}</ol></nav> }
