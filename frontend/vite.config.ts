import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Production-only hardening for static hosting (GitLab Pages has no custom headers):
 * a CSP meta tag limited to this site and the Supabase project, and a 404.html copy of
 * index.html so deep links still load the SPA. Dev mode is left alone because the React
 * refresh runtime injects an inline script.
 */
function staticHosting(supabaseUrl: string): Plugin {
  let outDir = 'dist'
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
    ],
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [react(), tailwindcss(), staticHosting(env.VITE_SUPABASE_URL ?? '')],
  }
})
