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
  authorName: string
  content: string
  createdAt: string
}

export type CommentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

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
}

export type OAuthProvider = 'google' | 'github'

export interface DashboardStats {
  posts: number
  drafts: number
  pendingComments: number
  /** Site-wide totals, only for admins. */
  site: { posts: number; members: number } | null
}

export interface PostInput {
  title: string
  slug?: string
  excerpt?: string
  content: string
  /** Object name inside the post-images bucket (`<uuid>.<ext>`). */
  coverImagePath?: string
  status: PostStatus
  categoryId: string | null
  tagIds: string[]
}
