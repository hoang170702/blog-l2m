import type { AdminPost } from '../api/types'

/** True for a time after now: a published post with such a publish time is scheduled. */
export function isFuture(iso: string | null | undefined) {
  return Boolean(iso) && new Date(iso!) > new Date()
}

/** Published and past its publish time, so the public post page exists. */
export function isLive(post: Pick<AdminPost, 'status' | 'publishedAt'>) {
  return post.status === 'PUBLISHED' && !isFuture(post.publishedAt)
}
