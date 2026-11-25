import { screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import type { Notification, User } from '../../api/types'
import { App } from '../../App'
import { renderWithProviders } from '../../test/render'

const api = vi.hoisted(() => ({
  currentUser: vi.fn(),
  posts: vi.fn(),
  unreadNotifications: vi.fn(),
  notifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  stats: vi.fn(),
}))

vi.mock('../../api/endpoints', async () => ({
  chatApi: (await import('../../test/chat')).chatApiMock,
  publicApi: {
    posts: api.posts,
    unreadNotifications: api.unreadNotifications,
    notifications: api.notifications,
    markNotificationsRead: api.markNotificationsRead,
  },
  adminApi: { stats: api.stats, posts: api.posts },
  authApi: { currentUser: api.currentUser },
}))
vi.mock('../../lib/supabase', async () => ({
  RSS_URL: 'https://db.example/feed/rss.xml',
  supabase: {
    ...(await import('../../test/chat')).realtimeMock,
    auth: {
      onAuthStateChange: (callback: (event: string) => void) => {
        setTimeout(() => callback('INITIAL_SESSION'), 0)
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  },
}))

const user: User = {
  id: 'u1',
  email: 'a@b.c',
  name: 'An',
  avatarUrl: null,
  isAdmin: false,
  suspended: false,
  bio: null,
  avatarPath: null,
  providerAvatarUrl: null,
}
const items: Notification[] = [
  {
    id: 'n1',
    kind: 'comment',
    actorName: 'Lan',
    post: { title: 'Hello', slug: 'hello' },
    createdAt: '2026-11-25T01:00:00.000Z',
    readAt: null,
  },
  {
    id: 'n2',
    kind: 'new_post',
    actorName: 'Minh',
    post: { title: 'Bài mới', slug: 'bai-moi' },
    createdAt: '2026-11-25T00:00:00.000Z',
    readAt: '2026-11-25T00:30:00.000Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.currentUser.mockResolvedValue(user)
  api.posts.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 })
})

describe('notifications (D44)', () => {
  it('shows the unread count on the account button', async () => {
    api.unreadNotifications.mockResolvedValue(3)
    renderWithProviders(<App />)
    expect(
      await screen.findByRole('button', { name: 'Tài khoản, 3 thông báo mới' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('unread-dot')).toHaveTextContent('3')
  })

  it('shows no dot when everything is read', async () => {
    api.unreadNotifications.mockResolvedValue(0)
    renderWithProviders(<App />)
    expect(await screen.findByRole('button', { name: 'Tài khoản' })).toBeInTheDocument()
    expect(screen.queryByTestId('unread-dot')).toBeNull()
  })

  it('lists notifications with a sentence per kind and marks them read', async () => {
    api.unreadNotifications.mockResolvedValue(1)
    api.notifications.mockResolvedValue(items)
    api.markNotificationsRead.mockResolvedValue(undefined)
    renderWithProviders(<App />, { route: '/dashboard/notifications' })
    expect(
      await screen.findByRole('link', { name: 'Lan đã bình luận bài “Hello”' }),
    ).toHaveAttribute('href', '/posts/hello')
    expect(
      screen.getByRole('link', { name: 'Minh đã đăng bài mới: “Bài mới”' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalledTimes(1))
  })
})
