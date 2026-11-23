/** Thin fetch wrapper: JSON in/out, bearer token from memory, one refresh-and-retry on 401. */

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// The access token lives only in memory; the refresh token is an httpOnly cookie.
let accessToken: string | null = null
let refreshing: Promise<string | null> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      const token = res.ok ? ((await res.json()) as { accessToken: string }).accessToken : null
      setAccessToken(token)
      return token
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

interface RequestOptions {
  method?: string
  body?: unknown
  retry?: boolean
}

export async function api<T>(
  path: string,
  { method = 'GET', body, retry = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshAccessToken()) {
      return api<T>(path, { method, body, retry: false })
    }
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string | string[] }
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message
    throw new ApiError(res.status, message ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
