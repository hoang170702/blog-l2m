export interface Term {
  id: string
  name: string
  slug: string
}

export interface Author {
  id: string
  name: string
  avatarUrl: string | null
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

export interface PostDetail extends PostSummary {
  content: string
}

export type PostStatus = 'DRAFT' | 'PUBLISHED'

export interface AdminPost extends PostDetail {
  coverImagePath: string | null
  authorId: string | null
  status: PostStatus
  createdAt: string
  updatedAt: string
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
}

export type OAuthProvider = 'google' | 'github'

export interface DashboardStats {
  posts: number
  drafts: number
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
}

export interface ProfileInput {
  name: string
  avatarUrl: string | null
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

export interface Member extends Author {
  email: string
  createdAt: string
  postCount: number
  isAdmin: boolean
  suspendedAt: string | null
  suspendedReason: string | null
}
