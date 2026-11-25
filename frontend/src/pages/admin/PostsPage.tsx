import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { adminApi } from '../../api/endpoints'
import type { PostStatus } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Pagination } from '../../components/Pagination'
import { Empty, ErrorMessage, Spinner } from '../../components/Status'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { formatDate } from '../../lib/format'
import { isLive } from '../../lib/schedule'
import { StatusBadge } from './DashboardPage'

export function PostsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? '1') || 1
  const status = (searchParams.get('status') ?? '') as PostStatus | ''
  // Admins may switch to every author's posts; everyone else only ever sees their own.
  const all = Boolean(user?.isAdmin) && searchParams.get('all') === '1'
  useDocumentTitle(all ? 'Mọi bài viết' : 'Bài viết của tôi')

  const posts = useQuery({
    queryKey: ['admin-posts', page, status, all ? 'all' : user?.id],
    queryFn: () =>
      adminApi.posts({ page, status: status || undefined, authorId: all ? undefined : user!.id }),
    enabled: Boolean(user),
    placeholderData: keepPreviousData,
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-posts'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }
  const remove = useMutation({ mutationFn: adminApi.deletePost, onSuccess: refresh })
  const setHidden = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => adminApi.setHidden(id, hidden),
    onSuccess: refresh,
  })

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-extrabold">
          {all ? 'Mọi bài viết' : 'Bài viết của tôi'}
        </h1>
        {user?.isAdmin && (
          <div className="flex rounded-full border border-line bg-surface p-1 text-sm font-semibold">
            {[
              ['', 'Của tôi'],
              ['1', 'Tất cả'],
            ].map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setParam('all', value)}
                className={`rounded-full px-3 py-1 transition ${
                  (value === '1') === all ? 'bg-primary text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <select
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          aria-label="Lọc trạng thái"
          className="input w-auto py-2 text-sm"
        >
          <option value="">Mọi trạng thái</option>
          <option value="PUBLISHED">Đã đăng</option>
          <option value="DRAFT">Bản nháp</option>
        </select>
        <Link to="/write" className="btn-primary">
          ✍️ Viết bài mới
        </Link>
      </div>
      {remove.isError && <ErrorMessage error={remove.error} />}
      {posts.isPending ? (
        <Spinner />
      ) : posts.error ? (
        <ErrorMessage error={posts.error} />
      ) : posts.data.items.length === 0 ? (
        <Empty>
          Chưa có bài viết.{' '}
          <Link to="/write" className="font-semibold text-primary hover:underline">
            Viết ngay
          </Link>
        </Empty>
      ) : (
        <>
          <ul className="space-y-3">
            {posts.data.items.map((post) => (
              <li
                key={post.id}
                className="card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap"
              >
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary-soft to-secondary-soft">
                  {post.coverImageUrl ? (
                    <img src={post.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center font-display text-2xl font-extrabold text-primary/30">
                      {post.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {post.authorId === user?.id ? (
                    <Link to={`/write/${post.id}`} className="font-bold hover:text-primary">
                      {post.title}
                    </Link>
                  ) : (
                    <span className="font-bold">{post.title}</span>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {all && post.author && <>{post.author.name} · </>}
                    Cập nhật {formatDate(post.updatedAt)}
                    {post.category && <> · {post.category.name}</>}
                    {post.status === 'PUBLISHED' && (
                      <>
                        {' '}
                        · {post.views} lượt xem · {post.likes} lượt thích · {post.comments} bình
                        luận
                      </>
                    )}
                  </p>
                </div>
                {post.hiddenAt ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    Đã ẩn
                  </span>
                ) : (
                  <StatusBadge
                    published={post.status === 'PUBLISHED'}
                    publishedAt={post.publishedAt}
                  />
                )}
                <div className="flex gap-3 text-sm font-semibold">
                  {isLive(post) && (
                    <Link to={`/posts/${post.slug}`} className="text-muted hover:text-primary">
                      Xem
                    </Link>
                  )}
                  {post.authorId === user?.id && (
                    <Link to={`/write/${post.id}`} className="text-primary hover:underline">
                      Sửa
                    </Link>
                  )}
                  {user?.isAdmin && post.status === 'PUBLISHED' && (
                    <button
                      className="text-amber-700 hover:underline"
                      onClick={() => setHidden.mutate({ id: post.id, hidden: !post.hiddenAt })}
                    >
                      {post.hiddenAt ? 'Hiện lại' : 'Ẩn'}
                    </button>
                  )}
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => {
                      if (confirm(`Xoá bài “${post.title}”?`)) remove.mutate(post.id)
                    }}
                  >
                    Xoá
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={posts.data.page}
            total={posts.data.total}
            limit={posts.data.limit}
            onChange={(next) => setParam('page', String(next))}
          />
        </>
      )}
    </section>
  )
}
