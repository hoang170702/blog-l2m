/**
 * Data layer on supabase-js. Access rules live in the database (RLS, grants, RPCs in
 * supabase/migrations); these functions only shape queries and map rows to UI types.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { foldVi } from '../lib/fold'
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
  Member,
  OAuthProvider,
  Page,
  PostDetail,
  PostInput,
  PostStatus,
  PostSummary,
  ProfileInput,
  Report,
  ReportStatus,
  ReportTarget,
  Term,
  User,
} from './types'

export type TermKind = 'categories' | 'tags'

const PAGE_SIZE = 10
// admin_list_users pages by 20 (supabase/migrations/20261124090100_community_safety.sql).
const MEMBERS_PAGE_SIZE = 20
// Ids go straight into filters; a malformed one would make PostgREST answer 400 instead of "not found".
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  stats: { view_count: number; like_count: number } | null
  author_id: string | null
  content: string
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}

interface CommentRow {
  id: string
  parent_id: string | null
  author_name: string
  content: string
  created_at: string
  status: 'approved' | 'rejected'
  post_id: string
  post: { title: string; slug: string } | null
}

const TERM = 'id, name, slug'
const AUTHOR = 'author:profiles!posts_author_profile_fkey(id, display_name, avatar_url)'
const STATS = 'stats:post_stats(view_count, like_count)'
const SUMMARY = `id, title, slug, excerpt, cover_image_path, published_at, author_id, category:categories(${TERM}), post_tags(tag:tags(${TERM})), ${AUTHOR}, ${STATS}`
const DETAIL = `${SUMMARY}, content`
const ADMIN_POST = `${DETAIL}, status, created_at, updated_at`
// `post` is an inner join so authors can filter the moderation queue to their own posts.
const ADMIN_COMMENT =
  'id, parent_id, author_name, content, status, created_at, post_id, post:posts!inner(title, slug, author_id)'
const REPORT =
  'id, reason, status, created_at, post:posts(id, title, slug), comment:comments(id, content, author_name, status, post:posts(title, slug))'

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
    views: Number(row.stats?.view_count ?? 0),
    likes: Number(row.stats?.like_count ?? 0),
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

type PublicCommentRow = Pick<
  CommentRow,
  'id' | 'parent_id' | 'author_name' | 'content' | 'created_at'
>

function toComment(row: PublicCommentRow): Comment {
  return {
    id: row.id,
    parentId: row.parent_id,
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

interface ReportRow {
  id: string
  reason: string
  status: 'open' | 'resolved' | 'dismissed'
  created_at: string
  post: { id: string; title: string; slug: string } | null
  comment: {
    id: string
    content: string
    author_name: string
    status: 'approved' | 'rejected'
    post: { title: string; slug: string } | null
  } | null
}

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    reason: row.reason,
    status: row.status.toUpperCase() as ReportStatus,
    createdAt: row.created_at,
    post: row.post,
    comment: row.comment && {
      id: row.comment.id,
      content: row.comment.content,
      authorName: row.comment.author_name,
      status: row.comment.status.toUpperCase() as CommentStatus,
      post: row.comment.post,
    },
  }
}

const now = () => new Date().toISOString()

// Margin for a browser clock that runs behind the database's: without it, a post published a
// moment ago (published_at = server time) would be filtered out of the lists.
const CLOCK_SKEW_MS = 5 * 60_000

/**
 * RLS already hides scheduled posts from visitors and other members; only a signed-in author
 * (or an admin) can read posts scheduled for later, so only then do public lists filter by time.
 */
async function scheduledCutoff(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session ? new Date(Date.now() + CLOCK_SKEW_MS).toISOString() : null
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
    author,
    q,
  }: {
    page?: number
    category?: string
    tag?: string
    /** Profile id: only this author's posts (D41). */
    author?: string
    q?: string
  }): Promise<Page<PostSummary>> {
    const empty: Page<PostSummary> = { items: [], total: 0, page, limit: PAGE_SIZE }
    if (author !== undefined && !UUID.test(author)) return empty
    // Signed-in users can also read their own drafts through RLS, so public pages filter on status.
    let query = supabase.from('posts').select(SUMMARY, { count: 'exact' }).eq('status', 'published')
    const cutoff = await scheduledCutoff()
    if (cutoff) query = query.lte('published_at', cutoff)

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
    if (author) query = query.eq('author_id', author)
    // Title, excerpt and content, ignoring case and accents (D40).
    if (q?.trim()) query = query.ilike('search_text', `%${escapeLike(foldVi(q.trim()))}%`)

    const result = await query.order('published_at', { ascending: false }).range(...range(page))
    return toPage(result, page, toSummary)
  },

  /** Public author card for `/u/:id`; null for an unknown or malformed id. */
  async author(id: string): Promise<Author | null> {
    if (!UUID.test(id)) return null
    const row = unwrap(
      await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', id)
        .maybeSingle(),
    ) as ProfileRow | null
    return toAuthor(row)
  },

  async post(slug: string): Promise<PostDetail> {
    const row = unwrap(
      await supabase
        .from('posts')
        .select(DETAIL)
        .eq('slug', slug)
        .eq('status', 'published')
        // No time filter: RLS hides scheduled posts except from their author and admins, who
        // may preview them; a client-side clock check would 404 a post published a moment ago.
        .maybeSingle(),
    ) as PostRow | null
    return row ? toDetail(row) : notFound()
  },

  /** Up to three newer posts sharing the category or a tag, newest first. */
  async related(post: PostDetail): Promise<PostSummary[]> {
    const filters: string[] = []
    if (post.category) filters.push(`category_id.eq.${post.category.id}`)
    if (post.tags.length > 0) {
      const links = unwrap(
        await supabase
          .from('post_tags')
          .select('post_id')
          .in(
            'tag_id',
            post.tags.map((tag) => tag.id),
          )
          .limit(200),
      ) as { post_id: string }[]
      const ids = [...new Set(links.map((link) => link.post_id))].filter((id) => id !== post.id)
      if (ids.length > 0) filters.push(`id.in.(${ids.join(',')})`)
    }
    if (filters.length === 0) return []
    let query = supabase.from('posts').select(SUMMARY).eq('status', 'published')
    const cutoff = await scheduledCutoff()
    if (cutoff) query = query.lte('published_at', cutoff)
    const rows = unwrap(
      await query
        .neq('id', post.id)
        .or(filters.join(','))
        .order('published_at', { ascending: false })
        .limit(3),
    ) as unknown as PostRow[]
    return rows.map(toSummary)
  },

  /** Counted at most once per visitor address, post and hour by the database. */
  async recordView(slug: string): Promise<void> {
    unwrap(await supabase.rpc('record_post_view', { p_post_slug: slug }))
  },

  async liked(postId: string): Promise<boolean> {
    const rows = unwrap(
      await supabase.from('post_likes').select('post_id').eq('post_id', postId),
    ) as unknown[]
    return rows.length > 0
  },

  async setLiked(postId: string, liked: boolean): Promise<void> {
    if (liked) unwrap(await supabase.from('post_likes').insert({ post_id: postId }))
    else unwrap(await supabase.from('post_likes').delete().eq('post_id', postId))
  },

  async report(target: ReportTarget, reason: string): Promise<void> {
    unwrap(
      await supabase.rpc('report_content', {
        p_post_id: 'postId' in target ? target.postId : null,
        p_comment_id: 'commentId' in target ? target.commentId : null,
        p_reason: reason,
      }),
    )
  },

  async comments(slug: string): Promise<Comment[]> {
    const rows = unwrap(
      await supabase
        .from('comments')
        .select('id, parent_id, author_name, content, created_at, posts!inner(slug)')
        .eq('posts.slug', slug)
        .eq('status', 'approved')
        .order('created_at', { ascending: true }),
    ) as PublicCommentRow[]
    return rows.map(toComment)
  },

  async submitComment(
    slug: string,
    body: { authorName: string; content: string; parentId?: string },
  ): Promise<{ id: string; status: CommentStatus }> {
    const id = unwrap(
      await supabase.rpc('submit_comment', {
        p_post_slug: slug,
        p_author_name: body.authorName,
        p_content: body.content,
        p_parent_id: body.parentId ?? null,
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
      options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback` },
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
    const [profile, isAdmin, suspended] = await Promise.all([
      supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle(),
      supabase.rpc('get_my_admin_status'),
      supabase.rpc('get_my_suspension_status'),
    ])
    const row = profile.data as Pick<ProfileRow, 'display_name' | 'avatar_url'> | null
    return {
      id: user.id,
      email: user.email ?? '',
      name: row?.display_name ?? user.email ?? 'Thành viên',
      avatarUrl: row?.avatar_url ?? null,
      isAdmin: isAdmin.data === true,
      suspended: suspended.data === true,
    }
  },

  async updateProfile(userId: string, body: ProfileInput): Promise<void> {
    const rows = unwrap(
      await supabase
        .from('profiles')
        .update({ display_name: body.name, avatar_url: body.avatarUrl })
        .eq('id', userId)
        .select('id'),
    ) as unknown[]
    if (rows.length === 0) throw new ApiError(403, 'Bạn không có quyền sửa hồ sơ này.')
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
    // null lets the database stamp the publish time; omitted keeps the stored one.
    ...(body.publishedAt !== undefined ? { published_at: body.publishedAt } : {}),
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
    const [posts, drafts, sitePosts, members, openReports] = await Promise.all([
      count(mine()),
      count(mine().eq('status', 'draft')),
      user.isAdmin
        ? count(supabase.from('posts').select('id', { count: 'exact', head: true }))
        : Promise.resolve(0),
      user.isAdmin
        ? count(supabase.from('profiles').select('id', { count: 'exact', head: true }))
        : Promise.resolve(0),
      user.isAdmin
        ? count(
            supabase
              .from('reports')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'open'),
          )
        : Promise.resolve(0),
    ])
    return {
      posts,
      drafts,
      site: user.isAdmin ? { posts: sitePosts, members, openReports } : null,
    }
  },

  async reports({ page = 1, status }: { page?: number; status?: ReportStatus }) {
    let query = supabase.from('reports').select(REPORT, { count: 'exact' })
    if (status) query = query.eq('status', status.toLowerCase())
    const result = await query.order('created_at', { ascending: false }).range(...range(page))
    return toPage(result, page, toReport)
  },

  async setReportStatus(id: string, status: ReportStatus): Promise<void> {
    const open = status === 'OPEN'
    unwrap(
      await supabase
        .from('reports')
        .update({
          status: status.toLowerCase(),
          resolved_at: open ? null : now(),
          resolved_by: open ? null : await currentUserId(),
        })
        .eq('id', id),
    )
  },

  async members({ page = 1, q }: { page?: number; q?: string }): Promise<Page<Member>> {
    const rows = unwrap(
      await supabase.rpc('admin_list_users', { p_query: q?.trim() || null, p_page: page }),
    ) as {
      id: string
      display_name: string
      avatar_url: string | null
      email: string | null
      created_at: string
      post_count: number
      is_admin: boolean
      suspended_at: string | null
      suspended_reason: string | null
      total: number
    }[]
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.display_name,
        avatarUrl: row.avatar_url,
        email: row.email ?? '',
        createdAt: row.created_at,
        postCount: Number(row.post_count),
        isAdmin: row.is_admin,
        suspendedAt: row.suspended_at,
        suspendedReason: row.suspended_reason,
      })),
      total: Number(rows[0]?.total ?? 0),
      page,
      limit: MEMBERS_PAGE_SIZE,
    }
  },

  async setSuspended(userId: string, suspended: boolean, reason?: string): Promise<void> {
    unwrap(
      await supabase.rpc('admin_set_suspended', {
        p_user: userId,
        p_suspended: suspended,
        p_reason: reason ?? null,
      }),
    )
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
