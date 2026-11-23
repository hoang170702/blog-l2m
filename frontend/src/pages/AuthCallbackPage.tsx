import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { takeReturnPath } from '../auth/returnPath'
import { ErrorMessage, Spinner } from '../components/Status'
import { useDocumentTitle } from '../lib/useDocumentTitle'

/**
 * OAuth return route. supabase-js exchanges the `?code=` itself on load (PKCE); this page
 * waits for the session and forwards to the page the user came from.
 */
export function AuthCallbackPage() {
  useDocumentTitle('Đang đăng nhập')
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [providerError] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.slice(1))
    return params.get('error_description') ?? hash.get('error_description')
  })

  useEffect(() => {
    if (user) navigate(takeReturnPath(), { replace: true })
  }, [user, navigate])

  if (providerError || (!loading && !user)) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4">
        <ErrorMessage error={new Error(providerError ?? 'Đăng nhập không thành công.')} />
        <Link to="/login" className="btn-ghost mt-4">
          Thử lại
        </Link>
      </div>
    )
  }
  return <Spinner />
}
