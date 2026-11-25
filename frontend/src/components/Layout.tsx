import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { RSS_URL } from '../lib/supabase'
import { Brand } from './Brand'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

const year = new Date().getFullYear()

export function Layout() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [q, setQ] = useState('')

  function onSearch(event: FormEvent) {
    event.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="L2M Blog — trang chủ">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-semibold sm:flex">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 transition ${isActive ? 'bg-primary-soft text-primary-dark' : 'text-muted hover:text-ink'}`
              }
            >
              Trang chủ
            </NavLink>
          </nav>
          <div className="order-2 ml-auto flex items-center gap-2 sm:order-3 sm:ml-0">
            <Link to={user ? '/write' : '/login'} className="btn-primary py-2">
              ✍️ <span className="hidden sm:inline">Viết bài</span>
            </Link>
            <ThemeToggle />
            <UserMenu />
          </div>
          <form
            onSubmit={onSearch}
            role="search"
            className="order-3 w-full sm:order-2 sm:ml-auto sm:w-64"
          >
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm bài viết…"
              aria-label="Tìm bài viết"
              className="input rounded-full py-2 text-sm"
            />
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted sm:px-6">
          <Brand compact />
          <span>
            © {year} · Viết, lưu giữ và chia sẻ ·{' '}
            <a href={RSS_URL} className="font-semibold transition hover:text-primary">
              RSS
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
