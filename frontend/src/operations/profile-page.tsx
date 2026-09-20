import { useEffect, useState } from 'react'
import { Workspace } from '../templates/workspace'
import { FormSection } from '../patterns/shared-patterns'
import { Button } from '../components/ui/button'
import { SelectField } from '../components/ui/select-field'
import { WorkspaceState } from '../components/feedback/workspace-state'
import { usePermissionPreview } from './permissions'
import { PermissionActor } from './ui'
import { profileImagesRepository, validateProfileImage, type ProfileImageKind, type ProfileImages } from './profile-images'
import { apiProfileImagesRepository } from './profile-images'
import { useOptionalAuth } from '../auth/auth-context'
import './operations.css'

export function ProfilePage({ path }: { path: string }) {
  const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
  const auth = useOptionalAuth()
  const preview = usePermissionPreview()
  const routeTarget = path.startsWith('/profile/') ? decodeURIComponent(path.slice(9)) : ''
  const [selectedId, setSelectedId] = useState(routeTarget)
  const targetId = routeTarget || selectedId || (apiMode ? auth?.user?.id ?? '' : preview.actorId)
  const [apiUsers, setApiUsers] = useState<{ id: string; fullName: string }[]>([])
  const [images, setImages] = useState<ProfileImages>({ avatar: '', banner: '' })
  const [imagesLoading, setImagesLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!apiMode || !preview.can('Users', 'view')) return
    void fetch('/api/v1/auth/users', { credentials: 'include' }).then(async response => {
      if (!response.ok) return []
      return await response.json() as { id: string; name: string }[]
    }).then(users => setApiUsers(users.map(user => ({ id: user.id, fullName: user.name }))))
  }, [preview.loading])
  useEffect(() => {
    let active = true
    setImages({ avatar: '', banner: '' })
    setError('')
    if (!targetId) return
    setImagesLoading(true)
    void (apiMode ? apiProfileImagesRepository : profileImagesRepository).get(targetId).then(value => { if (active) setImages(value) }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load images.') }).finally(() => { if (active) setImagesLoading(false) })
    return () => { active = false }
  }, [targetId])
  const target = apiMode ? (apiUsers.find(item => item.id === targetId) ?? (targetId === auth?.user?.id && auth.user ? { id: auth.user.id, fullName: auth.user.name } : targetId ? { id: targetId, fullName: targetId } : null)) : preview.users.find(item => item.id === targetId)
  const canEdit = Boolean((apiMode ? auth?.user?.id : preview.actorId) && target && ((apiMode ? auth?.user?.id : preview.actorId) === targetId || preview.can('Profiles', 'edit-other-images')))
  const upload = async (kind: ProfileImageKind, file?: File) => {
    if (!file || !targetId || !canEdit) return
    setBusy(true); setError('')
    try { setImages(apiMode ? await apiProfileImagesRepository.save(targetId, kind, file) : await profileImagesRepository.save(targetId, kind, await validateProfileImage(file), preview.actorId)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save image.') }
    finally { setBusy(false) }
  }
  const remove = async (kind: ProfileImageKind) => {
    if (!canEdit) return
    setBusy(true); setError('')
    try { setImages(apiMode ? await apiProfileImagesRepository.remove(targetId, kind) : await profileImagesRepository.remove(targetId, kind, preview.actorId)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove image.') }
    finally { setBusy(false) }
  }
  return <Workspace title="Profile images" description="Avatar and banner presentation for existing Users.">
    <PermissionActor preview={preview} />
    {preview.loading ? <WorkspaceState kind="loading" title="Loading Users" /> : preview.error ? <WorkspaceState kind="error" title="Could not load Users" description={preview.error} action={<Button onClick={() => { void preview.reload() }}>Try again</Button>} /> : <div className="amafh-ops-grid">
      {!routeTarget && (apiMode ? apiUsers.length > 0 : true) && <SelectField label="User profile" value={targetId} onValueChange={setSelectedId} options={(apiMode ? apiUsers : preview.users).map(user => ({ value: user.id, label: user.fullName }))} />}
      {!target ? <WorkspaceState kind="empty" title="User not found" /> : imagesLoading ? <WorkspaceState kind="loading" title="Loading profile images" /> : <><FormSection title={`${target.fullName} · Avatar`}><div className="amafh-ops-fields">{images.avatar ? <img className="amafh-ops-image" src={images.avatar} alt={`${target.fullName} avatar`} /> : <p>No avatar uploaded.</p>}{canEdit && <div><label>Upload avatar <input aria-label="Upload avatar" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { void upload('avatar', event.target.files?.[0]) }} /></label>{images.avatar && <Button variant="secondary" disabled={busy} onClick={() => { void remove('avatar') }}>Remove avatar</Button>}</div>}</div></FormSection>
      <FormSection title={`${target.fullName} · Banner`}><div className="amafh-ops-grid">{images.banner ? <img className="amafh-ops-banner" src={images.banner} alt={`${target.fullName} banner`} /> : <p>No banner uploaded.</p>}{canEdit && <div className="amafh-ops-actions"><label>Upload banner <input aria-label="Upload banner" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { void upload('banner', event.target.files?.[0]) }} /></label>{images.banner && <Button variant="secondary" disabled={busy} onClick={() => { void remove('banner') }}>Remove banner</Button>}</div>}</div></FormSection></>}
      {!canEdit && target && <p>Editing another user's images requires Profiles: edit-other-images permission.</p>}
      {error && <p role="alert" className="amafh-case-error">{error}</p>}
    </div>}
  </Workspace>
}
