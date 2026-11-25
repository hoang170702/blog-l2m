import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { vi } from 'vitest'
import type { Page, PostSummary, User } from '../api/types'
import { renderWithProviders } from '../test/render'
import { HomePage } from './HomePage'

const api = vi.hoisted(() => ({
  posts: vi.fn<(filters: { following?: boolean }) => Promise<Page<PostSummary>>>(),
  author: vi.fn(),
  following: vi.fn(),
  setFollowing: vi.fn(),
  currentUser: vi.fn(),
}))

vi.mock('../api/endpoints', async () => ({
  chatApi: (await import('../test/chat')).chatApiMock,
  publicApi: {
    posts: api.posts,
    author: api.author,
    following: api.following,
    setFollowing: api.setFollowing,
  },
  authApi: { currentUser: api.currentUser },
}))
vi.mock('../lib/supabase', async () => ({
  supabase: {
    ...(await import('../test/chat')).realtimeMock,
    auth: {
      onAuthStateChange: (callback: (event: string) => void) => {
        setTimeout(() => callback('INITIAL_SESSION'), 0)
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  },
}))

const reader: User = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'r@test.local',
  name: 'Reader',
  avatarUrl: null,
  isAdmin: false,
  suspended: false,
  bio: null,
  avatarPath: null,
  providerAvatarUrl: null,
}
const lan = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Lan',
  avatarUrl: null,
  followers: 2,
}
const empty: Page<PostSummary> = { items: [], total: 0, page: 1, limit: 10 }

beforeEach(() => vi.clearAllMocks())

describe('follows (D43)', () => {
  it('lets a reader follow an author from the author page', async () => {
    api.currentUser.mockResolvedValue(reader)
    api.author.mockResolvedValue(lan)
    api.posts.mockResolvedValue(empty)
    api.following.mockResolvedValue(false)
    api.setFollowing.mockResolvedValue(undefined)
    renderWithProviders(
      <Routes>
        <Route path="/u/:id" element={<HomePage mode="author" />} />
      </Routes>,
      { route: `/u/${lan.id}` },
    )
    expect(await screen.findByText(/2 người theo dõi/)).toBeInTheDocument()
    const button = await screen.findByRole('button', { name: '+ Theo dõi' })
    await userEvent.setup().click(button)
    await waitFor(() => expect(api.setFollowing).toHaveBeenCalledWith(lan.id, true))
    expect(await screen.findByRole('button', { name: '✓ Đang theo dõi' })).toBeInTheDocument()
  })

  it('hides the follow button on your own page', async () => {
    api.currentUser.mockResolvedValue(reader)
    api.author.mockResolvedValue({ ...lan, id: reader.id, name: 'Reader' })
    api.posts.mockResolvedValue(empty)
    renderWithProviders(
      <Routes>
        <Route path="/u/:id" element={<HomePage mode="author" />} />
      </Routes>,
      { route: `/u/${reader.id}` },
    )
    expect(await screen.findByRole('heading', { name: 'Reader' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Theo dõi/ })).toBeNull()
  })

  it('asks for only followed authors on /following and explains an empty list', async () => {
    api.currentUser.mockResolvedValue(reader)
    api.posts.mockResolvedValue(empty)
    renderWithProviders(
      <Routes>
        <Route path="/following" element={<HomePage mode="following" />} />
      </Routes>,
      { route: '/following' },
    )
    expect(await screen.findByText(/Bạn chưa theo dõi ai/)).toBeInTheDocument()
    expect(api.posts).toHaveBeenCalledWith(expect.objectContaining({ following: true }))
  })
})
