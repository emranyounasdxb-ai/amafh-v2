import { useEffect, useId, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import './date-picker.css'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function fromIso(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}
export function toIso(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
export function display(value?: string) {
  const date = fromIso(value)
  return date ? `${String(date.getUTCDate()).padStart(2, '0')} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}` : ''
}
function parse(value: string) {
  const match = value.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!match) return null
  const month = months.findIndex(item => item.toLowerCase() === match[2].toLowerCase())
  if (month < 0) return null
  return fromIso(`${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`)
}
export function localToday() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}
export function addDays(date: Date, count: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + count))
}
export function firstOfMonth(date: Date, count = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1))
}
export function sameDayNextMonth(date: Date, count: number) {
  const first = firstOfMonth(date, count)
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)))
}

export interface DatePickerProps {
  label: string
  value?: string
  onValueChange: (value: string) => void
  min?: string
  max?: string
  disabled?: boolean
  required?: boolean
  error?: string
  helperText?: string
}

export function DatePicker({ label, value, onValueChange, min, max, disabled, required, error, helperText }: DatePickerProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const selected = fromIso(value)
  const [input, setInput] = useState(display(value))
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => firstOfMonth(selected ?? localToday()))
  const [focused, setFocused] = useState(() => toIso(selected ?? localToday()))
  const [parseError, setParseError] = useState('')

  useEffect(() => setInput(display(value)), [value])
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const minDate = fromIso(min)
  const maxDate = fromIso(max)
  const within = (date: Date) => (!minDate || date >= minDate) && (!maxDate || date <= maxDate)
  const choose = (date: Date, focusTrigger = false) => {
    if (!within(date)) return
    const iso = toIso(date)
    onValueChange(iso)
    setInput(display(iso))
    setParseError('')
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }
  const moveFocus = (date: Date) => {
    const iso = toIso(date)
    setFocused(iso)
    setMonth(firstOfMonth(date))
    requestAnimationFrame(() => dayRefs.current[iso]?.focus())
  }
  const changeMonth = (count: number) => moveFocus(firstOfMonth(month, count))
  const close = () => { setOpen(false); triggerRef.current?.focus() }
  const onDayKey = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const weekIndex = (date.getUTCDay() + 6) % 7
    const next = event.key === 'ArrowRight' ? addDays(date, 1)
      : event.key === 'ArrowLeft' ? addDays(date, -1)
      : event.key === 'ArrowDown' ? addDays(date, 7)
      : event.key === 'ArrowUp' ? addDays(date, -7)
      : event.key === 'PageDown' ? sameDayNextMonth(date, 1)
      : event.key === 'PageUp' ? sameDayNextMonth(date, -1)
      : event.key === 'Home' ? addDays(date, -weekIndex)
      : event.key === 'End' ? addDays(date, 6 - weekIndex)
      : null
    if (next) { event.preventDefault(); moveFocus(next) }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
  }
  const onInputBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (event.relatedTarget && rootRef.current?.contains(event.relatedTarget as Node)) return
    if (!input.trim()) { if (value) onValueChange(''); return }
    const date = parse(input)
    if (date && within(date)) choose(date)
    else setParseError('Use DD MMM YYYY within the allowed range.')
  }
  const toggle = () => {
    const date = selected ?? localToday()
    setMonth(firstOfMonth(date))
    setFocused(toIso(date))
    setOpen(!open)
    if (!open) requestAnimationFrame(() => dayRefs.current[toIso(date)]?.focus())
  }

  const start = firstOfMonth(month)
  const offset = (start.getUTCDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index - offset))
  const monthName = `${new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(month)} ${month.getUTCFullYear()}`
  const message = error || parseError || helperText

  return <div className="amafh-field amafh-date-field" ref={rootRef} onKeyDown={event => { if (open && event.key === 'Escape') { event.stopPropagation(); close() } }}>
    <label className="amafh-field__label" htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    <div className="amafh-date-field__entry">
      <input id={id} className="amafh-field__control" value={input} onChange={event => { setInput(event.target.value); setParseError('') }} onBlur={onInputBlur} placeholder="DD MMM YYYY" disabled={disabled} required={required} aria-invalid={Boolean(error || parseError) || undefined} aria-describedby={message ? `${id}-message` : undefined} />
      <button ref={triggerRef} type="button" aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={open} aria-controls={open ? `${id}-calendar` : undefined} disabled={disabled} onClick={toggle}><CalendarDays size={18} aria-hidden="true" /></button>
    </div>
    {message && <p id={`${id}-message`} role={error || parseError ? 'alert' : undefined} className={`amafh-field__message ${error || parseError ? 'amafh-field__message--error' : ''}`}>{message}</p>}
    {open && <div id={`${id}-calendar`} className="amafh-calendar" role="group" aria-label={`${label} calendar`}>
      <div className="amafh-calendar__header"><button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button><strong aria-live="polite">{monthName}</strong><button type="button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button></div>
      <div className="amafh-calendar__weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="amafh-calendar__days">{days.map(date => {
        const iso = toIso(date)
        return <button key={iso} ref={node => { dayRefs.current[iso] = node }} type="button" className={date.getUTCMonth() === month.getUTCMonth() ? '' : 'amafh-calendar__outside'} aria-label={new Intl.DateTimeFormat('en', { dateStyle: 'full', timeZone: 'UTC' }).format(date)} aria-pressed={value === iso} aria-current={iso === toIso(localToday()) ? 'date' : undefined} tabIndex={focused === iso ? 0 : -1} disabled={!within(date)} onKeyDown={event => onDayKey(event, date)} onClick={() => choose(date, true)}>{date.getUTCDate()}</button>
      })}</div>
    </div>}
  </div>
}

export interface DateRangeValue { start: string; end: string }
export interface DateRangePickerProps { label: string; value: DateRangeValue; onValueChange: (value: DateRangeValue) => void; min?: string; max?: string; disabled?: boolean; error?: string }
export function DateRangePicker({ label, value, onValueChange, min, max, disabled, error }: DateRangePickerProps) {
  return <fieldset className="amafh-date-range"><legend className="amafh-field__label">{label}</legend><div>
    <DatePicker label="Start date" value={value.start} min={min} max={max} disabled={disabled} error={error} onValueChange={start => onValueChange({ start, end: value.end && start && start > value.end ? '' : value.end })} />
    <DatePicker label="End date" value={value.end} min={value.start || min} max={max} disabled={disabled} onValueChange={end => onValueChange({ ...value, end })} />
  </div></fieldset>
}
