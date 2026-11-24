import { createClient } from '@supabase/supabase-js'

// Both values are public by design: access is enforced by row-level security in the database.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (see frontend/.env.example)',
  )
}

export const supabase = createClient(url, anonKey, {
  // PKCE: the OAuth provider redirects back to /auth/callback?code=..., which the client exchanges.
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

export const POST_IMAGES_BUCKET = 'post-images'

/** RSS feed and sitemap, served by the `feed` Edge Function (supabase/functions/feed). */
export const RSS_URL = `${url}/functions/v1/feed/rss.xml`

export function postImageUrl(path: string) {
  return supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}
