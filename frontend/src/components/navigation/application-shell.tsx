import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Bell, Menu, X } from 'lucide-react'
import { Avatar } from '../ui/avatar'
import navDot from './assets/nav-dot.svg'
import navDotActive from './assets/nav-dot-active.svg'
import './application-shell.css'

export interface NavigationItem { id: string; label: string; ariaLabel?: string; icon?: ReactNode; href?: string; disabled?: boolean }
export interface ApplicationShellProps {
  brand?: ReactNode
  compactBrand?: ReactNode
  mobileBrand?: ReactNode
  headerTitle?: string
  items: NavigationItem[]
  activeId?: string
  onNavigate?: (id: string) => void
  search?: ReactNode
  notifications?: ReactNode
  account?: ReactNode
  children: ReactNode
}

export function ApplicationShell({ brand = 'AMAFH v2', compactBrand = 'A', mobileBrand = 'AMAFH', headerTitle = 'Workspace', items, activeId, onNavigate, search, notifications, account, children }: ApplicationShellProps) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [tabletExpanded, setTabletExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useLayoutEffect(() => {
    if (mobileOpen) closeRef.current?.focus()
    else if (wasOpen.current && window.matchMedia('(max-width: 767px)').matches) menuRef.current?.focus()
    wasOpen.current = mobileOpen
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const closeOnResize = () => { if (!mobileQuery.matches) setMobileOpen(false) }
    mobileQuery.addEventListener('change', closeOnResize)
    return () => { document.body.style.overflow = priorOverflow; mobileQuery.removeEventListener('change', closeOnResize) }
  }, [mobileOpen])

  const onSidebarKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!mobileOpen) return
    if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); return }
    if (event.key !== 'Tab') return
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a:not([aria-disabled="true"])')).filter(element => getComputedStyle(element).display !== 'none')
    if (!elements.length) return
    if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1].focus() }
    else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0].focus() }
  }

  const navigate = (id: string) => { onNavigate?.(id); setMobileOpen(false) }
  const navContent = items.map(item => {
    const current = activeId === item.id
    const icon = item.icon ?? <img className="amafh-shell__nav-dot" src={current ? navDotActive : navDot} alt="" />
    return item.href
      ? <a key={item.id} href={item.href} aria-label={item.ariaLabel ?? item.label} aria-current={current ? 'page' : undefined} aria-disabled={item.disabled || undefined} tabIndex={item.disabled ? -1 : undefined} className="amafh-shell__nav-item" onClick={event => { if (item.disabled) event.preventDefault(); else navigate(item.id) }} title={item.label}>{icon}<span>{item.label}</span></a>
      : <button key={item.id} type="button" aria-label={item.ariaLabel ?? item.label} disabled={item.disabled} aria-current={current ? 'page' : undefined} className="amafh-shell__nav-item" onClick={() => navigate(item.id)} title={item.label}>{icon}<span>{item.label}</span></button>
  })

  return <div className={`amafh-shell ${desktopCollapsed ? 'amafh-shell--desktop-collapsed' : ''} ${tabletExpanded ? 'amafh-shell--tablet-expanded' : ''} ${mobileOpen ? 'amafh-shell--mobile-open' : ''}`}>
    <aside className="amafh-shell__sidebar" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined} aria-label="Application navigation" onKeyDown={onSidebarKeyDown}>
      <div className="amafh-shell__brand"><strong className="amafh-shell__brand-full">{brand}</strong><strong className="amafh-shell__brand-compact">{compactBrand}</strong><button ref={closeRef} className="amafh-shell__icon amafh-shell__mobile-close" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} aria-hidden="true" strokeWidth={1.75} /></button></div>
      <nav id="amafh-primary-navigation" aria-label="Primary navigation">{navContent}</nav>
    </aside>
    {mobileOpen && <button type="button" className="amafh-shell__scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <div className="amafh-shell__main" inert={mobileOpen}>
      <header className="amafh-shell__topbar">
        <button type="button" className="amafh-shell__icon amafh-shell__desktop-menu" aria-label={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-controls="amafh-primary-navigation" aria-expanded={!desktopCollapsed} onClick={() => setDesktopCollapsed(value => !value)}><Menu size={20} aria-hidden="true" strokeWidth={1.75} /></button>
        <button type="button" className="amafh-shell__icon amafh-shell__tablet-menu" aria-label={tabletExpanded ? 'Collapse navigation' : 'Expand navigation'} aria-controls="amafh-primary-navigation" aria-expanded={tabletExpanded} onClick={() => setTabletExpanded(value => !value)}><Menu size={20} aria-hidden="true" strokeWidth={1.75} /></button>
        <button ref={menuRef} type="button" className="amafh-shell__icon amafh-shell__mobile-menu" aria-label="Open navigation" aria-controls="amafh-primary-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={20} aria-hidden="true" strokeWidth={1.75} /></button>
        <strong className="amafh-shell__topbar-title">{headerTitle}</strong><strong className="amafh-shell__topbar-mobile-brand">{mobileBrand}</strong>
        {search && <div className="amafh-shell__search">{search}</div>}
        <div className="amafh-shell__top-actions">{notifications ?? <Bell size={20} aria-label="Notifications" strokeWidth={1.75} />}{account ?? <Avatar name="Account" initials="AM" size="sm" />}</div>
      </header>
      <div className="amafh-shell__content" id="main-content">{children}</div>
    </div>
  </div>
}
