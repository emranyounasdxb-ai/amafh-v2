import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { TextField } from '../components/ui/text-field'
import { useAuth } from './auth-context'
import './login-page.css'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setError('')
    setPending(true)
    try { await signIn({ email, password }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign in.') }
    finally { setPending(false) }
  }

  return <main className="amafh-login"><div className="amafh-login__content">
    <img className="amafh-login__brand" src="/brand/amafh-core-full-logo-exact.svg" alt="AMAFH" width="1551" height="479" />
    <Card className="amafh-login__card"><h1 className="amafh-h2">Sign in</h1><p>Open the application templates.</p>
      <form onSubmit={event => { void submit(event) }}>
        <TextField label="Email" type="email" name="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
        <TextField label="Password" type="password" name="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
        {error && <p className="amafh-login__error" role="alert">{error}</p>}
        <Button type="submit" loading={pending}>Sign in</Button>
      </form>
    </Card>
    {import.meta.env.VITE_AUTH_PROVIDER === 'mock' && <p className="amafh-login__note">Local preview only. Any email and password will open the templates.</p>}
  </div></main>
}
