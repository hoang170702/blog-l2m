import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { User } from '../api/types'
import { useAuth } from '../auth/AuthContext'

export function Avatar({
  user,
  size = 'h-9 w-9',
}: {
  user: Pick<User, 'name' | 'avatarUrl'>
  size?: string
}) {
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt=""
      referrerPolicy="no-referrer"
      className={`${size} shrink-0 rounded-full object-cover ring-2 ring-surface`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary font-display text-sm font-bold text-white`}
    >
      {user.name.charAt(0).toUpperCase()}
    </span>
  )
}

/** Header account control: "Đăng nhập" when signed out, avatar + dropdown when signed in. */
export function UserMenu() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent | KeyboardEvent) {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  if (loading) return <span className="h-9 w-9 animate-pulse rounded-full bg-line" />
  if (!user) {
    return (
      <Link to="/login" className="btn-ghost py-2">
        Đăng nhập
      </Link>
    )
  }

  const item =
    'block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-primary-soft hover:text-primary-dark'
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tài khoản"
        className="flex items-center gap-2 rounded-full transition hover:opacity-90"
      >
        <Avatar user={user} />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-30 mt-2 w-60 p-2 shadow-glow">
          <div className="border-b border-line px-3 pt-1 pb-3">
            <p className="truncate font-bold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            {user.isAdmin && (
              <span className="mt-1 inline-flex rounded-full bg-secondary-soft px-2 py-0.5 text-xs font-bold text-secondary-dark">
                Quản trị viên
              </span>
            )}
          </div>
          <div className="pt-2" onClick={() => setOpen(false)}>
            <Link role="menuitem" to="/dashboard" className={item}>
              Tổng quan
            </Link>
            <Link role="menuitem" to="/dashboard/posts" className={item}>
              Bài viết của tôi
            </Link>
            <Link role="menuitem" to="/write" className={item}>
              Viết bài mới
            </Link>
            <Link role="menuitem" to="/dashboard/profile" className={item}>
              Hồ sơ của tôi
            </Link>
            <button
              role="menuitem"
              type="button"
              className={`${item} text-red-600`}
              onClick={async () => {
                await logout()
                navigate('/')
              }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
