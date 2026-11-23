import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { Brand } from '../../components/Brand'

const links = [
  ['/admin/posts', 'Bài viết'],
  ['/admin/categories', 'Chuyên mục'],
  ['/admin/tags', 'Thẻ'],
  ['/admin/comments', 'Bình luận'],
] as const

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <NavLink to="/admin" className="flex items-center gap-2">
            <Brand compact /> <span className="text-base text-muted">· Quản trị</span>
          </NavLink>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm font-semibold">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 transition ${isActive ? 'bg-primary-soft text-primary-dark' : 'text-muted hover:text-ink'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="text-sm text-muted">{user?.email}</span>
          <button
            className="btn-ghost py-1.5"
            onClick={async () => {
              await logout()
              navigate('/admin/login')
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
