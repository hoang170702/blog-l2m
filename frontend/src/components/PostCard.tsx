import { Link } from 'react-router'
import type { PostSummary } from '../api/types'
import { formatDate } from '../lib/format'
import { Avatar } from './UserMenu'

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-glow md:flex-row">
      <Link
        to={`/posts/${post.slug}`}
        className="block aspect-video w-full shrink-0 overflow-hidden bg-gradient-to-br from-primary-soft to-secondary-soft md:w-80 md:self-center"
        tabIndex={-1}
        aria-hidden="true"
      >
        {post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="grid h-full w-full place-items-center font-display text-5xl font-extrabold text-primary/30">
            {post.title.charAt(0).toUpperCase()}
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          {post.category && (
            <Link
              to={`/category/${post.category.slug}`}
              className="rounded-full bg-secondary-soft px-3 py-1 text-secondary-dark transition hover:bg-secondary hover:text-ink"
            >
              {post.category.name}
            </Link>
          )}
          {post.author && <AuthorChip author={post.author} />}
          <span>· {formatDate(post.publishedAt)}</span>
        </div>
        <h2 className="font-display text-xl leading-tight font-bold md:text-2xl">
          <Link to={`/posts/${post.slug}`} className="transition hover:text-primary">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && <p className="line-clamp-3 text-muted">{post.excerpt}</p>}
        <TagList tags={post.tags} />
      </div>
    </article>
  )
}

/** Small round avatar and name linking to the author page, for post cards and lists. */
export function AuthorChip({ author }: { author: NonNullable<PostSummary['author']> }) {
  return (
    <Link
      to={`/u/${author.id}`}
      className="inline-flex items-center gap-1.5 text-ink transition hover:text-primary"
    >
      <Avatar user={author} size="h-6 w-6" />
      <span className="truncate">{author.name}</span>
    </Link>
  )
}

export function TagList({ tags }: { tags: PostSummary['tags'] }) {
  if (tags.length === 0) return null
  return (
    <ul className="mt-auto flex flex-wrap gap-2 pt-1">
      {tags.map((tag) => (
        <li key={tag.id}>
          <Link to={`/tag/${tag.slug}`} className="pill">
            #{tag.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
