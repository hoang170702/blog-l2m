import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { publicApi } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import { Markdown } from '../components/Markdown'
import { TagList } from '../components/PostCard'
import { Avatar } from '../components/UserMenu'
import { ErrorMessage, Spinner } from '../components/Status'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { formatDate } from '../lib/format'
import { CommentSection } from './CommentSection'
import { NotFoundPage } from './NotFoundPage'

export function PostPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const {
    data: post,
    error,
    isPending,
  } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => publicApi.post(slug),
  })
  useDocumentTitle(post?.title)

  if (isPending) return <Spinner />
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (error) return <ErrorMessage error={error} />

  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/" className="text-sm font-semibold text-muted transition hover:text-primary">
        ← Tất cả bài viết
      </Link>
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
          {user && post.author?.id === user.id && (
            <Link to={`/write/${post.id}`} className="ml-auto text-primary hover:underline">
              ✎ Sửa bài
            </Link>
          )}
        </div>
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
      <div className="card px-6 py-8 sm:px-10">
        <Markdown>{post.content}</Markdown>
        <div className="mt-8 border-t border-line pt-6">
          <TagList tags={post.tags} />
        </div>
      </div>
      <CommentSection slug={slug} />
    </article>
  )
}
