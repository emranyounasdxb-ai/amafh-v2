import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/button'
import { TextField } from '../components/ui/text-field'
import { Breadcrumb } from '../components/navigation/breadcrumb'
import { Workspace } from '../templates/workspace'
import { FormSection } from '../patterns/shared-patterns'
import { useAuth } from './auth-context'

export function AccountSecurityPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { signOut } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    if (newPassword.length < 12 || newPassword.length > 128) { setError('Use a password of 12 to 128 characters.'); return }
    if (newPassword !== confirmation) { setError('Passwords do not match.'); return }
    setPending(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/v1/auth/change-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) })
      if (!response.ok) throw new Error(response.status === 400 ? 'Current password is incorrect.' : 'Could not change password.')
      setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setMessage('Password changed.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change password.') }
    finally { setPending(false) }
  }

  const logoutAll = async () => {
    if (pending) return
    setPending(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/v1/auth/logout-all', { method: 'POST', credentials: 'include' })
      if (!response.ok) throw new Error('Could not end all sessions.')
      await signOut()
      onNavigate('/login')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not end all sessions.') }
    finally { setPending(false) }
  }

  return <Workspace title="Account security" breadcrumb={<Breadcrumb items={[{ label: 'Account security' }]} />}>
    <FormSection title="Change password"><form onSubmit={event => { void changePassword(event) }}>
      <TextField label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
      <TextField label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
      <TextField label="Confirm new password" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
      <Button type="submit" loading={pending}>Change password</Button>
    </form></FormSection>
    <FormSection title="Sessions"><Button variant="secondary" disabled={pending} onClick={() => { void logoutAll() }}>Log out of all sessions</Button></FormSection>
    {import.meta.env.VITE_AUTH_PROVIDER !== 'mock' && <FormSection title="User account setup"><Button variant="secondary" onClick={() => onNavigate('/account/provision-user')}>Create user account</Button></FormSection>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </Workspace>
}
