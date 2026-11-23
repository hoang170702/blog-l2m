import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PostInput } from './types'

// A fake Supabase client: every query builder call chains, and each awaited query takes the
// next queued response, so a test lists the responses in the order the code awaits them.
const responses: { data: unknown; error: null }[] = []
const removed: string[][] = []

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
    supabase: {
      from: () => builder(),
      storage: {
        from: () => ({
          remove: (paths: string[]) => {
            removed.push(paths)
            return Promise.resolve({ data: [], error: null })
          },
        }),
      },
    },
  }
})

const { adminApi } = await import('./endpoints')

const reply = (data: unknown) => responses.push({ data, error: null })
const postRow = (cover: string | null) => ({
  id: 'p1',
  title: 'T',
  slug: 't',
  excerpt: null,
  content: 'x',
  cover_image_path: cover,
  published_at: null,
  author_id: 'u1',
  status: 'draft',
  created_at: '2026-11-23T00:00:00Z',
  updated_at: '2026-11-23T00:00:00Z',
  category: null,
  post_tags: [],
  author: null,
})
const input = (coverImagePath?: string): PostInput => ({
  title: 'T',
  content: 'x',
  status: 'DRAFT' as const,
  categoryId: null,
  tagIds: [],
  coverImagePath,
})

beforeEach(() => {
  responses.length = 0
  removed.length = 0
})

describe('cover clean-up (D39)', () => {
  it('removes the old cover when a save replaces it', async () => {
    reply({ cover_image_path: 'u1/old.webp' }) // cover before the update
    reply([{ id: 'p1' }]) // updated rows
    reply(null) // clear post tags
    reply(postRow('u1/new.webp')) // re-read
    await adminApi.updatePost('p1', input('u1/new.webp'))
    expect(removed).toEqual([['u1/old.webp']])
  })

  it('keeps the cover when it did not change', async () => {
    reply({ cover_image_path: 'u1/same.webp' })
    reply([{ id: 'p1' }])
    reply(null)
    reply(postRow('u1/same.webp'))
    await adminApi.updatePost('p1', input('u1/same.webp'))
    expect(removed).toEqual([])
  })

  it('removes the cover when it is taken off the post', async () => {
    reply({ cover_image_path: 'u1/old.webp' })
    reply([{ id: 'p1' }])
    reply(null)
    reply(postRow(null))
    await adminApi.updatePost('p1', input(undefined))
    expect(removed).toEqual([['u1/old.webp']])
  })

  it('removes nothing when the save was not allowed', async () => {
    reply({ cover_image_path: 'u2/theirs.webp' })
    reply([]) // RLS matched no row
    await expect(adminApi.updatePost('p1', input(undefined))).rejects.toThrow()
    expect(removed).toEqual([])
  })

  it('removes the cover of a deleted post', async () => {
    reply([{ id: 'p1', cover_image_path: 'u1/cover.webp' }])
    await adminApi.deletePost('p1')
    expect(removed).toEqual([['u1/cover.webp']])
  })
})
