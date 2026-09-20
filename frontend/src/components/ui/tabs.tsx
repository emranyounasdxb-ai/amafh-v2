import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import './ui.css'

export interface TabItem { id: string; label: string; content: ReactNode; disabled?: boolean }
export interface TabsProps { items: TabItem[]; value: string; onValueChange: (value: string) => void; label: string }
export function Tabs({ items, value, onValueChange, label }: TabsProps) {
  const prefix = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    const enabled = items.filter(item => !item.disabled)
    const index = enabled.findIndex(item => item.id === id)
    if (index < 0) return
    const next = event.key === 'ArrowRight' ? enabled[(index + 1) % enabled.length] : event.key === 'ArrowLeft' ? enabled[(index - 1 + enabled.length) % enabled.length] : event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1] : null
    if (next) { event.preventDefault(); onValueChange(next.id); refs.current[next.id]?.focus() }
  }
  return <div className="amafh-tabs"><div className="amafh-tabs__list" role="tablist" aria-label={label}>{items.map(item => <button key={item.id} ref={node => { refs.current[item.id] = node }} role="tab" id={`${prefix}-tab-${item.id}`} aria-selected={value === item.id} aria-controls={`${prefix}-panel-${item.id}`} tabIndex={value === item.id ? 0 : -1} disabled={item.disabled} onClick={() => onValueChange(item.id)} onKeyDown={event => onKeyDown(event, item.id)}>{item.label}</button>)}</div>{items.filter(item => item.id === value).map(item => <div key={item.id} role="tabpanel" id={`${prefix}-panel-${item.id}`} aria-labelledby={`${prefix}-tab-${item.id}`}>{item.content}</div>)}</div>
}
