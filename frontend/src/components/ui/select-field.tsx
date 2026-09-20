import { useId } from 'react'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import './ui.css'

export interface SelectOption { value: string; label: string; disabled?: boolean }
export interface SelectFieldProps { label: string; options: SelectOption[]; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; placeholder?: string; disabled?: boolean; required?: boolean; error?: string; helperText?: string; labelHidden?: boolean }

export function SelectField({ label, options, value, defaultValue, onValueChange, placeholder = 'Select option', disabled, required, error, helperText, labelHidden = false }: SelectFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  return <div className="amafh-field"><label htmlFor={id} className={`amafh-field__label${labelHidden ? ' amafh-sr-only' : ''}`}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    <Select.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled} required={required}>
      <Select.Trigger id={id} className="amafh-select-trigger" aria-invalid={Boolean(error) || undefined} aria-describedby={error || helperText ? messageId : undefined}><Select.Value placeholder={placeholder} /><Select.Icon><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></Select.Icon></Select.Trigger>
      <Select.Portal><Select.Content className="amafh-select-content" position="popper" sideOffset={4} collisionPadding={12}><Select.Viewport>{options.map(option => <Select.Item key={option.value} value={option.value} disabled={option.disabled} className="amafh-select-item"><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check size={14} aria-hidden="true" strokeWidth={1.75} /></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
    </Select.Root>
    {(error || helperText) && <p id={messageId} role={error ? 'alert' : undefined} className={`amafh-field__message ${error ? 'amafh-field__message--error' : ''}`}>{error || helperText}</p>}
  </div>
}
