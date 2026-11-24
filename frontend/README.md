# Blog frontend

Vite + React + TypeScript single-page app. Public pages: post list, category/tag/search filters, author pages (`/u/:id`), post detail with Markdown, reading time, table of contents (h2/h3), view and like counts, related posts, comments with one level of replies, and a report button on posts and comments. Signed-in area (`/dashboard`, `/write`): own posts with per-post views and likes, Markdown editor with image upload, scheduled publishing and a local autosave every few seconds, comments on own posts, profile (name, avatar URL). The author or an admin can delete a post from its page or from the post list. Admins also get categories, tags, the report queue (`/dashboard/reports`) and members (`/dashboard/members`, suspend or restore an account).

The app talks directly to Supabase (Postgres with row-level security, Auth, Storage); there is no backend server.

```bash
npx supabase start              # at the repository root; needs Docker
cp .env.example .env.local      # then paste the anon key from `npx supabase status`
npm ci
npm run dev                     # http://localhost:5173 (local admin: see supabase/seed.sql)
```

A post's only image is its cover: the browser center-crops it to 16:9 (at most 1600x900, WebP or JPEG; GIF kept as-is) before upload to the `post-images` bucket, and the old file is deleted when a cover is replaced, removed or its post is deleted. Search folds the query with `src/lib/fold.ts`, which must stay identical to `private.fold_vi()` in the database. Production builds add a CSP meta tag (Supabase URL from `VITE_SUPABASE_URL`) and write `dist/404.html` plus `public/_redirects` for SPA fallback on GitLab Pages.

## RSS and sitemap

GitLab Pages serves only static files, so the feed and sitemap come from the `feed` Edge Function (`supabase/functions/feed`): `<VITE_SUPABASE_URL>/functions/v1/feed/rss.xml` and `…/sitemap.xml`. The production build links the feed in `index.html` and writes `dist/robots.txt` with the sitemap URL. Per environment:

```bash
npx supabase secrets set SITE_URL=https://<domain> --project-ref <ref>
npx supabase functions deploy feed --no-verify-jwt --project-ref <ref>
```

Locally, `npx supabase functions serve` serves it with `SITE_URL` from `supabase/config.toml`.

| Script | Purpose |
| --- | --- |
| `npm run lint` | oxlint + Prettier check |
| `npm test` | Vitest + Testing Library + MSW |
| `npm run build` | Type-check and production build to `dist/` |

The production image (`Dockerfile`) serves `dist/` with Nginx (`nginx/default.conf`), proxies `/api/` to the `backend` container and serves uploaded files from `/usr/share/nginx/uploads`. It listens on plain HTTP; TLS is terminated by the edge proxy.

Build uses TypeScript 7 (native binary), which needs a glibc image (`node:22-slim`), not Alpine.
