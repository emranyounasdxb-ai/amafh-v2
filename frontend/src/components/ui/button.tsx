import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './ui.css'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger'
export type ButtonSize = 'compact' | 'default' | 'large'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'default', loading = false, icon, children, className = '', disabled, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`amafh-button amafh-button--${variant} amafh-button--${size} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading ? <span className="amafh-button__spinner" aria-hidden="true" /> : icon}
    <span>{loading ? 'Loading…' : children}</span>
  </button>
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> { label: string; icon: ReactNode; variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }
export function IconButton({ label, icon, variant = 'secondary', size = 'default', loading = false, className = '', disabled, type = 'button', ...props }: IconButtonProps) { return <button type={type} aria-label={label} title={label} className={`amafh-button amafh-button--icon amafh-button--${variant} amafh-button--${size} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? <span className="amafh-button__spinner" aria-hidden="true" /> : icon}</button> }
