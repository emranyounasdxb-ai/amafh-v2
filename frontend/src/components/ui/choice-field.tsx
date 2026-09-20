import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import './choice-field.css'

export interface ChoiceOption { value: string; label: string; disabled?: boolean }
export interface ChoiceFieldProps {
  label: string
  options: ChoiceOption[]
  value: string | string[]
  onValueChange: (value: string | string[]) => void
  mode?: 'combobox' | 'autocomplete' | 'multi-select'
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  error?: string
  helperText?: string
}

export function ChoiceField({ label, options, value, onValueChange, mode = 'combobox', placeholder = 'Search or select', disabled, loading, error, helperText }: ChoiceFieldProps) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const multi = mode === 'multi-select'
  const selected = Array.isArray(value) ? value : value ? [value] : []
  const matches = options.filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const selectable = matches.filter(option => !option.disabled)
  const choice = options.find(option => option.value === value)
  const text = open ? query : multi ? selected.length > 2 ? `${selected.length} selected · +${selected.length - 2}` : selected.map(item => options.find(option => option.value === item)?.label ?? item).join(', ') : choice?.label ?? (mode === 'autocomplete' && typeof value === 'string' ? value : '')

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setQuery('') } }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const select = (option: ChoiceOption) => {
    if (option.disabled) return
    if (multi) onValueChange(selected.includes(option.value) ? selected.filter(item => item !== option.value) : [...selected, option.value])
    else { onValueChange(option.value); setOpen(false) }
    setQuery('')
    setActive(0)
    input.current?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActive(index => !open ? 0 : Math.max(0, Math.min(selectable.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
    } else if (event.key === 'Enter' && open && selectable[active]) {
      event.preventDefault(); select(selectable[active])
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); setOpen(false); setQuery('')
    } else if (event.key === 'Backspace' && multi && !query && selected.length) {
      onValueChange(selected.slice(0, -1))
    }
  }
  const message = error || helperText

  return <div className="amafh-field amafh-choice" ref={root}>
    <label className="amafh-field__label" htmlFor={id}>{label}</label>
    <div className="amafh-choice__entry" data-open={open} data-invalid={Boolean(error)} data-disabled={Boolean(disabled)}>
      <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-listbox`} aria-activedescendant={open && selectable[active] ? `${id}-option-${selectable[active].value}` : undefined} aria-invalid={Boolean(error) || undefined} aria-describedby={message ? `${id}-message` : undefined} disabled={disabled} placeholder={placeholder} value={text} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true) }} onKeyDown={onKeyDown} />
      <button type="button" className="amafh-choice__toggle" aria-label={`Show ${label.toLowerCase()} options`} disabled={disabled} onClick={() => { if (open) { setOpen(false); setQuery('') } else input.current?.focus() }}><ChevronDown size={16} aria-hidden="true" strokeWidth={1.75} /></button>
    </div>
    {message && <p id={`${id}-message`} className={`amafh-field__message ${error ? 'amafh-field__message--error' : ''}`} role={error ? 'alert' : undefined}>{message}</p>}
    {open && !disabled && <div id={`${id}-listbox`} className="amafh-choice__list" role="listbox" aria-label={label} aria-multiselectable={multi || undefined}>
      {loading ? <p className="amafh-choice__state" role="status">Loading options…</p> : matches.length ? matches.map(option => <button type="button" role="option" id={`${id}-option-${option.value}`} className="amafh-choice__option" key={option.value} aria-selected={selected.includes(option.value)} disabled={option.disabled} data-active={selectable[active]?.value === option.value} onMouseDown={event => event.preventDefault()} onClick={() => select(option)}>{option.label}{selected.includes(option.value) && <Check size={16} aria-hidden="true" strokeWidth={1.75} />}</button>) : <p className="amafh-choice__state">No results found.</p>}
    </div>}
  </div>
}
