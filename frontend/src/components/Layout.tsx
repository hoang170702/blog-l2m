import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Brand } from './Brand'

const year = new Date().getFullYear()

export function Layout() {
  const navigate = useNavigate()
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
          <form onSubmit={onSearch} role="search" className="ml-auto w-full sm:w-72">
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
          <span>© {year} · Viết, lưu giữ và chia sẻ</span>
        </div>
      </footer>
    </div>
  )
}
