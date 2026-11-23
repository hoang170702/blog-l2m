import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Spinner } from '../components/Status'
import { useAuth } from './AuthContext'

/** Any signed-in user; `admin` additionally requires site-admin rights. */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (admin && !user.isAdmin) return <Navigate to="/dashboard" replace />
  return children
}
