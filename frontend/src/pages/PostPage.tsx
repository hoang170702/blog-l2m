import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { adminApi, publicApi } from '../api/endpoints'
import type { PostDetail } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Markdown } from '../components/Markdown'
import { AuthorChip, TagList } from '../components/PostCard'
import { ReportButton } from '../components/ReportButton'
import { ShareButtons } from '../components/ShareButtons'
import { Avatar } from '../components/UserMenu'
import { ErrorMessage, Spinner } from '../components/Status'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { formatDate } from '../lib/format'
import { readingMinutes } from '../lib/headings'
import { CommentSection } from './CommentSection'
import { NotFoundPage } from './NotFoundPage'

export function PostPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    data: post,
    error,
    isPending,
  } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => publicApi.post(slug),
  })
  useDocumentTitle(post?.title)
  useRecordView(post ? slug : null)

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deletePost(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['posts'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-posts'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      ])
      queryClient.removeQueries({ queryKey: ['post', slug] })
      navigate('/', { replace: true })
    },
  })

  if (isPending) return <Spinner />
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (error) return <ErrorMessage error={error} />

  const isAuthor = Boolean(user) && post.author?.id === user?.id
  // The author and admins may delete a post (D38); only the author edits it.
  const canDelete = isAuthor || Boolean(user?.isAdmin)

  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/" className="text-sm font-semibold text-muted transition hover:text-primary">
        ← Tất cả bài viết
      </Link>
      {post.hiddenAt && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          Bài này đã bị ẩn bởi quản trị viên từ {formatDate(post.hiddenAt)}. Chỉ bạn và quản trị
          viên còn xem được.
        </p>
      )}
      <header className="mt-6 mb-8">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
          {post.category && (
            <Link
              to={`/category/${post.category.slug}`}
              className="rounded-full bg-secondary-soft px-3 py-1 text-xs text-secondary-dark transition hover:bg-secondary hover:text-ink"
            >
              {post.category.name}
            </Link>
          )}
          <span>{formatDate(post.publishedAt)}</span>
          <span>· {readingMinutes(post.content)} phút đọc</span>
          <span>· {post.views} lượt xem</span>
          {canDelete && (
            <span className="ml-auto flex gap-3">
              {isAuthor && (
                <Link to={`/write/${post.id}`} className="text-primary hover:underline">
                  ✎ Sửa bài
                </Link>
              )}
              {canDelete && (
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Xoá bài “${post.title}”? Không thể hoàn tác.`))
                      remove.mutate(post.id)
                  }}
                  className="text-red-600 hover:underline"
                >
                  Xoá bài
                </button>
              )}
            </span>
          )}
        </div>
        {remove.isError && (
          <div className="mt-4">
            <ErrorMessage error={remove.error} />
          </div>
        )}
        <h1 className="mt-4 text-4xl leading-tight font-extrabold md:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-lg text-muted">{post.excerpt}</p>}
        {post.author && (
          <div className="mt-6 flex items-center gap-3">
            <Avatar user={post.author} size="h-10 w-10" />
            <span className="text-sm">
              <span className="text-muted">Viết bởi </span>
              <Link to={`/u/${post.author.id}`} className="font-bold hover:text-primary">
                {post.author.name}
              </Link>
            </span>
          </div>
        )}
      </header>
      {post.coverImageUrl && (
        <img
          src={post.coverImageUrl}
          alt=""
          className="mb-10 aspect-video w-full rounded-3xl object-cover shadow-glow"
        />
      )}
      <PostBody post={post} />
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <LikeButton post={post} />
        <BookmarkButton post={post} />
        <ShareButtons title={post.title} />
        <span className="ml-auto">
          <ReportButton target={{ postId: post.id }} label="Báo cáo bài viết" />
        </span>
      </div>
      <RelatedPosts post={post} />
      <CommentSection slug={slug} />
    </article>
  )
}

/** Counts one view per browser tab session; the database also dedupes per address and hour. */
function useRecordView(slug: string | null) {
  useEffect(() => {
    if (!slug) return
    const key = `viewed:${slug}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    publicApi.recordView(slug).catch(() => undefined)
  }, [slug])
}

function PostBody({ post }: { post: PostDetail }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [toc, setToc] = useState<{ id: string; text: string; level: number }[]>([])

  // Headings get their ids while rendering (lib/headings.ts); read them back from the DOM.
  useEffect(() => {
    const headings = contentRef.current?.querySelectorAll<HTMLElement>('h2[id], h3[id]') ?? []
    setToc(
      Array.from(headings, (heading) => ({
        id: heading.id,
        text: heading.textContent ?? '',
        level: heading.tagName === 'H3' ? 3 : 2,
      })),
    )
  }, [post.content])

  return (
    <div className="card px-6 py-8 sm:px-10">
      {toc.length >= 2 && (
        <nav aria-label="Mục lục" className="mb-8 rounded-2xl bg-canvas p-5 text-sm">
          <p className="mb-2 font-bold">Mục lục</p>
          <ol className="space-y-1">
            {toc.map((item) => (
              <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
                <a href={`#${item.id}`} className="text-muted transition hover:text-primary">
                  {item.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div ref={contentRef}>
        <Markdown>{post.content}</Markdown>
      </div>
      <div className="mt-8 border-t border-line pt-6">
        <TagList tags={post.tags} />
      </div>
    </div>
  )
}

function LikeButton({ post }: { post: PostDetail }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const likedKey = ['liked', post.id, user?.id]
  const liked = useQuery({
    queryKey: likedKey,
    queryFn: () => publicApi.liked(post.id),
    enabled: Boolean(user),
  })
  const toggle = useMutation({
    mutationFn: (next: boolean) => publicApi.setLiked(post.id, next),
    onSuccess: (_, next) => {
      queryClient.setQueryData(likedKey, next)
      return queryClient.invalidateQueries({ queryKey: ['post', post.slug] })
    },
  })
  const className =
    'inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary'

  if (!user) {
    return (
      <Link
        to="/login"
        state={{ from: `/posts/${post.slug}` }}
        className={className}
        title="Đăng nhập để thích bài viết"
      >
        ♡ {post.likes}
      </Link>
    )
  }
  const on = liked.data === true
  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        aria-pressed={on}
        disabled={liked.isPending || toggle.isPending}
        onClick={() => toggle.mutate(!on)}
        className={`${className} ${on ? 'border-primary bg-primary-soft text-primary-dark' : ''}`}
      >
        {on ? '♥' : '♡'} {post.likes} lượt thích
      </button>
      {toggle.isError && <span className="text-sm text-red-600">{toggle.error.message}</span>}
    </span>
  )
}

function BookmarkButton({ post }: { post: PostDetail }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = ['bookmarked', post.id, user?.id]
  const saved = useQuery({
    queryKey: key,
    queryFn: () => publicApi.bookmarked(post.id),
    enabled: Boolean(user),
  })
  const toggle = useMutation({
    mutationFn: (next: boolean) => publicApi.setBookmarked(post.id, next),
    onSuccess: (_, next) => {
      queryClient.setQueryData(key, next)
      return queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
    },
  })
  const className =
    'inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary'

  if (!user) {
    return (
      <Link
        to="/login"
        state={{ from: `/posts/${post.slug}` }}
        className={className}
        title="Đăng nhập để lưu bài viết"
      >
        🔖 Lưu
      </Link>
    )
  }
  const on = saved.data === true
  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        aria-pressed={on}
        disabled={saved.isPending || toggle.isPending}
        onClick={() => toggle.mutate(!on)}
        className={`${className} ${on ? 'border-primary bg-primary-soft text-primary-dark' : ''}`}
      >
        🔖 {on ? 'Đã lưu' : 'Lưu'}
      </button>
      {toggle.isError && <span className="text-sm text-red-600">{toggle.error.message}</span>}
    </span>
  )
}

function RelatedPosts({ post }: { post: PostDetail }) {
  const related = useQuery({
    queryKey: ['related', post.id],
    queryFn: () => publicApi.related(post),
  })
  if (!related.data?.length) return null
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-2xl font-extrabold">Bài viết liên quan</h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {related.data.map((item) => (
          <li key={item.id} className="card overflow-hidden">
            <Link to={`/posts/${item.slug}`} className="group block">
              <div className="aspect-video bg-gradient-to-br from-primary-soft to-secondary-soft">
                {item.coverImageUrl && (
                  <img
                    src={item.coverImageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <p className="px-4 pt-4 leading-snug font-bold transition group-hover:text-primary">
                {item.title}
              </p>
            </Link>
            {item.author && (
              <div className="px-4 pt-2 pb-4 text-xs font-semibold">
                <AuthorChip author={item.author} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
