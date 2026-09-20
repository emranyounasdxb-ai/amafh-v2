import { useId } from 'react'
import './extended-controls.css'

export interface NumericFieldProps { label: string; value: string; onValueChange: (value: string) => void; kind?: 'number' | 'currency' | 'percent'; currencySymbol?: string; helperText?: string; error?: string; disabled?: boolean }
export function NumericField({ label, value, onValueChange, kind = 'number', currencySymbol = '$', helperText = 'Use locale-aware grouping and controlled precision.', error, disabled }: NumericFieldProps) {
  const id = useId()
  return <div className="amafh-field amafh-numeric"><label className="amafh-field__label" htmlFor={id}>{label}</label><div className="amafh-numeric__entry" data-invalid={Boolean(error)} data-disabled={Boolean(disabled)}>{kind === 'currency' && <span aria-hidden="true">{currencySymbol}</span>}<input id={id} type="text" inputMode="decimal" value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)} aria-invalid={Boolean(error) || undefined} aria-describedby={`${id}-message`} />{kind === 'percent' && <span aria-hidden="true">%</span>}</div><p id={`${id}-message`} className={`amafh-field__message ${error ? 'amafh-field__message--error' : ''}`} role={error ? 'alert' : undefined}>{error || helperText}</p></div>
}

export interface SegmentedControlProps { label: string; options: { value: string; label: string }[]; value: string; onValueChange: (value: string) => void; disabled?: boolean }
export function SegmentedControl({ label, options, value, onValueChange, disabled }: SegmentedControlProps) {
  return <div className="amafh-segmented" role="group" aria-label={label}>{options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} disabled={disabled} onClick={() => onValueChange(option.value)}>{option.label}</button>)}</div>
}

export interface StepperProps { label: string; value: number; onValueChange: (value: number) => void; min?: number; max?: number; step?: number; disabled?: boolean }
export function Stepper({ label, value, onValueChange, min = -Infinity, max = Infinity, step = 1, disabled }: StepperProps) {
  const id = useId()
  const clamp = (number: number) => Math.max(min, Math.min(max, number))
  return <div className="amafh-stepper"><button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={disabled || value <= min} onClick={() => onValueChange(clamp(value - step))}>−</button><label className="amafh-field" htmlFor={id}><span className="amafh-field__label">{label}</span><input id={id} className="amafh-field__control" type="number" value={value} min={Number.isFinite(min) ? min : undefined} max={Number.isFinite(max) ? max : undefined} step={step} disabled={disabled} onChange={event => { const number = Number(event.target.value); if (Number.isFinite(number)) onValueChange(clamp(number)) }} /></label><button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={disabled || value >= max} onClick={() => onValueChange(clamp(value + step))}>+</button></div>
}

export interface SliderProps { label: string; value: number; onValueChange: (value: number) => void; min?: number; max?: number; step?: number; disabled?: boolean }
export function Slider({ label, value, onValueChange, min = 0, max = 100, step = 1, disabled }: SliderProps) {
  return <label className="amafh-slider"><span className="amafh-field__label">{label}</span><input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={event => onValueChange(Number(event.target.value))} aria-valuetext={`${value}`} /></label>
}
