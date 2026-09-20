import './ui.css'

export interface AvatarProps { name: string; initials?: string; src?: string; size?: 'xs' | 'sm' | 'md' | 'lg' }
export function Avatar({ name, initials, src, size = 'md' }: AvatarProps) {
  const derived = initials ?? name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <span className={`amafh-avatar amafh-avatar--${size}`} role="img" aria-label={name}>{src ? <img src={src} alt="" /> : derived}</span>
}
