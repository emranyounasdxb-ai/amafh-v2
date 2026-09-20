import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Image, KeyRound, LogOut, Shield, UserRound } from 'lucide-react'
import { Avatar } from '../components/ui/avatar'
import { apiProfileImagesRepository } from '../operations/profile-images'
import type { AuthUser } from './mock-auth-adapter'
import '../components/overlays/overlays.css'

export function AccountMenu({ user, onNavigate, onLogout }: { user: AuthUser; onNavigate: (path: string) => void; onLogout: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [avatar, setAvatar] = useState('')
  useEffect(() => {
    if (import.meta.env.MODE === 'test' || import.meta.env.VITE_AUTH_PROVIDER === 'mock') return
    let active = true
    const reload = () => { void apiProfileImagesRepository.get(user.id).then(images => { if (active) setAvatar(images.avatar) }).catch(() => { if (active) setAvatar('') }) }
    reload()
    window.addEventListener('amafh-profile-image-updated', reload)
    return () => { active = false; window.removeEventListener('amafh-profile-image-updated', reload) }
  }, [user.id])
  const navigate = (path: string) => { setOpen(false); onNavigate(path) }
  const icon = (Icon: typeof UserRound) => <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
  return <DropdownMenu.Root open={open} onOpenChange={setOpen}>
    <DropdownMenu.Trigger className="amafh-account-trigger" aria-label={`Account menu for ${user.name}`}>
      <Avatar name={user.name} src={avatar} size="sm" /><span className="amafh-account-trigger__name">{user.name}</span><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content className="amafh-floating amafh-account-menu" align="end" sideOffset={6} collisionPadding={12} aria-label="Account menu">
      <div className="amafh-account-menu__header"><Avatar name={user.name} src={avatar} size="md" /><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
      <DropdownMenu.Separator className="amafh-account-menu__separator" />
      <DropdownMenu.Item className="amafh-floating__item amafh-account-menu__item" onSelect={() => navigate(`/profile/${encodeURIComponent(user.id)}`)}>{icon(UserRound)}View/Edit Profile</DropdownMenu.Item>
      <DropdownMenu.Item className="amafh-floating__item amafh-account-menu__item" onSelect={() => navigate(`/profile/${encodeURIComponent(user.id)}?section=avatar`)}>{icon(Image)}Change Profile Avatar</DropdownMenu.Item>
      <DropdownMenu.Item className="amafh-floating__item amafh-account-menu__item" onSelect={() => navigate(`/profile/${encodeURIComponent(user.id)}?section=banner`)}>{icon(Image)}Update Profile Banner</DropdownMenu.Item>
      <DropdownMenu.Item className="amafh-floating__item amafh-account-menu__item" onSelect={() => navigate('/account/security?section=password')}>{icon(KeyRound)}Change Password</DropdownMenu.Item>
      <DropdownMenu.Item className="amafh-floating__item amafh-account-menu__item" onSelect={() => navigate('/account/security')}>{icon(Shield)}Account Security</DropdownMenu.Item>
      <DropdownMenu.Separator className="amafh-account-menu__separator" />
      <DropdownMenu.Item className="amafh-floating__item amafh-account-menu__item amafh-floating__item--danger" onSelect={() => { setOpen(false); void onLogout() }}>{icon(LogOut)}Logout</DropdownMenu.Item>
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>
}
