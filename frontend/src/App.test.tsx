import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { App } from './App'
import type { Comment, PostDetail, PostSummary, User } from './api/types'
import { renderWithProviders } from './test/render'

const api = vi.hoisted(() => ({
  currentUser: vi.fn(),
  posts: vi.fn(),
  post: vi.fn(),
  comments: vi.fn(),
  submitComment: vi.fn(),
  related: vi.fn(),
  recordView: vi.fn(),
  liked: vi.fn(),
  bookmarked: vi.fn(),
  setBookmarked: vi.fn(),
  deletePost: vi.fn(),
}))

vi.mock('./api/endpoints', () => ({
  publicApi: {
    posts: api.posts,
    post: api.post,
    comments: api.comments,
    submitComment: api.submitComment,
    related: api.related,
    recordView: api.recordView,
    liked: api.liked,
    bookmarked: api.bookmarked,
    setBookmarked: api.setBookmarked,
  },
  adminApi: { deletePost: api.deletePost },
  authApi: { currentUser: api.currentUser },
}))
vi.mock('./lib/supabase', () => ({
  RSS_URL: 'https://db.example/functions/v1/feed/rss.xml',
  supabase: {
    auth: {
      // Like supabase-js: the stored session is reported once on start.
      onAuthStateChange: (callback: (event: string) => void) => {
        setTimeout(() => callback('INITIAL_SESSION'), 0)
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  },
}))

const author = { id: '22222222-2222-4222-8222-222222222222', name: 'Lan', avatarUrl: null }
const summary: PostSummary = {
  id: 'p1',
  title: 'Hello world',
  slug: 'hello-world',
  excerpt: 'First post',
  coverImageUrl: null,
  publishedAt: '2026-11-23T00:00:00.000Z',
  category: { id: 'c', name: 'General', slug: 'general' },
  tags: [{ id: 't', name: 'Intro', slug: 'intro' }],
  author,
  views: 12,
  likes: 3,
}
const post: PostDetail = {
  ...summary,
  content: '## Mở đầu\n\nXin chào\n\n## Kết luận\n\nHết',
  hiddenAt: null,
}
const comment: Comment = {
  id: 'c1',
  parentId: null,
  masked: false,
  clientHint: null,
  authorName: 'Ann',
  content: 'Bài hay',
  createdAt: '2026-11-23T01:00:00.000Z',
}
const member = (overrides: Partial<User> = {}): User => ({
  id: '33333333-3333-4333-8333-333333333333',
  email: 'reader@test.local',
  name: 'Reader',
  avatarUrl: null,
  isAdmin: false,
  suspended: false,
  bio: null,
  avatarPath: null,
  providerAvatarUrl: null,
  ...overrides,
})

function openPost(user: User | null = null) {
  api.currentUser.mockResolvedValue(user)
  api.post.mockResolvedValue(post)
  api.comments.mockResolvedValue([comment])
  api.related.mockResolvedValue([])
  api.recordView.mockResolvedValue(undefined)
  api.liked.mockResolvedValue(false)
  api.bookmarked.mockResolvedValue(false)
  renderWithProviders(<App />, { route: '/posts/hello-world' })
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('App', () => {
  it('lists published posts on the home page', async () => {
    api.currentUser.mockResolvedValue(null)
    api.posts.mockResolvedValue({ items: [summary], total: 1, page: 1, limit: 10 })
    renderWithProviders(<App />)
    expect(await screen.findByRole('link', { name: 'Hello world' })).toHaveAttribute(
      'href',
      '/posts/hello-world',
    )
    expect(screen.getByText('First post')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '#Intro' })).toHaveAttribute('href', '/tag/intro')
    expect(screen.getByRole('link', { name: 'RSS' })).toHaveAttribute(
      'href',
      'https://db.example/functions/v1/feed/rss.xml',
    )
  })

  it('sends signed-out visitors from the dashboard to the login page', async () => {
    api.currentUser.mockResolvedValue(null)
    renderWithProviders(<App />, { route: '/admin/posts' })
    expect(
      await screen.findByRole('heading', { name: 'Đăng nhập hoặc đăng ký' }),
    ).toBeInTheDocument()
  })

  it('shows reading time, views, a table of contents and counts the view once', async () => {
    openPost()
    expect(await screen.findByText('· 1 phút đọc')).toBeInTheDocument()
    expect(screen.getByText('· 12 lượt xem')).toBeInTheDocument()
    const toc = await screen.findByRole('navigation', { name: 'Mục lục' })
    expect(within(toc).getByRole('link', { name: 'Kết luận' })).toHaveAttribute(
      'href',
      '#h-ket-luan',
    )
    expect(api.recordView).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('viewed:hello-world')).toBe('1')
  })

  it('posts a reply under the comment it answers', async () => {
    api.submitComment.mockResolvedValue({ id: 'c2', status: 'APPROVED' })
    openPost()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Trả lời' }))
    const form = screen.getByRole('heading', { name: 'Trả lời Ann' }).closest('form')!
    await user.type(within(form).getByLabelText('Tên của bạn'), 'Lan')
    await user.type(within(form).getByLabelText('Nội dung bình luận'), 'Cảm ơn')
    await user.click(within(form).getByRole('button', { name: 'Gửi trả lời' }))

    await waitFor(() =>
      expect(api.submitComment).toHaveBeenCalledWith('hello-world', {
        authorName: 'Lan',
        content: 'Cảm ơn',
        parentId: 'c1',
      }),
    )
  })

  it('warns under a comment whose words were masked and shows the partial address', async () => {
    api.currentUser.mockResolvedValue(null)
    api.post.mockResolvedValue(post)
    api.comments.mockResolvedValue([
      comment,
      {
        ...comment,
        id: 'c9',
        authorName: 'Bob',
        content: 'Bài này *** quá',
        masked: true,
        clientHint: '113.161.*.*',
      },
    ])
    api.related.mockResolvedValue([])
    api.recordView.mockResolvedValue(undefined)
    renderWithProviders(<App />, { route: '/posts/hello-world' })
    const warning = await screen.findByText(/đã che từ ngữ không phù hợp/)
    expect(warning).toHaveTextContent('IP 113.161.*.*')
    expect(screen.getAllByText(/đã che từ ngữ/)).toHaveLength(1)
  })

  it('tells a blocked commenter why the comment was refused', async () => {
    const { ApiError } = await import('./api/client')
    api.submitComment.mockRejectedValue(new ApiError(403, 'Địa chỉ của bạn đã bị chặn bình luận.'))
    openPost()
    const user = userEvent.setup()
    const form = (await screen.findByRole('heading', { name: 'Để lại bình luận' })).closest('form')!
    await user.type(within(form).getByLabelText('Tên của bạn'), 'Bob')
    await user.type(within(form).getByLabelText('Nội dung bình luận'), 'again')
    await user.click(within(form).getByRole('button', { name: 'Gửi bình luận' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Địa chỉ của bạn đã bị chặn bình luận.',
    )
  })

  it('offers delete to an admin but not to other members', async () => {
    openPost(member())
    // The like button only appears once the signed-in member has loaded.
    expect(await screen.findByRole('button', { name: /lượt thích/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xoá bài' })).not.toBeInTheDocument()
  })

  it('lets an admin delete the post from its page', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.deletePost.mockResolvedValue(undefined)
    api.posts.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 })
    openPost(member({ isAdmin: true }))
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Xoá bài' }))
    await waitFor(() => expect(api.deletePost).toHaveBeenCalledWith('p1'))
  })

  it('sends signed-out readers to login from the bookmark button', async () => {
    openPost()
    expect(await screen.findByRole('link', { name: '🔖 Lưu' })).toHaveAttribute('href', '/login')
  })

  it('lets a member bookmark the post', async () => {
    api.setBookmarked.mockResolvedValue(undefined)
    openPost(member())
    const button = await screen.findByRole('button', { name: '🔖 Lưu' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.setup().click(button)
    await waitFor(() => expect(api.setBookmarked).toHaveBeenCalledWith('p1', true))
    expect(await screen.findByRole('button', { name: '🔖 Đã lưu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('tells the author when an admin hid the post', async () => {
    api.currentUser.mockResolvedValue(member())
    api.post.mockResolvedValue({ ...post, hiddenAt: '2026-11-25T03:00:00.000Z' })
    api.comments.mockResolvedValue([])
    api.related.mockResolvedValue([])
    api.recordView.mockResolvedValue(undefined)
    api.liked.mockResolvedValue(false)
    api.bookmarked.mockResolvedValue(false)
    renderWithProviders(<App />, { route: '/posts/hello-world' })
    expect(await screen.findByText(/đã bị ẩn bởi quản trị viên/)).toBeInTheDocument()
  })

  it('shows the 404 page for an unknown post', async () => {
    const { ApiError } = await import('./api/client')
    api.currentUser.mockResolvedValue(null)
    api.post.mockRejectedValue(new ApiError(404, 'Không tìm thấy.'))
    api.comments.mockResolvedValue([])
    renderWithProviders(<App />, { route: '/posts/missing' })
    expect(await screen.findByRole('heading', { name: '404' })).toBeInTheDocument()
  })
})
