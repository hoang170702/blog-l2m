import { api } from './client'
import type {
  AdminComment,
  AdminPost,
  Comment,
  CommentStatus,
  Page,
  PostDetail,
  PostInput,
  PostStatus,
  PostSummary,
  Term,
  User,
} from './types'

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export type TermKind = 'categories' | 'tags'

export const publicApi = {
  posts: (params: { page?: number; category?: string; tag?: string; q?: string }) =>
    api<Page<PostSummary>>(`/posts${query(params)}`),
  post: (slug: string) => api<PostDetail>(`/posts/${encodeURIComponent(slug)}`),
  comments: (slug: string) => api<Comment[]>(`/posts/${encodeURIComponent(slug)}/comments`),
  submitComment: (slug: string, body: { authorName: string; content: string }) =>
    api<{ id: string; status: CommentStatus }>(`/posts/${encodeURIComponent(slug)}/comments`, {
      method: 'POST',
      body,
    }),
  terms: (kind: TermKind) => api<Term[]>(`/${kind}`),
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  me: () => api<User>('/auth/me'),
}

export const adminApi = {
  posts: (params: { page?: number; status?: PostStatus }) =>
    api<Page<AdminPost>>(`/admin/posts${query(params)}`),
  post: (id: string) => api<AdminPost>(`/admin/posts/${id}`),
  createPost: (body: PostInput) => api<AdminPost>('/admin/posts', { method: 'POST', body }),
  updatePost: (id: string, body: Partial<PostInput>) =>
    api<AdminPost>(`/admin/posts/${id}`, { method: 'PATCH', body }),
  deletePost: (id: string) => api<void>(`/admin/posts/${id}`, { method: 'DELETE' }),
  createTerm: (kind: TermKind, name: string) =>
    api<Term>(`/admin/${kind}`, { method: 'POST', body: { name } }),
  updateTerm: (kind: TermKind, id: string, name: string) =>
    api<Term>(`/admin/${kind}/${id}`, { method: 'PATCH', body: { name } }),
  deleteTerm: (kind: TermKind, id: string) =>
    api<void>(`/admin/${kind}/${id}`, { method: 'DELETE' }),
  comments: (params: { page?: number; status?: CommentStatus }) =>
    api<Page<AdminComment>>(`/admin/comments${query(params)}`),
  moderateComment: (id: string, status: CommentStatus) =>
    api<AdminComment>(`/admin/comments/${id}`, { method: 'PATCH', body: { status } }),
  deleteComment: (id: string) => api<void>(`/admin/comments/${id}`, { method: 'DELETE' }),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api<{ url: string }>('/admin/uploads', { method: 'POST', body: form })
  },
}
