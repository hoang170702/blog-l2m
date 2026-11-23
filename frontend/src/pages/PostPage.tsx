import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { publicApi } from '../api/endpoints'
import { Markdown } from '../components/Markdown'
import { TagList } from '../components/PostCard'
import { ErrorMessage, Spinner } from '../components/Status'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { formatDate } from '../lib/format'
import { CommentSection } from './CommentSection'
import { NotFoundPage } from './NotFoundPage'

export function PostPage() {
  const { slug = '' } = useParams()
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
    <article>
      <h1 className="text-3xl font-bold">{post.title}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {formatDate(post.publishedAt)}
        {post.category && (
          <>
            {' · '}
            <Link to={`/category/${post.category.slug}`} className="hover:underline">
              {post.category.name}
            </Link>
          </>
        )}
      </p>
      <TagList tags={post.tags} />
      {post.coverImageUrl && (
        <img src={post.coverImageUrl} alt="" className="my-6 w-full rounded object-cover" />
      )}
      <div className="mt-6">
        <Markdown>{post.content}</Markdown>
      </div>
      <CommentSection slug={slug} />
    </article>
  )
}
