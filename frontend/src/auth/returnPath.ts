/** Where to go after the OAuth round trip (the provider only returns to /auth/callback). */
const RETURN_KEY = 'auth:return-to'

export function rememberReturnPath(path: string) {
  sessionStorage.setItem(RETURN_KEY, path)
}

export function takeReturnPath() {
  const path = sessionStorage.getItem(RETURN_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  // Only same-site paths; never an absolute URL from storage.
  return path?.startsWith('/') && !path.startsWith('//') ? path : '/dashboard'
}
