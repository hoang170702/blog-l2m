# P09: Frontend on supabase-js

Status: In progress (code done on machine B, A012; tests + smoke pending on machine A)
Depends on: P08
Wave: 7
Subagent: Not eligible — consumes P08 contract directly
Owned scope: `frontend/**`
Produces: SPA using Supabase for data, auth and image storage; tests

Added by revision R2 (D21–D23).

## Tasks

- [x] `src/lib/supabase.ts` client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (public by design)
- [x] Data layer replacing `src/api/*`: posts (list/filter/search/pagination, detail), terms, comments (approved list, `submit_comment` RPC), admin CRUD, comment moderation
- [x] Auth: `signInWithPassword`, session restore, logout; admin guard checks `app_metadata.role` — per D27 the guard calls `get_my_admin_status()`; non-admin logins are signed out
- [x] Image upload: client-side resize/compress (canvas, max 1600px, WebP fallback JPEG), upload to `post-images`, insert public URL
- [x] Remove the dev proxy to the old backend; env example for Vite
- [ ] Tests adapted (data layer mocked), Markdown sanitization kept — deferred to machine A (A012): `client.test.ts` removed with the old client; `App.test.tsx` still mocks the old REST API with MSW and will fail until rewritten
- [x] CSP meta tag (connect-src Supabase URL, img-src self + Supabase storage + https), SPA fallback files for Pages (`_redirects`, `404.html` copy)

## Verification

- lint, typecheck, tests, build; manual run against local Supabase (`supabase start`) incl. admin login, CRUD, upload, comment moderation
- Machine split (A011): code, lint, typecheck, tests, build and `npm run db:test:embedded` run on either machine; the manual `supabase start` run needs Docker (machine A only)

## Rollback or Recovery

Revert commits.

## Execution Notes

- 2026-11-23 (machine B, A012, code only, nothing run): data layer in `src/api/endpoints.ts` keeps the old `publicApi`/`authApi`/`adminApi` shapes so pages barely change; `src/api/client.ts` now holds `ApiError` + Supabase error mapping; `src/lib/supabase.ts`, `src/lib/image.ts` (GIF kept as-is, others resized to 1600 px, WebP else JPEG, 2 MiB cap); cover stored as `coverImagePath`; post tags replaced by delete + insert (two requests, not atomic); public queries always filter `status = published` because admins can read drafts. CSP and `dist/404.html` are added only by `vite build` (dev keeps Vite's inline refresh script); `public/_redirects` rewrites `/*` to `/index.html`. `frontend/Dockerfile` and `nginx/` still target the old backend (P11).
- 2026-11-23 13:45 +07 (machine B, user ran `npm run build` from the repo root by mistake): build in the worktree found 2 type errors (comment row cast in `endpoints.ts`, `setAccessToken` import in `src/test/setup.ts`); fixed. `npm run build` passes (`dist/404.html`, `dist/_redirects` present; CSP meta injected, Supabase origin empty when built without `VITE_SUPABASE_URL`). `npm run lint`: 0 errors, Prettier clean; 1 pre-existing warning (`only-export-components` on `useAuth`). Tests not run.
- To check on machine A: `npm run typecheck`, `npm run lint`, then `npm run dev` against `npx supabase start` (admin login, CRUD, upload, comment moderation), then rewrite `App.test.tsx`.
