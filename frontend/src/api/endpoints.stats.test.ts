import type { User } from './types'

// Same fake Supabase client as endpoints.cover.test.ts: queued responses, one per awaited query.
const responses: { data: unknown; error: null; count: number | null }[] = []

vi.mock('../lib/supabase', () => {
  const builder = (): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === 'then'
            ? (resolve: (value: unknown) => void) => resolve(responses.shift())
            : () => builder(),
      },
    )
  return {
    POST_IMAGES_BUCKET: 'post-images',
    postImageUrl: (path: string) => `https://cdn.test/${path}`,
    supabase: { from: () => builder(), storage: { from: () => ({}) } },
  }
})

const { adminApi } = await import('./endpoints')

const reply = (data: unknown, count: number | null = null) =>
  responses.push({ data, error: null, count })

const user: User = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  avatarUrl: null,
  isAdmin: false,
  suspended: false,
  bio: null,
  avatarPath: null,
  providerAvatarUrl: null,
}

beforeEach(() => {
  responses.length = 0
})

describe('per-post stats (D48)', () => {
  it('maps the embedded comment count of an admin post', async () => {
    reply({
      id: 'p1',
      title: 'T',
      slug: 't',
      excerpt: null,
      content: 'x',
      cover_image_path: null,
      published_at: null,
      author_id: 'u1',
      status: 'published',
      created_at: '2026-11-23T00:00:00Z',
      updated_at: '2026-11-23T00:00:00Z',
      category: null,
      post_tags: [],
      author: null,
      stats: { view_count: 12, like_count: 3 },
      comments: [{ count: 4 }],
    })
    const post = await adminApi.post('p1')
    expect(post).toMatchObject({ views: 12, likes: 3, comments: 4 })
  })

  it('sums views and likes over the user posts for the dashboard', async () => {
    reply(null, 5) // posts
    reply(null, 2) // drafts
    reply([
      { view_count: 10, like_count: 1 },
      { view_count: 7, like_count: 2 },
    ])
    const stats = await adminApi.stats(user)
    expect(stats).toEqual({ posts: 5, drafts: 2, views: 17, likes: 3, site: null })
  })
})
