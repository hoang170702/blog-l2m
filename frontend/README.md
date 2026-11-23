# Blog frontend

Vite + React + TypeScript single-page app. Public pages: post list, category/tag/search filters, post detail with Markdown and comments. Admin (`/admin`): login, posts with Markdown editor and image upload, categories, tags, comments (hide, show again, delete).

The app talks directly to Supabase (Postgres with row-level security, Auth, Storage); there is no backend server.

```bash
npx supabase start              # at the repository root; needs Docker
cp .env.example .env.local      # then paste the anon key from `npx supabase status`
npm ci
npm run dev                     # http://localhost:5173 (local admin: see supabase/seed.sql)
```

Images are resized in the browser (max 1600 px, WebP or JPEG) before upload to the `post-images` bucket. Production builds add a CSP meta tag (Supabase URL from `VITE_SUPABASE_URL`) and write `dist/404.html` plus `public/_redirects` for SPA fallback on GitLab Pages.

| Script | Purpose |
| --- | --- |
| `npm run lint` | oxlint + Prettier check |
| `npm test` | Vitest + Testing Library + MSW |
| `npm run build` | Type-check and production build to `dist/` |

The production image (`Dockerfile`) serves `dist/` with Nginx (`nginx/default.conf`), proxies `/api/` to the `backend` container and serves uploaded files from `/usr/share/nginx/uploads`. It listens on plain HTTP; TLS is terminated by the edge proxy.

Build uses TypeScript 7 (native binary), which needs a glibc image (`node:22-slim`), not Alpine.
