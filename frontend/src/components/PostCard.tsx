import { Link } from 'react-router'
import type { PostSummary } from '../api/types'
import { formatDate } from '../lib/format'

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="flex flex-col gap-4 border-b border-slate-100 py-6 sm:flex-row">
      {post.coverImageUrl && (
        <img
          src={post.coverImageUrl}
          alt=""
          loading="lazy"
          className="h-40 w-full rounded object-cover sm:h-28 sm:w-44"
        />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold">
          <Link to={`/posts/${post.slug}`} className="hover:text-indigo-600">
            {post.title}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-slate-500">
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
        {post.excerpt && <p className="mt-2 text-slate-700">{post.excerpt}</p>}
        <TagList tags={post.tags} />
      </div>
    </article>
  )
}

export function TagList({ tags }: { tags: PostSummary['tags'] }) {
  if (tags.length === 0) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag.id}>
          <Link
            to={`/tag/${tag.slug}`}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-indigo-100"
          >
            #{tag.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
