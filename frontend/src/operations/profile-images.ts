import { mockUsersRepository } from '../administration/users/mock-users-repository'
import { requireAction } from './permissions'

export type ProfileImageKind = 'avatar' | 'banner'
export interface ProfileImages { avatar: string; banner: string }
export const PROFILE_IMAGES_KEY = 'amafh-v2.mock-profile-images.v1'
const empty = (): ProfileImages => ({ avatar: '', banner: '' })
function read(): Record<string, ProfileImages> {
  const raw = localStorage.getItem(PROFILE_IMAGES_KEY)
  if (raw === null) return {}
  try { const parsed: unknown = JSON.parse(raw); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.values(parsed).every(value => value && typeof value === 'object' && typeof (value as ProfileImages).avatar === 'string' && typeof (value as ProfileImages).banner === 'string')) return structuredClone(parsed as Record<string, ProfileImages>) } catch { /* handled below */ }
  throw new Error('Local profile images could not be read.')
}
function write(value: Record<string, ProfileImages>) { try { localStorage.setItem(PROFILE_IMAGES_KEY, JSON.stringify(value)) } catch { throw new Error('Could not save local profile image. Try a smaller image.') } }
export async function validateProfileImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.')
  if (!file.size || file.size > 1024 * 1024) throw new Error('Image must be non-empty and 1 MB or smaller.')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.onload = () => typeof reader.result === 'string' && reader.result.startsWith(`data:${file.type};base64,`) ? resolve(reader.result) : reject(new Error('Invalid image content.'))
    reader.readAsDataURL(file)
  })
  assertImageData(dataUrl)
  return dataUrl
}
function assertImageData(dataUrl: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match || dataUrl.length > 1_500_000) throw new Error('Invalid or oversized image content.')
  let bytes: string
  try { bytes = atob(match[2]) } catch { throw new Error('Invalid image content.') }
  if (!bytes.length || bytes.length > 1024 * 1024) throw new Error('Image must be non-empty and 1 MB or smaller.')
  const valid = match[1] === 'png' ? bytes.startsWith('\x89PNG\r\n\x1a\n') : match[1] === 'jpeg' ? bytes.startsWith('\xff\xd8\xff') : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP'
  if (!valid) throw new Error('Image content does not match its type.')
}
export const profileImagesRepository = {
  async get(userId: string) { return read()[userId] ?? empty() },
  async save(userId: string, kind: ProfileImageKind, dataUrl: string, actorId: string) {
    const users = await mockUsersRepository.list()
    if (!users.some(user => user.id === userId)) throw new Error('User was not found.')
    if (!users.some(user => user.id === actorId && user.status === 'active')) throw new Error('Select an active acting user.')
    if (actorId !== userId) await requireAction('Profiles', 'edit-other-images', actorId)
    assertImageData(dataUrl)
    const records = read(); records[userId] = { ...(records[userId] ?? empty()), [kind]: dataUrl }; write(records); return records[userId]
  },
  async remove(userId: string, kind: ProfileImageKind, actorId: string) {
    const users = await mockUsersRepository.list()
    if (!users.some(user => user.id === userId)) throw new Error('User was not found.')
    if (!users.some(user => user.id === actorId && user.status === 'active')) throw new Error('Select an active acting user.')
    if (actorId !== userId) await requireAction('Profiles', 'edit-other-images', actorId)
    const records = read(); records[userId] = { ...(records[userId] ?? empty()), [kind]: '' }; write(records); return records[userId]
  },
}

async function apiRequest(path: string, options?: RequestInit) {
  const response = await fetch(path, { credentials: 'include', ...options })
  if (!response.ok) {
    let message = 'Could not update profile image.'
    try { const body = await response.json() as { error?: { message?: string } }; message = body.error?.message ?? message } catch { /* Use default. */ }
    throw new Error(message)
  }
  return response
}

export const apiProfileImagesRepository = {
  async get(userId: string): Promise<ProfileImages> {
    const response = await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/profile-images`)
    const urls = await response.json() as Partial<ProfileImages>
    const cacheKey = `?v=${Date.now()}`
    return { avatar: urls.avatar ? urls.avatar + cacheKey : '', banner: urls.banner ? urls.banner + cacheKey : '' }
  },
  async save(userId: string, kind: ProfileImageKind, file: File): Promise<ProfileImages> {
    await validateProfileImage(file)
    await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/profile-images/${kind}`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
    return this.get(userId)
  },
  async remove(userId: string, kind: ProfileImageKind): Promise<ProfileImages> {
    await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/profile-images/${kind}`, { method: 'DELETE' })
    return this.get(userId)
  },
}
