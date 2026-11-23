/**
 * Data layer on supabase-js. Access rules live in the database (RLS, grants, RPCs in
 * supabase/migrations); these functions only shape queries and map rows to UI types.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { prepareImage } from '../lib/image'
import { POST_IMAGES_BUCKET, postImageUrl, supabase } from '../lib/supabase'
import { ApiError, toApiError, unwrap } from './client'
import type {
  AdminComment,
  AdminPost,
  Author,
  Comment,
  CommentStatus,
  DashboardStats,
  OAuthProvider,
  Page,
  PostDetail,
  PostInput,
  PostStatus,
  PostSummary,
  Term,
  User,
} from './types'

export type TermKind = 'categories' | 'tags'

const PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Rows and mapping
// ---------------------------------------------------------------------------

interface TermRow {
  id: string
  name: string
  slug: string
}

interface ProfileRow {
  id: string
  display_name: string
  avatar_url: string | null
}

interface PostRow {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_path: string | null
  published_at: string | null
  category: TermRow | null
  post_tags: { tag: TermRow | null }[]
  author: ProfileRow | null
  author_id: string | null
  content: string
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}

interface CommentRow {
  id: string
  author_name: string
  content: string
  created_at: string
  status: 'approved' | 'rejected'
  post_id: string
  post: { title: string; slug: string } | null
}

const TERM = 'id, name, slug'
const AUTHOR = 'author:profiles!posts_author_profile_fkey(id, display_name, avatar_url)'
const SUMMARY = `id, title, slug, excerpt, cover_image_path, published_at, author_id, category:categories(${TERM}), post_tags(tag:tags(${TERM})), ${AUTHOR}`
const DETAIL = `${SUMMARY}, content`
const ADMIN_POST = `${DETAIL}, status, created_at, updated_at`
// `post` is an inner join so authors can filter the moderation queue to their own posts.
const ADMIN_COMMENT =
  'id, author_name, content, status, created_at, post_id, post:posts!inner(title, slug, author_id)'

function toAuthor(row: ProfileRow | null): Author | null {
  return row ? { id: row.id, name: row.display_name, avatarUrl: row.avatar_url } : null
}

function toSummary(row: PostRow): PostSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_path ? postImageUrl(row.cover_image_path) : null,
    publishedAt: row.published_at,
    category: row.category,
    tags: row.post_tags
      .map((link) => link.tag)
      .filter((tag): tag is TermRow => tag !== null)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    author: toAuthor(row.author),
  }
}

function toDetail(row: PostRow): PostDetail {
  return { ...toSummary(row), content: row.content }
}

function toAdminPost(row: PostRow): AdminPost {
  return {
    ...toDetail(row),
    coverImagePath: row.cover_image_path,
    authorId: row.author_id,
    status: row.status === 'published' ? 'PUBLISHED' : 'DRAFT',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

type PublicCommentRow = Pick<CommentRow, 'id' | 'author_name' | 'content' | 'created_at'>

function toComment(row: PublicCommentRow): Comment {
  return {
    id: row.id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
  }
}

function toAdminComment(row: CommentRow): AdminComment {
  return {
    ...toComment(row),
    status: row.status.toUpperCase() as CommentStatus,
    postId: row.post_id,
    post: row.post ?? { title: '', slug: '' },
  }
}

interface ListResult {
  data: unknown[] | null
  error: PostgrestError | null
  count: number | null
}

function toPage<R, T>(result: ListResult, page: number, map: (row: R) => T): Page<T> {
  // PGRST103: the requested range starts past the last row (e.g. a stale ?page= link).
  if (result.error?.code === 'PGRST103') return { items: [], total: 0, page, limit: PAGE_SIZE }
  if (result.error) throw toApiError(result.error)
  return {
    items: (result.data as R[]).map(map),
    total: result.count ?? 0,
    page,
    limit: PAGE_SIZE,
  }
}

function range(page: number): [number, number] {
  const from = (page - 1) * PAGE_SIZE
  return [from, from + PAGE_SIZE - 1]
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

function notFound(): never {
  throw new ApiError(404, 'Không tìm thấy.')
}

async function count(result: PromiseLike<{ count: number | null; error: PostgrestError | null }>) {
  const { count, error } = await result
  if (error) throw toApiError(error)
  return count ?? 0
}

/**
 * Removes a cover that no post uses any more (D39). Best effort: Storage RLS only lets the
 * owner or an admin delete, and a failed clean-up must never fail the save or delete.
 */
async function removeImage(path: string | null | undefined) {
  if (!path) return
  await supabase.storage
    .from(POST_IMAGES_BUCKET)
    .remove([path])
    .catch(() => undefined)
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ApiError(401, 'Bạn cần đăng nhập.')
  return id
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const publicApi = {
  async posts({
    page = 1,
    category,
    tag,
    q,
  }: {
    page?: number
    category?: string
    tag?: string
    q?: string
  }): Promise<Page<PostSummary>> {
    const empty: Page<PostSummary> = { items: [], total: 0, page, limit: PAGE_SIZE }
    // Signed-in users can also read their own drafts through RLS, so public pages filter on status.
    let query = supabase.from('posts').select(SUMMARY, { count: 'exact' }).eq('status', 'published')

    if (category) {
      const found = unwrap(
        await supabase.from('categories').select('id').eq('slug', category).maybeSingle(),
      ) as { id: string } | null
      if (!found) return empty
      query = query.eq('category_id', found.id)
    }
    if (tag) {
      const found = unwrap(
        await supabase.from('tags').select('id').eq('slug', tag).maybeSingle(),
      ) as { id: string } | null
      if (!found) return empty
      const links = unwrap(
        await supabase.from('post_tags').select('post_id').eq('tag_id', found.id),
      ) as { post_id: string }[]
      if (links.length === 0) return empty
      query = query.in(
        'id',
        links.map((link) => link.post_id),
      )
    }
    if (q?.trim()) query = query.ilike('title', `%${escapeLike(q.trim())}%`)

    const result = await query.order('published_at', { ascending: false }).range(...range(page))
    return toPage(result, page, toSummary)
  },

  async post(slug: string): Promise<PostDetail> {
    const row = unwrap(
      await supabase
        .from('posts')
        .select(DETAIL)
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle(),
    ) as PostRow | null
    return row ? toDetail(row) : notFound()
  },

  async comments(slug: string): Promise<Comment[]> {
    const rows = unwrap(
      await supabase
        .from('comments')
        .select('id, author_name, content, created_at, posts!inner(slug)')
        .eq('posts.slug', slug)
        .eq('status', 'approved')
        .order('created_at', { ascending: true }),
    ) as PublicCommentRow[]
    return rows.map(toComment)
  },

  async submitComment(
    slug: string,
    body: { authorName: string; content: string },
  ): Promise<{ id: string; status: CommentStatus }> {
    const id = unwrap(
      await supabase.rpc('submit_comment', {
        p_post_slug: slug,
        p_author_name: body.authorName,
        p_content: body.content,
      }),
    ) as string
    return { id, status: 'APPROVED' }
  },

  async terms(kind: TermKind): Promise<Term[]> {
    return unwrap(await supabase.from(kind).select(TERM).order('name')) as Term[]
  },
}

// ---------------------------------------------------------------------------
// Auth: OAuth 2 (Google, GitHub) through Supabase Auth; the first sign-in creates the account
// ---------------------------------------------------------------------------

export const authApi = {
  /** Redirects the browser to the provider; it comes back to /auth/callback. */
  async signInWithProvider(provider: OAuthProvider): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw new ApiError(error.status ?? 400, error.message)
  },

  async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new ApiError(error.status ?? 401, 'Email hoặc mật khẩu không đúng.')
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut()
  },

  /** The signed-in user with their profile and admin flag, or null when signed out. */
  async currentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) return null
    const [profile, isAdmin] = await Promise.all([
      supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle(),
      supabase.rpc('get_my_admin_status'),
    ])
    const row = profile.data as Pick<ProfileRow, 'display_name' | 'avatar_url'> | null
    return {
      id: user.id,
      email: user.email ?? '',
      name: row?.display_name ?? user.email ?? 'Thành viên',
      avatarUrl: row?.avatar_url ?? null,
      isAdmin: isAdmin.data === true,
    }
  },
}

// ---------------------------------------------------------------------------
// Writing and moderation (authors see their own content; admins see everything)
// ---------------------------------------------------------------------------

function toPostRow(body: PostInput) {
  return {
    title: body.title,
    excerpt: body.excerpt ?? null,
    content: body.content,
    cover_image_path: body.coverImagePath ?? null,
    status: body.status === 'PUBLISHED' ? 'published' : 'draft',
    category_id: body.categoryId,
    // An omitted slug keeps the stored one; on insert the database generates it from the title.
    ...(body.slug ? { slug: body.slug } : {}),
  }
}

async function setPostTags(postId: string, tagIds: string[]) {
  unwrap(await supabase.from('post_tags').delete().eq('post_id', postId))
  if (tagIds.length > 0) {
    unwrap(
      await supabase
        .from('post_tags')
        .insert(tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId }))),
    )
  }
}

export const adminApi = {
  /** `authorId` limits the list to one author; omit it (admins only) to list every post. */
  async posts({
    page = 1,
    status,
    authorId,
  }: {
    page?: number
    status?: PostStatus
    authorId?: string
  }) {
    let query = supabase.from('posts').select(ADMIN_POST, { count: 'exact' })
    if (authorId) query = query.eq('author_id', authorId)
    if (status) query = query.eq('status', status.toLowerCase())
    const result = await query.order('updated_at', { ascending: false }).range(...range(page))
    return toPage(result, page, toAdminPost)
  },

  async post(id: string): Promise<AdminPost> {
    const row = unwrap(
      await supabase.from('posts').select(ADMIN_POST).eq('id', id).maybeSingle(),
    ) as PostRow | null
    return row ? toAdminPost(row) : notFound()
  },

  async createPost(body: PostInput): Promise<AdminPost> {
    // The database sets author_id to the caller.
    const { id } = unwrap(
      await supabase.from('posts').insert(toPostRow(body)).select('id').single(),
    ) as { id: string }
    await setPostTags(id, body.tagIds)
    return adminApi.post(id)
  },

  // RLS hides rows the caller may not change, so "no row changed" means "not allowed" (D38).
  async updatePost(id: string, body: PostInput): Promise<AdminPost> {
    const before = unwrap(
      await supabase.from('posts').select('cover_image_path').eq('id', id).maybeSingle(),
    ) as { cover_image_path: string | null } | null
    const rows = unwrap(
      await supabase.from('posts').update(toPostRow(body)).eq('id', id).select('id'),
    ) as unknown[]
    if (rows.length === 0) throw new ApiError(403, 'Chỉ tác giả mới sửa được bài này.')
    if (before?.cover_image_path !== (body.coverImagePath ?? null)) {
      await removeImage(before?.cover_image_path)
    }
    await setPostTags(id, body.tagIds)
    return adminApi.post(id)
  },

  async deletePost(id: string): Promise<void> {
    const rows = unwrap(
      await supabase.from('posts').delete().eq('id', id).select('id, cover_image_path'),
    ) as { cover_image_path: string | null }[]
    if (rows.length === 0) throw new ApiError(403, 'Bạn không có quyền xoá bài này.')
    await removeImage(rows[0].cover_image_path)
  },

  async createTerm(kind: TermKind, name: string): Promise<Term> {
    return unwrap(await supabase.from(kind).insert({ name }).select(TERM).single()) as Term
  },

  async updateTerm(kind: TermKind, id: string, name: string): Promise<Term> {
    return unwrap(
      await supabase.from(kind).update({ name }).eq('id', id).select(TERM).single(),
    ) as Term
  },

  async deleteTerm(kind: TermKind, id: string): Promise<void> {
    unwrap(await supabase.from(kind).delete().eq('id', id))
  },

  /** `postAuthorId` limits the queue to comments on that author's posts. */
  async comments({
    page = 1,
    status,
    postAuthorId,
  }: {
    page?: number
    status?: CommentStatus
    postAuthorId?: string
  }) {
    let query = supabase.from('comments').select(ADMIN_COMMENT, { count: 'exact' })
    if (postAuthorId) query = query.eq('post.author_id', postAuthorId)
    if (status) query = query.eq('status', status.toLowerCase())
    const result = await query.order('created_at', { ascending: false }).range(...range(page))
    return toPage(result, page, toAdminComment)
  },

  async moderateComment(id: string, status: CommentStatus): Promise<AdminComment> {
    const row = unwrap(
      await supabase
        .from('comments')
        .update({ status: status.toLowerCase() })
        .eq('id', id)
        .select(ADMIN_COMMENT)
        .single(),
    ) as CommentRow
    return toAdminComment(row)
  },

  async deleteComment(id: string): Promise<void> {
    unwrap(await supabase.from('comments').delete().eq('id', id))
  },

  async stats(user: User): Promise<DashboardStats> {
    const mine = () =>
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', user.id)
    const [posts, drafts, sitePosts, members] = await Promise.all([
      count(mine()),
      count(mine().eq('status', 'draft')),
      user.isAdmin
        ? count(supabase.from('posts').select('id', { count: 'exact', head: true }))
        : Promise.resolve(0),
      user.isAdmin
        ? count(supabase.from('profiles').select('id', { count: 'exact', head: true }))
        : Promise.resolve(0),
    ])
    return {
      posts,
      drafts,
      site: user.isAdmin ? { posts: sitePosts, members } : null,
    }
  },

  /**
   * Compresses the image in the browser, then stores it as `<user_id>/<uuid>.<ext>`
   * in the public bucket (users may only write inside their own folder).
   */
  async upload(file: File): Promise<{ path: string; url: string }> {
    const [image, userId] = await Promise.all([prepareImage(file), currentUserId()])
    const path = `${userId}/${crypto.randomUUID()}.${image.extension}`
    const { error } = await supabase.storage.from(POST_IMAGES_BUCKET).upload(path, image.blob, {
      contentType: image.contentType,
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw new ApiError(400, `Tải ảnh thất bại: ${error.message}`)
    return { path, url: postImageUrl(path) }
  },
}
