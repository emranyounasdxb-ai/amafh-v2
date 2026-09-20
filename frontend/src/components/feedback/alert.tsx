import type { HTMLAttributes } from 'react'
import type { StatusTone } from '../ui/badge'
import './feedback.css'

export interface AlertProps extends HTMLAttributes<HTMLDivElement> { tone?: Exclude<StatusTone, 'neutral' | 'brand'>; title: string }

export function Alert({ tone = 'info', title, children, className = '', ...props }: AlertProps) {
  return <div className={`amafh-alert amafh-alert--${tone} ${className}`} role={tone === 'danger' ? 'alert' : 'status'} {...props}>
    <strong>{title}</strong>{children && <div>{children}</div>}
  </div>
}
