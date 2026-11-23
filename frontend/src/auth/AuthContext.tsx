import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../api/endpoints'
import type { OAuthProvider, User } from '../api/types'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
  signInWithProvider: (provider: OAuthProvider) => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setUser(await authApi.currentUser().catch(() => null))
    setLoading(false)
  }, [])

  // The stored session is restored (and an OAuth ?code= exchanged) by supabase-js on load;
  // every later sign-in, sign-out or profile change arrives as an auth event.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
        return
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Supabase calls inside this callback can deadlock the auth lock; defer them.
        setTimeout(() => void reload(), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [reload])

  const signInWithProvider = useCallback(
    (provider: OAuthProvider) => authApi.signInWithProvider(provider),
    [],
  )

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      await authApi.signInWithPassword(email, password)
      await reload()
    },
    [reload],
  )

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, signInWithProvider, signInWithPassword, logout }),
    [user, loading, signInWithProvider, signInWithPassword, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
