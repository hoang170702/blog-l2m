import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { Brand } from '../../components/Brand'
import { ErrorMessage } from '../../components/Status'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

export function LoginPage() {
  useDocumentTitle('Đăng nhập')
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? '/admin/posts'

  if (user) return <Navigate to={from} replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm px-4">
      <div className="card p-8 shadow-glow">
        <Brand />
        <h1 className="mt-2 mb-6 text-2xl font-bold">Đăng nhập quản trị</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            className="input"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            aria-label="Mật khẩu"
            className="input"
          />
          {error !== null && <ErrorMessage error={error} />}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  )
}
