# P12: Multi-author blog, OAuth sign-in, editor and dashboard

Status: In progress (code + automated checks done on machine B; UI smoke and OAuth app setup pending on machine A)
Depends on: P09
Wave: 7b
Subagent: Not eligible — changes the shared data contract and the frontend that consumes it
Owned scope: `supabase/migrations/` (new file), `supabase/config.toml` (auth), `supabase/.env.example`, `supabase/seed.sql`, `supabase/tests/database/*`, `scripts/allow-account.sql`, `frontend/**`
Produces: Any signed-in user writes and publishes posts; Google/GitHub OAuth sign-up; profiles; upgraded editor; dashboard

Added by revision R3 (D28-D33, Q18).

## Tasks

- [x] Migration: `public.profiles` + sign-up trigger + backfill; author FK to profiles; author forced to `auth.uid()`
- [x] Migration: RLS for authors (own posts, post_tags, comments on own posts), tags insert by signed-in users, admin keeps everything
- [x] Migration: storage `<user_id>/<uuid>.<ext>` per-user policies; cover path check accepts the prefix
- [x] Migration: drop the sign-up allowlist hook; config: sign-up on, Google + GitHub OAuth from env, callback redirect URLs — providers ship `enabled = false` so `supabase start` works without secrets; enable after filling `supabase/.env`
- [x] pgTAP tests updated for R3; `npm run db:test:embedded` passes
- [x] Frontend auth: OAuth (PKCE) + email sign-in, `/login`, `/auth/callback`, any signed-in user, admin flag
- [x] Frontend: header "Viết bài" + account menu; author shown on posts
- [x] Frontend: `/dashboard` (counts, recent posts), own-post list, comments on own posts, admin-only categories/tags
- [x] Frontend editor `/write`, `/write/:id`: toolbar, side-by-side preview, drag-and-drop images, cover preview, unsaved-changes warning, publish vs draft
- [x] Frontend typecheck, lint, build pass (frontend unit tests still deferred, A012)
- [!] Google OAuth client and consent screen (D35, steps 1-4 below): user-owned, needs the user's Google Cloud Console login
- [x] Google provider enabled in `supabase/config.toml` (step 5, A018): `enabled = true`; CLI 3.2.0 config validation passes with an empty `supabase/.env`
- [x] Cover-only images in one 16:9 frame (D37, A020): crop at upload, no inline images in editor or posts
- [x] Only the author edits a post, admins may delete (D38, A021): migration `20261123170000_author_only_edits.sql`, pgTAP, editor/post page/list UI
- [x] Home page lists posts in one column with equal cards, newest first (A022)
- [x] F1 Storage clean-up of replaced, removed and deleted covers (D39, A024)
- [x] F2 Search over title, excerpt and content without accents (D40, A025)
- [x] F3 Author page `/u/:id` with links from cards and posts (D41, A026)
- [!] GitHub OAuth App per environment (D36, "GitHub OAuth setup" below): user-owned, needs the user's GitHub login
- [x] GitHub provider enabled in `supabase/config.toml` (A019): `enabled = true`; CLI 3.2.0 config validation passes with an empty `supabase/.env`
- [!] Google sign-in smoke + first admin (steps 6-7): machine A (Docker), after the client exists; also confirm the auth container starts with an empty Google client ID

## Verification

- `npm run db:test:embedded`; frontend `npm run typecheck && npm run lint && npm run build`; UI smoke on a machine with Supabase running (needs OAuth client IDs for the OAuth buttons)

## Rollback or Recovery

Revert the commits; `supabase db reset` locally. The new migration is forward-only and not applied to any hosted database yet.

## Execution Notes

- 2026-11-23 (machine B, main checkout): migration `supabase/migrations/20261123140000_multi_author.sql` (profiles + trigger + backfill, `posts_author_profile_fkey`, author forced to caller and kept on update, cover path `<user>/<uuid>.<ext>` or legacy `<uuid>.<ext>`, author/admin RLS for posts, post_tags, comments; tag insert for signed-in users; per-user storage folders; allowlist hook + table dropped). `scripts/allow-account.sql` deleted; seed admin gets a display name. `npm run db:test:embedded`: 3 suites, 47 assertions pass.
- Frontend: data router (`createBrowserRouter`, needed by `useBlocker`); routes `/login`, `/auth/callback`, `/write`, `/write/:id`, `/dashboard`, `/dashboard/{posts,comments}`, admin-only `/dashboard/{categories,tags}`; `/admin/*` redirects. Editor: toolbar (`lib/markdownEdit.ts`) with Ctrl+B/I/K, side-by-side preview (tabs below lg), drag-drop and paste images, cover drop zone with preview, inline tag creation, unsaved-changes guard (in-app confirm + beforeunload), "Đăng bài" publishes and opens the post. `npx tsc -b`, `npm run lint` (0 errors, 2 `only-export-components` warnings: `useAuth`, `App.tsx` routes), `npm run build` pass. `App.test.tsx` got `author: null` only to compile; frontend tests still not rewritten or run (A012).
- Machine A todo: fill `supabase/.env` with Google/GitHub OAuth apps (callback `http://127.0.0.1:54321/auth/v1/callback`), set providers `enabled = true`, `npx supabase db reset`, then UI smoke: sign in, write/publish, edit, drafts, cover image (16:9 crop, drop/paste on the content sets the cover; D37), comment hide/show/delete by the author (D34: no approval step), admin categories/tags, "Sửa bài" only for the author and an admin can delete but not edit another's post (D38).
- Google OAuth setup (D35, Q21). The user does steps 1-3 in their own Google account; the agent cannot. Never ask the user to paste the secret into chat.
  1. https://console.cloud.google.com/ → create or pick a project (e.g. `l2m-blog`).
  2. APIs & Services → OAuth consent screen: user type External; app name + support email; scopes `openid`, `email`, `profile` only (non-sensitive, so "Publish app" needs no Google verification; in Testing mode only listed test users can sign in).
  3. Credentials → Create credentials → OAuth client ID → Web application. Authorized JavaScript origins: `http://localhost:5173` (add the Pages domains later). Authorized redirect URIs: `http://127.0.0.1:54321/auth/v1/callback`; later add `https://<project-ref>.supabase.co/auth/v1/callback` for each cloud project (P10).
  4. User writes `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` into `supabase/.env` (git-ignored; template `supabase/.env.example`).
  5. Done in A018: `enabled = true` committed (config validation passes without secrets; `env(...)` for `enabled` fails when unset). Original instruction: set `[auth.external.google] enabled = true` in `supabase/config.toml`. First check whether `npx supabase start` fails when the provider is enabled but `supabase/.env` is empty (unverified). If it fails, do not commit `enabled = true` as is: check whether the installed CLI accepts `enabled = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED)"` and use that with a default in `.env.example`, otherwise ask the user before committing a config that breaks `supabase start` for machines without secrets.
  6. `npx supabase stop && npx supabase start`, open http://localhost:5173/login → "Tiếp tục với Google" → back on `/auth/callback`, signed in; `public.profiles` row has the Google name/avatar.
  7. Make that account an admin if wanted: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v "email=<email>" -f scripts/bootstrap-site-admin.sql`.
  8. Document the steps (README or `docs/deploy.md` rewrite in P11).
- GitHub OAuth setup (D36, A019). Steps 1-3 are the user's; never ask for the secret in chat.
  1. https://github.com/settings/developers → OAuth Apps → New OAuth App (or an organization's Developer settings).
  2. Local app: Application name `L2M Blog (local)`; Homepage URL `http://localhost:5173`; Authorization callback URL `http://127.0.0.1:54321/auth/v1/callback`; leave "Enable Device Flow" off. Register, then "Generate a new client secret".
  3. User writes `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET` into `supabase/.env` on machine A.
  4. Done in A019: `[auth.external.github] enabled = true`.
  5. Machine A: `npx supabase stop && npx supabase start`, /login → "Tiếp tục với GitHub" → signed in, `public.profiles` has the GitHub name/avatar. Check an account whose GitHub email is private still gets an email (Supabase requests `user:email`).
  6. UAT and PROD (P10): one more OAuth App each (a GitHub OAuth App allows only one callback URL), callback `https://<project-ref>.supabase.co/auth/v1/callback`, Homepage URL = that environment's Pages URL; enter ID/secret in the project's Dashboard → Authentication → Providers → GitHub.
