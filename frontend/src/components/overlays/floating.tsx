import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { ChevronDown, X } from 'lucide-react'
import { Button } from '../ui/button'
import { TextField } from '../ui/text-field'
import { Dialog } from './dialog'
import './overlays.css'

export interface MenuItem { id: string; label: string; description?: string; onSelect: () => void; disabled?: boolean; danger?: boolean }
export interface DropdownProps { label: string; items: MenuItem[]; trigger?: ReactElement; disabled?: boolean }
export function Dropdown({ label, items, trigger, disabled }: DropdownProps) { return <DropdownMenu.Root><DropdownMenu.Trigger asChild disabled={disabled}>{trigger ?? <Button variant="secondary" icon={<ChevronDown size={16} aria-hidden="true" />}>{label}</Button>}</DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="amafh-floating amafh-floating--menu" align="start" sideOffset={4} aria-label={label}>{items.map(item => <DropdownMenu.Item key={item.id} className={`amafh-floating__item ${item.danger ? 'amafh-floating__item--danger' : ''}`} disabled={item.disabled} onSelect={item.onSelect}><span>{item.label}</span>{item.description && <span className="amafh-floating__item-description">{item.description}</span>}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root> }

export interface ContextMenuProps { label: string; items: MenuItem[]; children: ReactElement }
export function ContextMenu({ label, items, children }: ContextMenuProps) {
  const [open, setOpen] = useState(false)
  return <DropdownMenu.Root open={open} onOpenChange={setOpen}><DropdownMenu.Trigger asChild onContextMenu={event => { event.preventDefault(); setOpen(true) }} onKeyDown={event => { if (event.key === 'F10' && event.shiftKey) { event.preventDefault(); setOpen(true) } }}>{children}</DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="amafh-floating amafh-floating--menu" align="start" sideOffset={4} aria-label={label}>{items.map(item => <DropdownMenu.Item key={item.id} className={`amafh-floating__item ${item.danger ? 'amafh-floating__item--danger' : ''}`} disabled={item.disabled} onSelect={item.onSelect}>{item.label}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
}

export interface CommandPaletteProps { open: boolean; onClose: () => void; onApply: (command: string) => void }
export function CommandPalette({ open, onClose, onApply }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const apply = () => { if (query.trim()) { onApply(query.trim()); setQuery('') } }
  return <Dialog open={open} onClose={onClose} title="Command Palette" size="palette" showClose={false} actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={apply} disabled={!query.trim()}>Apply</Button></>}><TextField label="Search commands" placeholder="Type a command…" value={query} autoFocus onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); apply() } }} /></Dialog>
}

export interface PopoverProps { trigger: ReactElement; title?: string; children: ReactNode; width?: 'default' | 'wide' }
export function Popover({ trigger, title, children, width = 'default' }: PopoverProps) { return <PopoverPrimitive.Root><PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger><PopoverPrimitive.Portal><PopoverPrimitive.Content className={`amafh-floating amafh-floating--popover amafh-floating--${width}`} sideOffset={6} collisionPadding={12}><div className="amafh-floating__header">{title && <strong>{title}</strong>}<PopoverPrimitive.Close className="amafh-floating__close" aria-label="Close popover"><X size={16} aria-hidden="true" /></PopoverPrimitive.Close></div>{children}</PopoverPrimitive.Content></PopoverPrimitive.Portal></PopoverPrimitive.Root> }

export interface TooltipProps { trigger: ReactElement; content: string; side?: 'top' | 'right' | 'bottom' | 'left' }
export function Tooltip({ trigger, content, side = 'top' }: TooltipProps) { return <TooltipPrimitive.Provider delayDuration={500}><TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content className="amafh-floating amafh-floating--tooltip" side={side} sideOffset={6}>{content}</TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root></TooltipPrimitive.Provider> }
