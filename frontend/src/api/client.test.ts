import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { api, ApiError, getAccessToken, refreshAccessToken, setAccessToken } from './client'

describe('api client', () => {
  it('retries a refresh that lost a race with another tab', async () => {
    let refreshCalls = 0
    server.use(
      http.post('*/api/auth/refresh', () =>
        ++refreshCalls === 1
          ? HttpResponse.json({ message: 'rotated' }, { status: 401 })
          : HttpResponse.json({ accessToken: 'from-retry' }),
      ),
    )

    await expect(refreshAccessToken()).resolves.toBe('from-retry')
    expect(refreshCalls).toBe(2)
    expect(getAccessToken()).toBe('from-retry')
  })

  it('refreshes the access token once on 401 and retries the request', async () => {
    setAccessToken('expired')
    let refreshCalls = 0
    server.use(
      http.get('*/api/admin/posts', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', () => {
        refreshCalls++
        return HttpResponse.json({ accessToken: 'fresh' })
      }),
    )

    await expect(api('/admin/posts')).resolves.toEqual({ ok: true })
    expect(refreshCalls).toBe(1)
    expect(getAccessToken()).toBe('fresh')
  })

  it('surfaces the server message when refresh fails', async () => {
    server.use(
      http.get('*/api/admin/posts', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', () => new HttpResponse(null, { status: 401 })),
    )

    const error = await api('/admin/posts').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, message: 'Unauthorized' })
    expect(getAccessToken()).toBeNull()
  })

  it('joins validation messages', async () => {
    server.use(
      http.post('*/api/admin/posts', () =>
        HttpResponse.json({ message: ['title is empty', 'content is empty'] }, { status: 400 }),
      ),
    )
    await expect(api('/admin/posts', { method: 'POST', body: {} })).rejects.toThrow(
      'title is empty, content is empty',
    )
  })
})
