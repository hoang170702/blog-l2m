import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { Brand } from '../../components/Brand'
import { UserMenu } from '../../components/UserMenu'

const memberLinks = [
  ['/dashboard', 'Tổng quan', true],
  ['/dashboard/posts', 'Bài viết', false],
  ['/dashboard/comments', 'Bình luận', false],
  ['/dashboard/saved', 'Đã lưu', false],
  ['/dashboard/notifications', 'Thông báo', false],
  ['/dashboard/profile', 'Hồ sơ', false],
] as const

const adminLinks = [
  ['/dashboard/categories', 'Chuyên mục'],
  ['/dashboard/tags', 'Thẻ'],
  ['/dashboard/reports', 'Báo cáo'],
  ['/dashboard/members', 'Thành viên'],
  ['/dashboard/moderation', 'Kiểm duyệt'],
] as const

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-primary-soft text-primary-dark' : 'text-muted hover:bg-surface hover:text-ink'
  }`
}

/** Signed-in area: dashboard, own posts, comment moderation, editor; admins get site settings. */
export function AdminLayout() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="L2M Blog — trang chủ">
            <Brand />
          </Link>
          <span className="hidden text-sm font-semibold text-muted sm:inline">· Góc viết</span>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/write" className="btn-primary py-2">
              ✍️ Viết bài
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8">
        <aside className="lg:w-56 lg:shrink-0">
          <nav className="card flex gap-1 overflow-x-auto p-2 lg:sticky lg:top-20 lg:flex-col">
            {memberLinks.map(([to, label, end]) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                {label}
              </NavLink>
            ))}
            {user?.isAdmin && (
              <>
                <p className="hidden px-3 pt-3 pb-1 text-xs font-bold tracking-wide text-muted uppercase lg:block">
                  Quản trị
                </p>
                {adminLinks.map(([to, label]) => (
                  <NavLink key={to} to={to} className={navClass}>
                    {label}
                  </NavLink>
                ))}
              </>
            )}
            <Link
              to="/"
              className="flex items-center rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:text-ink lg:mt-3"
            >
              ← Về trang blog
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          {user?.suspended && (
            <p
              role="alert"
              className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
            >
              Tài khoản của bạn đang bị khoá: bạn vẫn đọc được nhưng không thể viết, sửa bài, tải
              ảnh hay thích bài. Liên hệ quản trị viên nếu đây là nhầm lẫn.
            </p>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
