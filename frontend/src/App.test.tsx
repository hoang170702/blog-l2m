import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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

vi.mock('./api/endpoints', async () => ({
  chatApi: (await import('./test/chat')).chatApiMock,
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
vi.mock('./lib/supabase', async () => ({
  RSS_URL: 'https://db.example/functions/v1/feed/rss.xml',
  supabase: {
    ...(await import('./test/chat')).realtimeMock,
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
  series: null,
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
    expect(await screen.findByText('1 phút đọc')).toBeInTheDocument()
    expect(screen.getByText('12 lượt xem')).toBeInTheDocument()
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

  it('shows the series position with previous and next parts', async () => {
    api.currentUser.mockResolvedValue(null)
    api.post.mockResolvedValue({
      ...post,
      series: {
        id: 's1',
        title: 'Học Postgres',
        slug: 'hoc-postgres',
        description: null,
        order: 2,
        parts: [
          { title: 'Cài đặt', slug: 'cai-dat', order: 1 },
          { title: 'Hello world', slug: 'hello-world', order: 2 },
          { title: 'Chỉ mục', slug: 'chi-muc', order: 3 },
        ],
      },
    })
    api.comments.mockResolvedValue([])
    api.related.mockResolvedValue([])
    api.recordView.mockResolvedValue(undefined)
    renderWithProviders(<App />, { route: '/posts/hello-world' })
    const nav = (await screen.findAllByRole('navigation', { name: 'Series Học Postgres' }))[0]
    expect(nav).toHaveTextContent('Phần 2/3')
    expect(within(nav).getByRole('link', { name: '← Phần trước' })).toHaveAttribute(
      'href',
      '/posts/cai-dat',
    )
    expect(within(nav).getByRole('link', { name: 'Phần sau →' })).toHaveAttribute(
      'href',
      '/posts/chi-muc',
    )
    expect(within(nav).getByRole('link', { name: 'Học Postgres' })).toHaveAttribute(
      'href',
      '/series/hoc-postgres',
    )
  })

  it('reads the post aloud with the device voice when the browser supports it', async () => {
    const spoken: { text: string }[] = []
    vi.stubGlobal('speechSynthesis', {
      speak: (u: { text: string }) => spoken.push(u),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [{ lang: 'vi-VN' }],
      addEventListener: vi.fn(),
    })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string
        constructor(text: string) {
          this.text = text
        }
      },
    )
    openPost()
    const user = userEvent.setup()
    const toggle = await screen.findByRole('button', { name: 'Nghe bài viết' })
    await user.click(toggle)
    const group = screen.getByRole('group', { name: 'Nghe bài viết' })
    await user.click(within(group).getByRole('button', { name: '▶ Nghe' }))
    // The short post is spoken as one utterance, title first.
    expect(spoken[0]?.text).toMatch(/^Hello world\. /)
    expect(within(group).getByRole('button', { name: '❚❚ Tạm dừng' })).toBeInTheDocument()
    expect(screen.queryByText(/không có giọng tiếng Việt/)).toBeNull()
    // Closing the panel hides it but keeps the reader playing.
    await user.click(toggle)
    expect(screen.queryByRole('group', { name: 'Nghe bài viết' })).toBeNull()
    await user.click(toggle)
    expect(
      within(screen.getByRole('group', { name: 'Nghe bài viết' })).getByRole('button', {
        name: '❚❚ Tạm dừng',
      }),
    ).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('keeps reading from the current paragraph when the rate changes', async () => {
    const spoken: {
      text: string
      rate: number
      onboundary: ((event: { charIndex: number }) => void) | null
    }[] = []
    vi.stubGlobal('speechSynthesis', {
      speak: (u: (typeof spoken)[number]) => spoken.push(u),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string
        rate = 1
        onboundary: ((event: { charIndex: number }) => void) | null = null
        constructor(text: string) {
          this.text = text
        }
      },
    )
    openPost()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Nghe bài viết' }))
    const group = screen.getByRole('group', { name: 'Nghe bài viết' })
    await user.click(within(group).getByRole('button', { name: '▶ Nghe' }))
    // The browser reports a word of the second paragraph.
    spoken[0].onboundary!({ charIndex: 'Hello world. '.length })
    expect(await within(group).findByText(/^Đoạn 2\//)).toBeInTheDocument()
    await user.selectOptions(within(group).getByRole('combobox', { name: 'Tốc độ' }), '1.5')
    await waitFor(() => expect(spoken.at(-1)?.rate).toBe(1.5))
    expect(spoken.at(-1)?.text).toBe(spoken[0].text.slice('Hello world. '.length))
    expect(within(group).getByRole('button', { name: '❚❚ Tạm dừng' })).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('lets the reader pick the paragraph to listen from', async () => {
    const spoken: { text: string }[] = []
    vi.stubGlobal('speechSynthesis', {
      speak: (u: { text: string }) => spoken.push(u),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string
        constructor(text: string) {
          this.text = text
        }
      },
    )
    openPost()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Nghe bài viết' }))
    const group = screen.getByRole('group', { name: 'Nghe bài viết' })
    const slider = await within(group).findByRole('slider', { name: 'Đoạn đang nghe' })
    const last = Number(slider.getAttribute('max'))
    fireEvent.change(slider, { target: { value: '1' } })
    expect(within(group).getByText(`Đoạn 2/${last + 1}`)).toBeInTheDocument()
    await user.click(within(group).getByRole('button', { name: '▶ Nghe' }))
    const second = spoken[0].text
    expect(second).not.toBe('Hello world')
    // Seeking while reading jumps straight there.
    fireEvent.change(slider, { target: { value: String(last) } })
    expect(spoken.at(-1)?.text).not.toBe(second)
    expect(within(group).getByText(`Đoạn ${last + 1}/${last + 1}`)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('lists the device voices and reads with the one the reader picks', async () => {
    const spoken: { text: string; voice?: unknown }[] = []
    const english = { lang: 'en-US', name: 'Alex', voiceURI: 'en' }
    vi.stubGlobal('speechSynthesis', {
      speak: (u: { text: string }) => spoken.push(u),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [english, { lang: 'vi-VN', name: 'Linh', voiceURI: 'vi' }],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string
        voice: unknown = null
        constructor(text: string) {
          this.text = text
        }
      },
    )
    openPost()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Nghe bài viết' }))
    const group = screen.getByRole('group', { name: 'Nghe bài viết' })
    const picker = within(group).getByRole('combobox', { name: 'Giọng' })
    expect(
      within(picker)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Tự động (tiếng Việt nếu có)', 'Linh (vi-VN)', 'Alex (en-US)'])
    await user.selectOptions(picker, 'en')
    await user.click(within(group).getByRole('button', { name: '▶ Nghe' }))
    expect(spoken[0]?.voice).toBe(english)
    expect(localStorage.getItem('read-aloud-voice')).toBe('en')
    localStorage.removeItem('read-aloud-voice')
    vi.unstubAllGlobals()
  })

  it('hides the read-aloud control when the browser has no speech synthesis', async () => {
    openPost()
    expect(await screen.findByRole('heading', { name: 'Hello world' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Nghe bài viết' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Nghe bài viết' })).toBeNull()
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
