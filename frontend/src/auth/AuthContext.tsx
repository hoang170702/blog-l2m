import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { refreshAccessToken, setAccessToken } from '../api/client'
import { authApi } from '../api/endpoints'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore the session from the refresh cookie on first load.
  useEffect(() => {
    let cancelled = false
    refreshAccessToken()
      .then((token) => (token ? authApi.me() : null))
      .catch(() => null)
      .then((me) => {
        if (!cancelled) {
          setUser(me)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    setAccessToken(result.accessToken)
    setUser(result.user)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined)
    setAccessToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
