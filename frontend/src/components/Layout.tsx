import { useState, type FormEvent } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'

const year = new Date().getFullYear()

export function Layout() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  function onSearch(event: FormEvent) {
    event.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b py-6">
        <Link to="/" className="text-2xl font-bold">
          Blog
        </Link>
        <form onSubmit={onSearch} role="search">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm bài viết…"
            aria-label="Tìm bài viết"
            className="rounded border px-3 py-1.5 text-sm"
          />
        </form>
      </header>
      <main className="flex-1 py-6">
        <Outlet />
      </main>
      <footer className="border-t py-6 text-center text-sm text-slate-500">
        © {year} Blog
      </footer>
    </div>
  )
}
