import { copyFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Production-only hardening for static hosting (GitLab Pages has no custom headers):
 * a CSP meta tag limited to this site and the Supabase project, and a 404.html copy of
 * index.html so deep links still load the SPA. Dev mode is left alone because the React
 * refresh runtime injects an inline script. It also links the RSS feed and writes robots.txt
 * pointing at the sitemap, both served by the `feed` Edge Function (supabase/functions/feed).
 */
function staticHosting(supabaseUrl: string): Plugin {
  let outDir = 'dist'
  const feedUrl = `${supabaseUrl}/functions/v1/feed`
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${supabaseUrl}`,
    `connect-src 'self' ${supabaseUrl}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return {
    name: 'static-hosting',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
        injectTo: 'head-prepend',
      },
      {
        tag: 'link',
        attrs: {
          rel: 'alternate',
          type: 'application/rss+xml',
          title: 'L2M Blog',
          href: `${feedUrl}/rss.xml`,
        },
        injectTo: 'head',
      },
    ],
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
      writeFileSync(
        resolve(outDir, 'robots.txt'),
        `User-agent: *\nDisallow: /dashboard\nDisallow: /write\n\nSitemap: ${feedUrl}/sitemap.xml\n`,
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    // GitHub Pages serves a project site under /<repository>/; VITE_BASE_PATH sets that prefix.
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), staticHosting(env.VITE_SUPABASE_URL ?? '')],
  }
})
