import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { mockAuthAdapter, MOCK_SESSION_KEY, type AuthAdapter, type AuthUser, type SignInInput } from './mock-auth-adapter'
import { apiAuthAdapter } from './api-auth-adapter'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'
export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  signIn(input: SignInInput): Promise<void>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const defaultAdapter = import.meta.env.VITE_AUTH_PROVIDER === 'mock' ? mockAuthAdapter : apiAuthAdapter

export function AuthProvider({ children, adapter = defaultAdapter }: { children: ReactNode; adapter?: AuthAdapter }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let active = true
    void adapter.restore().then(session => {
      if (!active) return
      setUser(session?.user ?? null)
      setStatus(session ? 'authenticated' : 'unauthenticated')
    }).catch(() => { if (active) { setUser(null); setStatus('unauthenticated') } })
    return () => { active = false }
  }, [adapter])

  useEffect(() => {
    if (adapter !== mockAuthAdapter) return
    const syncSession = (event: StorageEvent) => {
      if (event.key !== MOCK_SESSION_KEY && event.key !== null) return
      void adapter.restore().then(session => {
        setUser(session?.user ?? null)
        setStatus(session ? 'authenticated' : 'unauthenticated')
      }).catch(() => { setUser(null); setStatus('unauthenticated') })
    }
    window.addEventListener('storage', syncSession)
    return () => window.removeEventListener('storage', syncSession)
  }, [adapter])

  useEffect(() => {
    if (adapter !== apiAuthAdapter) return
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      void adapter.restore().then(session => {
        setUser(session?.user ?? null)
        setStatus(session ? 'authenticated' : 'unauthenticated')
      }).catch(() => { setUser(null); setStatus('unauthenticated') })
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [adapter])

  const signIn = async (input: SignInInput) => {
    const session = await adapter.signIn(input)
    setUser(session.user)
    setStatus('authenticated')
  }
  const signOut = async () => {
    try { await adapter.signOut() } finally { setUser(null); setStatus('unauthenticated') }
  }

  return <AuthContext value={{ status, user, signIn, signOut }}>{children}</AuthContext>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function useOptionalAuth() { return useContext(AuthContext) }
