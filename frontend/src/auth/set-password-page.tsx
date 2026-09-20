import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { TextField } from '../components/ui/text-field'
import './login-page.css'

export function SetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    if (password.length < 12 || password.length > 128) { setError('Use a password of 12 to 128 characters.'); return }
    if (password !== confirmation) { setError('Passwords do not match.'); return }
    setPending(true); setError('')
    try {
      const response = await fetch('/api/v1/auth/setup-password', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }),
      })
      if (!response.ok) throw new Error(response.status === 400 ? 'This setup link is invalid, expired, or already used.' : 'Could not set the password. Try again.')
      window.history.replaceState(null, '', '/set-password')
      setComplete(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not set the password.') }
    finally { setPending(false) }
  }

  return <main className="amafh-login"><div className="amafh-login__content">
    <strong className="amafh-login__brand">AMAFH v2</strong>
    <Card className="amafh-login__card"><h1 className="amafh-h2">Set password</h1>
      {complete ? <><p>Your password is ready.</p><Button onClick={() => window.location.assign('/login')}>Sign in</Button></>
        : token ? <form onSubmit={event => { void submit(event) }}>
          <TextField label="New password" type="password" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} />
          <TextField label="Confirm password" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          {error && <p className="amafh-login__error" role="alert">{error}</p>}
          <Button type="submit" loading={pending}>Save password</Button>
        </form> : <p role="alert">This setup link is invalid. Ask the account owner for a new link.</p>}
    </Card>
  </div></main>
}
