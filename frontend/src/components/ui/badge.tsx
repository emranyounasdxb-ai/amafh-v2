import type { HTMLAttributes } from 'react'
import './ui.css'

export type StatusTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger'
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { tone?: StatusTone }

export function Badge({ tone = 'neutral', children, className = '', ...props }: BadgeProps) {
  return <span className={`amafh-badge amafh-badge--${tone} ${className}`} {...props}>{children}</span>
}
