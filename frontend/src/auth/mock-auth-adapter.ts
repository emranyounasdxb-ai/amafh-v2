export interface AuthUser { id: string; name: string; email: string }
export interface AuthSession { user: AuthUser }
export interface SignInInput { email: string; password: string }
export interface AuthAdapter {
  restore(): Promise<AuthSession | null>
  signIn(input: SignInInput): Promise<AuthSession>
  signOut(): Promise<void>
}

export const MOCK_SESSION_KEY = 'amafh-v2.mock-session.v1'

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false
  const user = (value as { user?: unknown }).user
  if (!user || typeof user !== 'object') return false
  const candidate = user as Record<string, unknown>
  return typeof candidate.id === 'string' && candidate.id.length > 0 && typeof candidate.name === 'string' && candidate.name.length > 0 && typeof candidate.email === 'string' && candidate.email.length > 0
}

function readSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(MOCK_SESSION_KEY)
    if (!raw) return null
    const stored: unknown = JSON.parse(raw)
    if (stored && typeof stored === 'object' && (stored as { version?: unknown }).version === 1 && isAuthSession(stored)) return { user: stored.user }
    window.localStorage.removeItem(MOCK_SESSION_KEY)
  } catch {
    try { window.localStorage.removeItem(MOCK_SESSION_KEY) } catch { /* Storage may be unavailable. */ }
  }
  return null
}

export const mockAuthAdapter: AuthAdapter = {
  async restore() { return readSession() },
  async signIn({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !password) throw new Error('Enter an email and password to continue.')
    const words = normalizedEmail.split('@')[0].split(/[._-]+/).filter(Boolean)
    const name = words.length ? words.map(word => word[0].toUpperCase() + word.slice(1)).join(' ') : 'Demo user'
    const session: AuthSession = { user: { id: normalizedEmail, name, email: normalizedEmail } }
    try { window.localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify({ version: 1, ...session })) } catch { /* In-memory session still works. */ }
    return session
  },
  async signOut() { try { window.localStorage.removeItem(MOCK_SESSION_KEY) } catch { /* In-memory session is cleared by the provider. */ } },
}
