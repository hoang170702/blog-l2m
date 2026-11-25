export interface Term {
  id: string
  name: string
  slug: string
}

export interface Author {
  id: string
  name: string
  avatarUrl: string | null
  /** Short self-description; only loaded for the author page and the profile. */
  bio?: string | null
  /** Only loaded for the author page (D43). */
  followers?: number
}

export interface PostSummary {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImageUrl: string | null
  publishedAt: string | null
  category: Term | null
  tags: Term[]
  author: Author | null
  views: number
  likes: number
}

/** A series the post belongs to, with every live part in order (D47). */
export interface PostSeries {
  id: string
  title: string
  slug: string
  description: string | null
  /** This post's position (1-based). */
  order: number | null
  parts: { title: string; slug: string; order: number | null }[]
}

export interface Series {
  id: string
  title: string
  slug: string
  description: string | null
  authorId: string
}

export interface PostDetail extends PostSummary {
  content: string
  series: PostSeries | null
  /** Set when an admin hid the post (D49); only its author and admins can load it then. */
  hiddenAt: string | null
}

export type PostStatus = 'DRAFT' | 'PUBLISHED'

export interface AdminPost extends PostDetail {
  coverImagePath: string | null
  authorId: string | null
  status: PostStatus
  createdAt: string
  updatedAt: string
  hiddenAt: string | null
  seriesId: string | null
  seriesOrder: number | null
  /** Comments on the post, all statuses (D48). */
  comments: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface Comment {
  id: string
  /** Set on a reply; replies are one level deep. */
  parentId: string | null
  authorName: string
  content: string
  createdAt: string
  /** The database replaced banned words with `*` (D50). */
  masked: boolean
  /** Partial address of the commenter, only present on masked comments (e.g. `113.161.*.*`). */
  clientHint: string | null
}

/** Full commenter details, readable by admins and the post's author (D50). */
export interface CommentClient {
  client: string
  userAgent: string | null
  blocked: boolean
}

export interface BlockedClient {
  client: string
  reason: string | null
  blockedAt: string
  commentCount: number
}

export type CommentStatus = 'APPROVED' | 'REJECTED'

export interface AdminComment extends Comment {
  status: CommentStatus
  postId: string
  post: { title: string; slug: string }
}

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  isAdmin: boolean
  /** Suspended members still sign in and read, but every write is refused. */
  suspended: boolean
  bio: string | null
  /** Uploaded avatar inside the post-images bucket; null shows the sign-in provider's picture. */
  avatarPath: string | null
  /** The sign-in provider's picture (Google, GitHub). */
  providerAvatarUrl: string | null
}

export type OAuthProvider = 'google' | 'github'

export interface DashboardStats {
  posts: number
  drafts: number
  /** Totals over the user's posts (D48). */
  views: number
  likes: number
  /** Site-wide totals, only for admins. */
  site: { posts: number; members: number; openReports: number } | null
}

export interface PostInput {
  title: string
  slug?: string
  excerpt?: string
  content: string
  /** Object name inside the post-images bucket (`<uuid>.<ext>`). */
  coverImagePath?: string
  status: PostStatus
  /** ISO time to publish at (may be in the future); null publishes now; omitted keeps the stored one. */
  publishedAt?: string | null
  categoryId: string | null
  tagIds: string[]
  /** Own series to file the post under (D47); null leaves any series. */
  seriesId?: string | null
  seriesOrder?: number | null
}

export interface ProfileInput {
  name: string
  bio: string | null
  avatarPath: string | null
}

export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'

export type ReportTarget = { postId: string } | { commentId: string }

export interface Report {
  id: string
  reason: string
  status: ReportStatus
  createdAt: string
  post: { id: string; title: string; slug: string } | null
  comment: {
    id: string
    content: string
    authorName: string
    status: CommentStatus
    post: { title: string; slug: string } | null
  } | null
}

export type NotificationKind = 'comment' | 'like' | 'new_post'

/** In-app notification for the signed-in user (D44). */
export interface Notification {
  id: string
  kind: NotificationKind
  actorName: string
  post: { title: string; slug: string } | null
  createdAt: string
  readAt: string | null
}

export interface Member extends Author {
  email: string
  createdAt: string
  postCount: number
  isAdmin: boolean
  suspendedAt: string | null
  suspendedReason: string | null
}
