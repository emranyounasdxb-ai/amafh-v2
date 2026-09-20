import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { routeItems } from '../../routes/route-config'
import { usePermissionPreview } from '../../operations/permissions'
import './global-search.css'

export const allowed = (id: string, can: (domain: string, action: string) => boolean) => {
  switch (id) {
    case 'dashboard': case 'profile': return true
    case 'customers': return can('Customers', 'view')
    case 'cases': return can('Cases', 'view')
    case 'administration': return can('Users', 'view')
    case 'notifications': return can('Notifications', 'view')
    case 'tasks': return can('Tasks', 'view')
    case 'finance': return can('Finance', 'view-commission') || can('Finance', 'view-incentives')
    case 'reports': return can('Reports', 'view')
    default: return false
  }
}

export function GlobalSearch({ onNavigate }: { onNavigate: (path: string) => void }) {
  const preview = usePermissionPreview()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const results = routeItems.filter(item => allowed(item.id, preview.can) && item.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
  useEffect(() => {
    if (!open && !mobileOpen) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setMobileOpen(false) } }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, mobileOpen])
  const close = () => { setOpen(false); setMobileOpen(false); setQuery(''); setActive(0) }
  const go = (path: string) => { close(); onNavigate(path) }
  return <div ref={root} className={`amafh-global-search ${mobileOpen ? 'amafh-global-search--mobile-open' : ''}`}>
    <button type="button" className="amafh-global-search__mobile-trigger" aria-label="Open search" aria-expanded={mobileOpen} onClick={() => { setMobileOpen(true); setOpen(true); requestAnimationFrame(() => input.current?.focus()) }}><Search size={20} strokeWidth={1.75} aria-hidden="true" /></button>
    <div className="amafh-global-search__field"><Search size={18} strokeWidth={1.75} aria-hidden="true" />
      <input ref={input} type="search" role="combobox" aria-label="Search destinations" aria-autocomplete="list" aria-expanded={open} aria-controls="amafh-global-search-results" aria-activedescendant={open && !preview.loading && !preview.error && results[active] ? `amafh-search-${results[active].id}` : undefined} placeholder="Search destinations…" value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true) }} onKeyDown={event => {
        if (event.key === 'Escape') { close(); input.current?.blur() }
        else if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(index + 1, results.length - 1))) }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(index - 1, 0)) }
        else if (event.key === 'Enter' && open && results[active]) { event.preventDefault(); go(results[active].path) }
      }} />
      {query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); setActive(0); input.current?.focus() }}><X size={16} aria-hidden="true" /></button>}
      <button type="button" className="amafh-global-search__mobile-close" aria-label="Close search" onClick={close}><X size={18} aria-hidden="true" /></button>
    </div>
    {open && <div id="amafh-global-search-results" className="amafh-global-search__results" role="listbox" aria-label="Search destinations">
      {preview.loading ? <p role="status">Loading destinations…</p> : preview.error ? <div role="alert">Could not load permissions. <button type="button" onClick={() => { void preview.reload() }}>Try again</button></div> : results.length ? results.map((item, index) => <button id={`amafh-search-${item.id}`} key={item.id} type="button" role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => go(item.path)}>{item.label}</button>) : <p>No matching destinations.</p>}
    </div>}
  </div>
}
