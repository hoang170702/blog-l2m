import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { ChatMessage, DmThread, User } from '../../api/types'
import { App } from '../../App'
import { renderWithProviders } from '../../test/render'

const api = vi.hoisted(() => ({
  currentUser: vi.fn(),
  posts: vi.fn(),
  unreadNotifications: vi.fn(),
}))

vi.mock('../../api/endpoints', async () => ({
  chatApi: (await import('../../test/chat')).chatApiMock,
  publicApi: { posts: api.posts, unreadNotifications: api.unreadNotifications },
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

const me: User = {
  id: 'u1',
  email: 'me@x.y',
  name: 'Tôi',
  avatarUrl: null,
  isAdmin: false,
  suspended: false,
  bio: null,
  avatarPath: null,
  providerAvatarUrl: null,
}
const roomMessage: ChatMessage = {
  id: 'm1',
  threadId: null,
  userId: 'u2',
  content: 'Chào',
  masked: false,
  createdAt: '2026-11-25T10:00:00Z',
  author: { id: 'u2', name: 'Lan', avatarUrl: null },
}
const thread: DmThread = {
  id: 't1',
  peer: { id: 'u2', name: 'Lan', avatarUrl: null },
  lastMessageAt: '2026-11-25T09:00:00Z',
  unread: 2,
  blocked: false,
}

describe('ChatDock', () => {
  beforeEach(async () => {
    const { chatApiMock } = await import('../../test/chat')
    api.posts.mockResolvedValue({ items: [], page: 1, total: 0, limit: 10 })
    api.unreadNotifications.mockResolvedValue(0)
    chatApiMock.messages.mockResolvedValue([roomMessage])
    chatApiMock.inbox.mockResolvedValue([thread])
    localStorage.clear()
  })

  it('is absent for visitors', async () => {
    api.currentUser.mockResolvedValue(null)
    renderWithProviders(<App />)
    await screen.findByRole('link', { name: 'Đăng nhập' })
    expect(screen.queryByRole('button', { name: /khung chat/ })).toBeNull()
  })

  it('shows the unread total and opens the inbox with the thread', async () => {
    api.currentUser.mockResolvedValue(me)
    renderWithProviders(<App />)
    const button = await screen.findByRole('button', { name: /Mở khung chat/ })
    // 2 unread private + 1 room message from someone else with no read mark.
    await waitFor(() => expect(screen.getByTestId('chat-unread')).toHaveTextContent('3'))

    const user = userEvent.setup()
    await user.click(button)
    expect(await screen.findByRole('dialog', { name: 'Trò chuyện' })).toBeInTheDocument()
    expect(await screen.findByText('Chào')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Riêng/ }))
    expect(await screen.findByText('Lan')).toBeInTheDocument()
    // The tab badge and the thread row both show the two unread private messages.
    expect(screen.getAllByText('2')).toHaveLength(2)
  })
})
