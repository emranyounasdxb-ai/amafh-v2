import { useEffect, useRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import './ui.css'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> { label: string; indeterminate?: boolean }
export function Checkbox({ label, indeterminate = false, className = '', ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return <label className={`amafh-selection ${className}`}><input ref={ref} type="checkbox" {...props} /><span>{label}</span></label>
}

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> { label: string }
export function Radio({ label, className = '', ...props }: RadioProps) { return <label className={`amafh-selection ${className}`}><input type="radio" {...props} /><span>{label}</span></label> }

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> { label: string }
export function Switch({ label, className = '', ...props }: SwitchProps) { return <label className={`amafh-selection amafh-switch ${className}`}><input type="checkbox" role="switch" {...props} /><span>{label}</span></label> }
