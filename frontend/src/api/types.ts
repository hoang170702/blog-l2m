export interface Term {
  id: string
  name: string
  slug: string
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
}

export interface PostDetail extends PostSummary {
  content: string
}

export type PostStatus = 'DRAFT' | 'PUBLISHED'

export interface AdminPost extends PostDetail {
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
  role: string
}

export interface PostInput {
  title: string
  slug?: string
  excerpt?: string
  content: string
  coverImageUrl?: string
  status: PostStatus
  categoryId: string | null
  tagIds: string[]
}
