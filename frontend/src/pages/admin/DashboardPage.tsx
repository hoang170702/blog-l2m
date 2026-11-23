import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { adminApi } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { formatDate } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

function StatCard({
  label,
  value,
  to,
  tone = 'primary',
}: {
  label: string
  value: number | undefined
  to: string
  tone?: 'primary' | 'secondary' | 'ink'
}) {
  const tones = {
    primary: 'from-primary/10 text-primary-dark',
    secondary: 'from-secondary/15 text-secondary-dark',
    ink: 'from-ink/5 text-ink',
  }
  return (
    <Link
      to={to}
      className={`card group bg-gradient-to-br ${tones[tone]} to-transparent p-5 transition hover:-translate-y-0.5 hover:shadow-glow`}
    >
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl font-extrabold">
        {value ?? <span className="inline-block h-9 w-12 animate-pulse rounded-lg bg-line" />}
      </p>
    </Link>
  )
}

export function DashboardPage() {
  useDocumentTitle('Tổng quan')
  const { user } = useAuth()
  const stats = useQuery({
    queryKey: ['dashboard-stats', user?.id, user?.isAdmin],
    queryFn: () => adminApi.stats(user!),
    enabled: Boolean(user),
  })
  const recent = useQuery({
    queryKey: ['admin-posts', 'recent', user?.id],
    queryFn: () => adminApi.posts({ page: 1, authorId: user!.id }),
    enabled: Boolean(user),
  })

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">Xin chào,</p>
          <h1 className="text-3xl font-extrabold md:text-4xl">{user?.name} 👋</h1>
        </div>
        <Link to="/write" className="btn-primary">
          ✍️ Viết bài mới
        </Link>
      </div>

      {stats.error && <ErrorMessage error={stats.error} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Bài viết của bạn" value={stats.data?.posts} to="/dashboard/posts" />
        <StatCard
          label="Bản nháp"
          value={stats.data?.drafts}
          to="/dashboard/posts?status=DRAFT"
          tone="ink"
        />
        <StatCard
          label="Bình luận chờ duyệt"
          value={stats.data?.pendingComments}
          to="/dashboard/comments"
          tone="secondary"
        />
      </div>

      {stats.data?.site && (
        <div className="card flex flex-wrap items-center gap-x-8 gap-y-2 px-6 py-4 text-sm">
          <span className="font-bold tracking-wide text-muted uppercase">Toàn trang</span>
          <span>
            <strong className="font-display text-lg">{stats.data.site.posts}</strong> bài viết
          </span>
          <span>
            <strong className="font-display text-lg">{stats.data.site.members}</strong> thành viên
          </span>
          <Link
            to="/dashboard/posts?all=1"
            className="ml-auto font-semibold text-primary hover:underline"
          >
            Quản lý mọi bài viết →
          </Link>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Sửa gần đây</h2>
          <Link
            to="/dashboard/posts"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Xem tất cả →
          </Link>
        </div>
        {recent.isPending ? (
          <Spinner />
        ) : recent.error ? (
          <ErrorMessage error={recent.error} />
        ) : recent.data.items.length === 0 ? (
          <Empty>
            Bạn chưa có bài viết nào.{' '}
            <Link to="/write" className="font-semibold text-primary hover:underline">
              Viết bài đầu tiên
            </Link>
          </Empty>
        ) : (
          <ul className="card divide-y divide-line">
            {recent.data.items.slice(0, 5).map((post) => (
              <li key={post.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Link to={`/write/${post.id}`} className="font-bold hover:text-primary">
                    {post.title}
                  </Link>
                  <p className="text-xs text-muted">Cập nhật {formatDate(post.updatedAt)}</p>
                </div>
                <StatusBadge published={post.status === 'PUBLISHED'} />
                {post.status === 'PUBLISHED' && (
                  <Link
                    to={`/posts/${post.slug}`}
                    className="hidden text-sm font-semibold text-muted hover:text-primary sm:inline"
                  >
                    Xem
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
      Đã đăng
    </span>
  ) : (
    <span className="rounded-full bg-line px-2.5 py-1 text-xs font-bold text-muted">Nháp</span>
  )
}
