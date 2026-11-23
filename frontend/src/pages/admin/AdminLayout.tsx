import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'

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
    <div className="mx-auto max-w-5xl px-4">
      <header className="flex flex-wrap items-center gap-4 border-b py-4">
        <NavLink to="/admin" className="font-bold">
          Quản trị
        </NavLink>
        <nav className="flex flex-1 flex-wrap gap-3 text-sm">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? 'font-semibold text-indigo-600' : 'text-slate-600'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <span className="text-sm text-slate-500">{user?.email}</span>
        <button
          className="text-sm text-slate-600 hover:underline"
          onClick={async () => {
            await logout()
            navigate('/admin/login')
          }}
        >
          Đăng xuất
        </button>
      </header>
      <main className="py-6">
        <Outlet />
      </main>
    </div>
  )
}
