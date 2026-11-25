// RSS feed and sitemap for the static site (GitLab Pages cannot run code).
//   GET /functions/v1/feed/rss.xml      newest 20 published posts
//   GET /functions/v1/feed/sitemap.xml  home page and every published post
// Reads through the Data API with the anon key, so RLS decides what is public (drafts and
// posts scheduled for later never appear). Deployed with verify_jwt = false so feed readers
// and crawlers need no key. SITE_URL (secret) is the public site origin used in links.

const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SITE_TITLE = 'L2M Blog'
const SITE_DESCRIPTION = 'Viết, lưu giữ và chia sẻ'
const SITEMAP_LIMIT = 5000

interface PostRow {
  title: string
  slug: string
  excerpt: string | null
  published_at: string
  updated_at: string
  author: { display_name: string } | null
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`)
}

async function publishedPosts(limit: number): Promise<PostRow[]> {
  const params = new URLSearchParams({
    select: 'title,slug,excerpt,published_at,updated_at,author:profiles!posts_author_profile_fkey(display_name)',
    status: 'eq.published',
    published_at: `lte.${new Date().toISOString()}`,
    hidden_at: 'is.null', // RLS already excludes hidden posts for anon (D49); stated for clarity

    order: 'published_at.desc',
    limit: String(limit),
  })
  const response = await fetch(`${SUPABASE_URL}/rest/v1/posts?${params}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  })
  if (!response.ok) throw new Error(`Data API answered ${response.status}`)
  return (await response.json()) as PostRow[]
}

function postUrl(post: PostRow) {
  return `${SITE_URL}/posts/${encodeURIComponent(post.slug)}`
}

function rss(posts: PostRow[]) {
  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl(post))}</link>
      <guid isPermaLink="true">${escapeXml(postUrl(post))}</guid>
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>${
        post.author ? `\n      <dc:creator>${escapeXml(post.author.display_name)}</dc:creator>` : ''
      }${post.excerpt ? `\n      <description>${escapeXml(post.excerpt)}</description>` : ''}
    </item>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${escapeXml(SITE_URL)}/</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>vi</language>
${items}
  </channel>
</rss>
`
}

function sitemap(posts: PostRow[]) {
  const urls = [
    `  <url><loc>${escapeXml(SITE_URL)}/</loc></url>`,
    ...posts.map(
      (post) =>
        `  <url><loc>${escapeXml(postUrl(post))}</loc><lastmod>${post.updated_at.slice(0, 10)}</lastmod></url>`,
    ),
  ].join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

Deno.serve(async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }
  if (!SITE_URL || !SUPABASE_URL || !ANON_KEY) {
    return new Response('Feed is not configured (SITE_URL)', { status: 500 })
  }
  const path = new URL(request.url).pathname
  const isSitemap = path.endsWith('/sitemap.xml')
  if (!isSitemap && !path.endsWith('/rss.xml')) return new Response('Not found', { status: 404 })

  try {
    const body = isSitemap ? sitemap(await publishedPosts(SITEMAP_LIMIT)) : rss(await publishedPosts(20))
    return new Response(request.method === 'HEAD' ? null : body, {
      headers: {
        'Content-Type': isSitemap ? 'application/xml; charset=utf-8' : 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error(error)
    return new Response('Feed unavailable', { status: 502 })
  }
})
