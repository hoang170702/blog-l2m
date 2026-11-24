import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { vi } from 'vitest'
import type { Page, PostSummary } from '../api/types'
import { renderWithProviders } from '../test/render'
import { HomePage } from './HomePage'

const posts = vi.fn<(filters: { author?: string }) => Promise<Page<PostSummary>>>()
const author = vi.fn()

vi.mock('../api/endpoints', () => ({
  publicApi: {
    posts: (filters: { author?: string }) => posts(filters),
    author: (id: string) => author(id),
  },
  authApi: { currentUser: () => Promise.resolve(null) },
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}))

const lan = { id: '22222222-2222-4222-8222-222222222222', name: 'Lan', avatarUrl: null }
const post: PostSummary = {
  id: '1',
  title: 'Bài của Lan',
  slug: 'bai-cua-lan',
  excerpt: null,
  coverImageUrl: null,
  publishedAt: '2026-11-23T00:00:00.000Z',
  category: null,
  tags: [],
  author: lan,
  views: 0,
  likes: 0,
}

function renderAuthorPage(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/u/:id" element={<HomePage mode="author" />} />
    </Routes>,
    { route: `/u/${id}` },
  )
}

describe('author page (D41)', () => {
  it("shows the author's card and lists only their posts", async () => {
    author.mockResolvedValue(lan)
    posts.mockResolvedValue({ items: [post], total: 1, page: 1, limit: 10 })
    renderAuthorPage(lan.id)

    expect(await screen.findByRole('heading', { name: 'Lan' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Bài của Lan' })).toHaveAttribute(
      'href',
      '/posts/bai-cua-lan',
    )
    expect(screen.getByRole('link', { name: '· Lan' })).toHaveAttribute('href', `/u/${lan.id}`)
    expect(posts).toHaveBeenCalledWith(expect.objectContaining({ author: lan.id }))
  })

  it('says so when the author does not exist', async () => {
    author.mockResolvedValue(null)
    posts.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 })
    renderAuthorPage('not-a-user')

    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy tác giả' }),
    ).toBeInTheDocument()
  })
})
