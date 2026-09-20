import type { AuthAdapter, AuthSession, SignInInput } from './mock-auth-adapter'

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object') {
      const detail = (body as { detail?: unknown }).detail
      if (typeof detail === 'string') return detail
      const error = (body as { error?: unknown }).error
      if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message
    }
  } catch { /* A generic message is shown below. */ }
  return 'Authentication request failed.'
}

export const apiAuthAdapter: AuthAdapter = {
  async restore(): Promise<AuthSession | null> {
    const response = await fetch('/api/v1/auth/session', { credentials: 'include' })
    if (response.status === 401) return null
    if (!response.ok) throw new Error(await readError(response))
    return response.json() as Promise<AuthSession>
  },
  async signIn(input: SignInInput): Promise<AuthSession> {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error(await readError(response))
    return response.json() as Promise<AuthSession>
  },
  async signOut(): Promise<void> {
    const response = await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
    if (!response.ok && response.status !== 401) throw new Error(await readError(response))
  },
}
