import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { DatePicker, addDays, display, firstOfMonth, fromIso, localToday, sameDayNextMonth, toIso } from './date-picker'
import type { DateRangeValue } from './date-picker'
import './date-picker.css'

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const monthLabel = (date: Date) => new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
const fullDate = (date: Date) => new Intl.DateTimeFormat('en', { dateStyle: 'full', timeZone: 'UTC' }).format(date)

export interface TwoMonthRangePickerProps { label: string; value: DateRangeValue; onValueChange: (value: DateRangeValue) => void; min?: string; max?: string; disabled?: boolean; error?: string; presets?: boolean }
export function TwoMonthRangePicker({ label, value, onValueChange, min, max, disabled, error, presets = false }: TwoMonthRangePickerProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => firstOfMonth(fromIso(value.start) ?? localToday()))
  const [focused, setFocused] = useState(() => value.start || toIso(localToday()))
  const [pickingEnd, setPickingEnd] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const trigger = useRef<HTMLButtonElement>(null)
  const minDate = fromIso(min)
  const maxDate = fromIso(max)
  const within = (date: Date) => (!minDate || date >= minDate) && (!maxDate || date <= maxDate)
  useEffect(() => { if (!open) return; const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }; document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside) }, [open])
  const choose = (date: Date) => {
    if (!within(date)) return
    const iso = toIso(date)
    if (!pickingEnd || !value.start || iso < value.start) { onValueChange({ start: iso, end: '' }); setPickingEnd(true) }
    else { onValueChange({ start: value.start, end: iso }); setPickingEnd(false); setOpen(false); trigger.current?.focus() }
  }
  const moveFocus = (date: Date) => {
    const iso = toIso(date)
    setFocused(iso)
    const currentEnd = firstOfMonth(month, 1)
    if (date < month || date >= firstOfMonth(month, 2)) setMonth(firstOfMonth(date))
    else if (date >= currentEnd) setMonth(month)
    requestAnimationFrame(() => dayRefs.current[iso]?.focus())
  }
  const dayKey = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const weekday = (date.getUTCDay() + 6) % 7
    const next = event.key === 'ArrowRight' ? addDays(date, 1) : event.key === 'ArrowLeft' ? addDays(date, -1) : event.key === 'ArrowDown' ? addDays(date, 7) : event.key === 'ArrowUp' ? addDays(date, -7) : event.key === 'PageDown' ? sameDayNextMonth(date, 1) : event.key === 'PageUp' ? sameDayNextMonth(date, -1) : event.key === 'Home' ? addDays(date, -weekday) : event.key === 'End' ? addDays(date, 6 - weekday) : null
    if (next) { event.preventDefault(); moveFocus(next) }
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
  }
  const setPreset = (days: number) => {
    const end = localToday()
    onValueChange({ start: toIso(addDays(end, 1 - days)), end: toIso(end) })
    setOpen(false); setPickingEnd(false); trigger.current?.focus()
  }
  const calendar = (base: Date, index: number) => {
    const offset = (base.getUTCDay() + 6) % 7
    const days = Array.from({ length: 42 }, (_, day) => addDays(base, day - offset))
    return <div className="amafh-calendar__month" key={index}>
      <div className="amafh-calendar__header"><button type="button" aria-label="Previous month" onClick={() => setMonth(firstOfMonth(month, -1))} disabled={index === 1}><ChevronLeft size={18} aria-hidden="true" /></button><strong aria-live="polite">{monthLabel(base)}</strong><button type="button" aria-label="Next month" onClick={() => setMonth(firstOfMonth(month, 1))} disabled={index === 0}><ChevronRight size={18} aria-hidden="true" /></button></div>
      <div className="amafh-calendar__weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="amafh-calendar__days">{days.map(date => { const iso = toIso(date); const outside = date.getUTCMonth() !== base.getUTCMonth(); return <button key={iso} ref={node => { if (!outside) dayRefs.current[iso] = node }} type="button" className={outside ? 'amafh-calendar__outside' : ''} aria-label={fullDate(date)} aria-pressed={iso === value.start || iso === value.end} aria-current={iso === toIso(localToday()) ? 'date' : undefined} data-in-range={Boolean(value.start && value.end && iso > value.start && iso < value.end)} tabIndex={focused === iso && !outside ? 0 : -1} disabled={outside || !within(date)} onClick={() => choose(date)} onKeyDown={event => dayKey(event, date)}>{date.getUTCDate()}</button> })}</div>
    </div>
  }
  return <div className="amafh-field amafh-range-calendar" ref={root}><span className="amafh-field__label" id={`${id}-label`}>{label}</span><button ref={trigger} type="button" className="amafh-field__control amafh-range-calendar__trigger" aria-labelledby={`${id}-label`} aria-expanded={open} disabled={disabled} onClick={() => { const date = fromIso(value.start) ?? localToday(); setOpen(!open); setMonth(firstOfMonth(date)); setFocused(toIso(date)); if (!open) requestAnimationFrame(() => dayRefs.current[toIso(date)]?.focus()) }}>{value.start ? `${display(value.start)} — ${value.end ? display(value.end) : 'Select end date'}` : 'Select date range'}</button>{error && <p role="alert" className="amafh-field__message amafh-field__message--error">{error}</p>}
    {open && <div className={`amafh-calendar amafh-calendar--range ${presets ? 'amafh-calendar--with-presets' : ''}`} role="group" aria-label={`${label} calendar`} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }}>{presets && <div className="amafh-calendar__presets"><strong>Quick select</strong><button type="button" onClick={() => setPreset(1)}>Today</button><button type="button" onClick={() => { const yesterday = addDays(localToday(), -1); onValueChange({ start: toIso(yesterday), end: toIso(yesterday) }); setOpen(false) }}>Yesterday</button><button type="button" onClick={() => setPreset(7)}>Last 7 days</button><button type="button" onClick={() => setPreset(30)}>Last 30 days</button></div>}<div className="amafh-calendar__months">{calendar(month, 0)}{calendar(firstOfMonth(month, 1), 1)}</div><footer><span role="status">{value.start ? `${display(value.start)}${value.end ? ` — ${display(value.end)}` : ' — Select end date'}` : 'Select start date'}</span><Button variant="secondary" size="compact" onClick={() => { onValueChange({ start: '', end: '' }); setPickingEnd(false) }}>Clear</Button><Button size="compact" disabled={!value.start || !value.end} onClick={() => { setOpen(false); trigger.current?.focus() }}>Apply</Button></footer></div>}
  </div>
}

export interface MonthYearPickerProps { label: string; value: string; onValueChange: (value: string) => void; mode: 'month' | 'year'; minYear?: number; maxYear?: number; disabled?: boolean }
export function MonthYearPicker({ label, value, onValueChange, mode, minYear = 1900, maxYear = 2100, disabled }: MonthYearPickerProps) {
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || localToday().getUTCFullYear())
  const years = Array.from({ length: 9 }, (_, index) => year - 3 + index).filter(item => item >= minYear && item <= maxYear)
  return <fieldset className="amafh-month-year"><legend className="amafh-field__label">{label}</legend><div className="amafh-month-year__header"><button type="button" className="amafh-month-year__nav" aria-label={`Previous ${mode === 'year' ? 'years' : 'year'}`} disabled={disabled || year <= minYear} onClick={() => setYear(year - (mode === 'year' ? 9 : 1))}><ChevronLeft size={16} aria-hidden="true" /></button><strong>{mode === 'month' ? year : `${years[0]}–${years.at(-1)}`}</strong><button type="button" className="amafh-month-year__nav" aria-label={`Next ${mode === 'year' ? 'years' : 'year'}`} disabled={disabled || year >= maxYear} onClick={() => setYear(year + (mode === 'year' ? 9 : 1))}><ChevronRight size={16} aria-hidden="true" /></button></div><div className="amafh-month-year__grid">{mode === 'month' ? Array.from({ length: 12 }, (_, index) => <button type="button" key={index} aria-pressed={value === `${year}-${String(index + 1).padStart(2, '0')}`} disabled={disabled} onClick={() => onValueChange(`${year}-${String(index + 1).padStart(2, '0')}`)}>{new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, index, 1)))}</button>) : years.map(item => <button type="button" key={item} aria-pressed={value === String(item)} disabled={disabled} onClick={() => onValueChange(String(item))}>{item}</button>)}</div></fieldset>
}

export interface DateTimeValue { date: string; time: string }
export interface DateTimePickerProps { label: string; value: DateTimeValue; onValueChange: (value: DateTimeValue) => void; disabled?: boolean; error?: string }
export function DateTimePicker({ label, value, onValueChange, disabled, error }: DateTimePickerProps) {
  const id = useId()
  return <fieldset className="amafh-date-time"><legend className="amafh-field__label">{label}</legend><div><DatePicker label="Date" value={value.date} onValueChange={date => onValueChange({ ...value, date })} disabled={disabled} /><label className="amafh-field" htmlFor={id}><span className="amafh-field__label">Time</span><input id={id} className="amafh-field__control" type="time" value={value.time} onChange={event => onValueChange({ ...value, time: event.target.value })} disabled={disabled} aria-invalid={Boolean(error) || undefined} aria-describedby={error ? `${id}-error` : undefined} /></label></div>{error && <p id={`${id}-error`} className="amafh-field__message amafh-field__message--error" role="alert">{error}</p>}</fieldset>
}
