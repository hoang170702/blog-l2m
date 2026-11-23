import { Link } from 'react-router'
import type { PostSummary } from '../api/types'
import { formatDate } from '../lib/format'

export function PostCard({ post, featured = false }: { post: PostSummary; featured?: boolean }) {
  return (
    <article
      className={`card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-glow ${
        featured ? 'md:col-span-2 md:flex-row' : ''
      }`}
    >
      <Link
        to={`/posts/${post.slug}`}
        className={`block overflow-hidden bg-gradient-to-br from-primary-soft to-secondary-soft ${
          featured ? 'aspect-video md:aspect-auto md:w-1/2' : 'aspect-video'
        }`}
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
      <div
        className={`flex flex-1 flex-col gap-3 p-6 ${featured ? 'md:justify-center md:p-8' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          {post.category && (
            <Link
              to={`/category/${post.category.slug}`}
              className="rounded-full bg-secondary-soft px-3 py-1 text-secondary-dark transition hover:bg-secondary hover:text-ink"
            >
              {post.category.name}
            </Link>
          )}
          <span>{formatDate(post.publishedAt)}</span>
        </div>
        <h2
          className={`font-display font-bold leading-tight ${featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}
        >
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
