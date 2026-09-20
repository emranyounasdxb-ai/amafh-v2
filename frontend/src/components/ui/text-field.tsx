import { useId } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import './ui.css'

type SharedFieldProps = { label: string; helperText?: string; error?: string; optional?: boolean }
export type TextFieldProps = SharedFieldProps & InputHTMLAttributes<HTMLInputElement>
export type TextareaFieldProps = SharedFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>

export function TextField({ label, helperText, error, optional, id, className = '', required, ...props }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const messageId = `${fieldId}-message`
  return <div className={`amafh-field ${className}`}>
    <label htmlFor={fieldId} className="amafh-field__label">{label}{required && <span aria-hidden="true"> *</span>}{optional && <span className="amafh-field__optional"> (optional)</span>}</label>
    <input id={fieldId} className="amafh-field__control" aria-invalid={Boolean(error) || undefined} aria-describedby={error || helperText ? messageId : undefined} required={required} {...props} />
    {(error || helperText) && <p id={messageId} role={error ? 'alert' : undefined} className={`amafh-field__message ${error ? 'amafh-field__message--error' : ''}`}>{error || helperText}</p>}
  </div>
}

export function TextareaField({ label, helperText, error, optional, id, className = '', required, ...props }: TextareaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const messageId = `${fieldId}-message`
  return <div className={`amafh-field ${className}`}>
    <label htmlFor={fieldId} className="amafh-field__label">{label}{required && <span aria-hidden="true"> *</span>}{optional && <span className="amafh-field__optional"> (optional)</span>}</label>
    <textarea id={fieldId} className="amafh-field__control amafh-field__control--textarea" aria-invalid={Boolean(error) || undefined} aria-describedby={error || helperText ? messageId : undefined} required={required} {...props} />
    {(error || helperText) && <p id={messageId} role={error ? 'alert' : undefined} className={`amafh-field__message ${error ? 'amafh-field__message--error' : ''}`}>{error || helperText}</p>}
  </div>
}
