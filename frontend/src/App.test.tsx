import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { App } from './App'
import type { Page, PostSummary } from './api/types'
import { server } from './test/server'
import { renderWithProviders } from './test/render'

const post: PostSummary = {
  id: '1',
  title: 'Hello world',
  slug: 'hello-world',
  excerpt: 'First post',
  coverImageUrl: null,
  publishedAt: '2026-11-23T00:00:00.000Z',
  category: { id: 'c', name: 'General', slug: 'general' },
  tags: [{ id: 't', name: 'Intro', slug: 'intro' }],
  author: null,
}

function noSession() {
  server.use(http.post('*/api/auth/refresh', () => new HttpResponse(null, { status: 401 })))
}

describe('App', () => {
  it('lists published posts on the home page', async () => {
    noSession()
    server.use(
      http.get('*/api/posts', () =>
        HttpResponse.json<Page<PostSummary>>({ items: [post], total: 1, page: 1, limit: 10 }),
      ),
    )
    renderWithProviders(<App />)
    expect(await screen.findByRole('link', { name: 'Hello world' })).toHaveAttribute(
      'href',
      '/posts/hello-world',
    )
    expect(screen.getByText('First post')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '#Intro' })).toHaveAttribute('href', '/tag/intro')
  })

  it('redirects admin pages to login without a session', async () => {
    noSession()
    renderWithProviders(<App />, { route: '/admin/posts' })
    expect(await screen.findByRole('heading', { name: 'Đăng nhập quản trị' })).toBeInTheDocument()
  })

  it('submits a comment and confirms it is posted', async () => {
    noSession()
    let submitted: unknown
    server.use(
      http.get('*/api/posts/hello-world', () => HttpResponse.json({ ...post, content: '# Hi' })),
      http.get('*/api/posts/hello-world/comments', () => HttpResponse.json([])),
      http.post('*/api/posts/hello-world/comments', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({ id: 'x', status: 'APPROVED' }, { status: 201 })
      }),
    )
    renderWithProviders(<App />, { route: '/posts/hello-world' })

    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Tên của bạn'), 'Lan')
    await user.type(screen.getByLabelText('Nội dung bình luận'), 'Hay quá')
    await user.click(screen.getByRole('button', { name: 'Gửi bình luận' }))

    expect(await screen.findByText(/đã được đăng/)).toBeInTheDocument()
    expect(submitted).toEqual({ authorName: 'Lan', content: 'Hay quá' })
  })

  it('shows the 404 page for an unknown post', async () => {
    noSession()
    server.use(
      http.get('*/api/posts/missing', () =>
        HttpResponse.json({ message: 'Post not found' }, { status: 404 }),
      ),
    )
    renderWithProviders(<App />, { route: '/posts/missing' })
    await waitFor(() => expect(screen.getByText('404')).toBeInTheDocument())
  })
})
