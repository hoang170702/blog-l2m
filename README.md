# L2M Blog

A multi-author Vietnamese blog: a static React single-page app that talks directly to Supabase (PostgreSQL with row-level security, Auth, Storage, Edge Functions). There is no application server: every access rule lives in the database.

## Features

**Readers**
- Home page with one column of posts, category, tag and author pages (`/u/:id`), pagination.
- Search over title, excerpt and content that ignores case and Vietnamese accents ("lap trinh" finds "Lập trình").
- Post page: Markdown (sanitized, code highlighting), 16:9 cover, reading time, table of contents for h2/h3, view and like counts, related posts (same category or tag).
- Comments without an account, shown immediately, with one level of replies; a report button on posts and comments. Banned words are replaced by `*` in the database; such a comment carries a warning line with a partial address of the commenter (`113.161.*.*`). The full address and user agent are personal data: they stay in the `private` schema and are shown only to admins and the post's author.
- Signed-in readers bookmark posts (`/dashboard/saved`), follow authors (`/following` lists their posts) and get in-app notifications (a comment or like on their post, a new post by an author they follow).
- Series: posts grouped in order, with previous/next links and a `/series/:slug` page.
- Share buttons (copy link, Facebook, the device's share sheet), light and dark theme (header toggle, follows the system by default).
- "Nghe bài viết": the browser reads the post with the device's own voice (Web Speech API; Vietnamese voice when the device has one, otherwise its default voice with a note). Nothing is stored; quality depends on the device, and there is no voice choice.
- "Tuỳ chỉnh đọc": text size (four steps for the post body and comments) and font (Plus Jakarta Sans default, Be Vietnam Pro, Lora, system font), remembered on the device in `localStorage`. The default is the unchanged look.
- RSS feed and `sitemap.xml`.

**Authors** (sign in with Google or GitHub; the first sign-in creates the account)
- Markdown editor with toolbar, shortcuts, live preview and one cover image per post (cropped to 16:9 in the browser).
- Publish now, save a draft, or schedule publishing for a later time.
- The editor autosaves to the browser every few seconds and offers the copy back after a crash or an expired session.
- Dashboard: own posts with views, likes and comment counts plus totals, comments on own posts (hide, show again, delete; "Xem IP" shows the commenter's address and device), notifications, saved posts, profile (display name, avatar URL).
- Only the author edits a post; the author or an admin deletes it (from the post page or the post list).

**Admins**
- Categories and tags.
- Every post and comment.
- Report queue (`/dashboard/reports`): hide (a hidden post stays visible only to its author, with a banner, and to admins) or delete the reported content, mark the report resolved or dismissed.
- Moderation (`/dashboard/moderation`): banned-word list and blocked addresses; "Chặn IP" under a comment blocks that address from commenting.
- Members (`/dashboard/members`): search by name or email, suspend or restore an account. A suspended member can still read and sign in but cannot write, upload, like or edit their profile.

**Abuse limits** (enforced in the database): 3 comments a minute and 5 reports per 10 minutes per client address, 10 new posts and 30 image uploads per hour per author, views counted once per address, post and hour, 2 MiB images (WebP, JPEG, PNG, GIF), blocked addresses refused in `submit_comment`.

## Architecture

```mermaid
flowchart LR
  reader([Browser]) -->|HTML, JS| host[Static hosting<br/>frontend/dist]
  reader -->|supabase-js: REST, Auth, Storage<br/>anon key + user JWT| api
  crawler([Feed reader / crawler]) -->|rss.xml, sitemap.xml| feed

  subgraph supabase[Supabase project]
    api[Data API<br/>PostgREST] --> db[(PostgreSQL<br/>RLS + RPCs)]
    auth[Auth<br/>Google, GitHub OAuth] --> db
    storage[Storage<br/>post-images bucket] --> db
    feed[Edge Function<br/>feed] -->|anon key| api
  end
  reader --> auth
  reader --> storage
```

- **Frontend** (`frontend/`): Vite + React + TypeScript, TanStack Query, Tailwind. `src/api/endpoints.ts` is the only data layer; it shapes queries and maps rows but never decides access. Production builds add a strict CSP meta tag, `404.html` for SPA deep links, the RSS `<link>` and `robots.txt`.
- **Database** (`supabase/migrations/`): tables `posts`, `categories`, `tags`, `post_tags`, `comments`, `profiles`, `post_stats`, `post_likes`, `reports`, `bookmarks`, `follows`, `series`, `notifications`, `banned_words`. Row-level security decides who reads and writes what: visitors read published posts whose publish time has passed and that no admin hid (`private.is_live()`); members write only their own posts, tags and images; post authors moderate comments on their posts; admins (`private.site_admins`) manage everything. Guest-facing writes go through `security definer` RPCs with validation and rate limits (`submit_comment`, `report_content`, `record_post_view`); admin RPCs (`admin_list_users`, `admin_set_suspended`, `admin_set_hidden`, `admin_block_client`, ...) check the caller first. Notifications are written by triggers. The `private` schema (admin registry, suspensions, rate-limit counters, commenter addresses, blocked addresses) is not exposed through the API.
- **Storage**: public `post-images` bucket; each member writes only inside a folder named after their user id. Replaced or orphaned covers are deleted by the client when a post is saved or deleted.
- **Edge Function** `feed` (`supabase/functions/feed`): serves `rss.xml` and `sitemap.xml` from published posts, with no JWT required.

## Repository layout

| Path | Contents |
| --- | --- |
| `frontend/` | The SPA (`src/pages`, `src/components`, `src/api`, `src/lib`), Vitest tests |
| `supabase/migrations/` | Schema, RLS, RPCs, in order |
| `supabase/tests/database/` | pgTAP tests for access rules and functions |
| `supabase/functions/feed/` | RSS and sitemap Edge Function |
| `supabase/config.toml`, `supabase/seed.sql` | Local Supabase stack and local-only seed data |
| `scripts/` | Operator SQL (grant or revoke admin), embedded database test runner |
| `docs/` | Product ideas backlog, security notes, git flow |
| `deploy/`, `docker-compose.yml`, `frontend/Dockerfile`, `frontend/nginx/` | Earlier VPS/Docker setup from the NestJS version, not used by the Supabase app (see Status) |

## Local development

Requirements: Node.js 22+, Docker (for the local Supabase stack).

```bash
npm ci                          # Supabase CLI and database test tools
npx supabase start              # local Supabase: API on http://127.0.0.1:54321, Studio on :54323
npx supabase db reset           # apply migrations and supabase/seed.sql

cd frontend
cp .env.example .env.local      # then paste the anon key printed by: npx supabase status
npm ci
npm run dev                     # http://localhost:5173
```

Sign in at `/login` with the seeded admin `admin@example.com` / `local-dev-admin-password` (local only). Google and GitHub sign-in need OAuth apps: copy `supabase/.env.example` to `supabase/.env`, fill in the client IDs and secrets, then restart the stack. To try the feed locally, run `npx supabase functions serve` and open `http://127.0.0.1:54321/functions/v1/feed/rss.xml`.

Schema changes go in a new file under `supabase/migrations/` (`npx supabase migration new <name>`); never edit a migration that has been applied to a shared environment.

## Usage guide

1. **Read**: open the home page, filter by category or tag, or search. On a post, use the table of contents, like it (signed in), comment or reply without an account, or report it.
2. **Write**: sign in with Google or GitHub and click **Viết bài**. Write Markdown, drop or paste an image to set the cover, pick a category and tags. **Đăng bài** publishes now; filling **Hẹn giờ đăng** publishes later; **Lưu nháp** keeps it private. Leaving with unsaved changes asks first, and an autosaved copy is offered when you come back.
3. **Manage**: `/dashboard` shows your posts (with views and likes), the comments on them and your profile. Edit or delete a post from the list or from its page.
4. **Administer**: an admin is granted once per environment (Deployment, step 6). Admins see **Quản trị** in the dashboard menu: categories, tags, reports and members.

## Checks

| Check | Command | Where |
| --- | --- | --- |
| Lint (oxlint + Prettier) | `npm run lint` | `frontend/` |
| Types | `npm run typecheck` | `frontend/` |
| Unit and component tests | `npm test` | `frontend/` |
| Build | `npm run build` | `frontend/` |
| Database tests without Docker (PGlite) | `npm run db:test:embedded` | repository root |
| Database tests on the local stack | `npm run db:test` | repository root |

## Deployment

Production runs on GitHub Pages plus one Supabase project. Current values:

| Setting | Value |
| --- | --- |
| Site | https://hoang170702.github.io/blog-l2m/ |
| Supabase project ref | `rguionpzijghrxnkcqoz` |
| Supabase API URL | `https://rguionpzijghrxnkcqoz.supabase.co` |
| OAuth callback (GitHub, Google) | `https://rguionpzijghrxnkcqoz.supabase.co/auth/v1/callback` |
| RSS / sitemap | `https://rguionpzijghrxnkcqoz.supabase.co/functions/v1/feed/rss.xml`, `…/sitemap.xml` |

For another environment, replace `<ref>` (Supabase project ref) and `<site>` (public URL with its path and a trailing slash, for example `https://<owner>.github.io/<repository>/`) below. Secrets (database password, service key, OAuth client secrets) never go in the repository or in chat: they are typed into the Supabase Dashboard or the CLI prompt. Only `*.example` files are committed.

### 1. Supabase project and database

1. Create the project at https://supabase.com/dashboard (region close to readers, for example Singapore; it cannot be changed later) and keep the database password.
2. From the repository root:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>     # asks for the database password
   npx supabase db push --remote             # applies supabase/migrations; never run seed.sql there
   ```

   Projects created with "auto-expose new tables" off grant nothing to the API roles, so every migration that creates a table must grant its privileges explicitly (see `20261124120000_explicit_api_grants.sql`).
3. RSS and sitemap:

   ```bash
   npx supabase secrets set SITE_URL=<site without the trailing slash> --remote=<ref>
   npx supabase functions deploy feed --no-verify-jwt --remote=<ref>
   ```

Always apply migrations before pushing a frontend that needs them.

### 2. Auth URLs

Open `https://supabase.com/dashboard/project/<ref>/auth/url-configuration`:
- **Site URL**: `<site>`
- **Redirect URLs**: add `<site>auth/callback`

### 3. GitHub sign-in

1. Create an OAuth App at https://github.com/settings/applications/new (one app per environment, because GitHub allows one callback URL):
   - Homepage URL: `<site>`
   - Authorization callback URL: `https://<ref>.supabase.co/auth/v1/callback`
2. Copy the Client ID, generate a client secret.
3. In `https://supabase.com/dashboard/project/<ref>/auth/providers`, enable **GitHub** and paste both values.

### 4. Google sign-in

1. Pick or create a Google Cloud project: https://console.cloud.google.com/projectcreate
2. Consent screen (https://console.cloud.google.com/auth/branding): app name `L2M Blog`, support and developer email, audience **External**, authorized domains: the site's host (for example `hoang170702.github.io`) and `<ref>.supabase.co`.
3. Audience (https://console.cloud.google.com/auth/audience): **Publish app** so any Google account can sign in; in testing mode only the listed test users can.
4. Scopes (https://console.cloud.google.com/auth/scopes): only `openid`, `userinfo.email`, `userinfo.profile` (no verification needed).
5. Client (https://console.cloud.google.com/auth/clients/create): type **Web application**,
   - Authorized JavaScript origins: the site's origin without a path (`https://hoang170702.github.io`)
   - Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`
6. In `https://supabase.com/dashboard/project/<ref>/auth/providers`, enable **Google** and paste the Client ID and secret. Google can take a few minutes to accept a new redirect URI (`redirect_uri_mismatch` meanwhile).

### 5. GitHub Pages

`.github/workflows/deploy-pages.yml` runs lint, typecheck, tests and the build on every push to `main`, then publishes `frontend/dist` under `/<repository>/` (`VITE_BASE_PATH`).

1. Repository **Settings → Pages → Source**: **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**: `VITE_SUPABASE_URL` (`https://<ref>.supabase.co`) and `VITE_SUPABASE_ANON_KEY` (the project's public anon key: `npx supabase projects api-keys --project-ref <ref>`, row `anon`). Never use the `service_role` or secret key here.
3. Push to `main` (or run the workflow by hand from the Actions tab).

Deep links are served through `404.html`: they work in browsers but answer HTTP 404, which search engines index poorly, and `robots.txt` under a project path is not read by crawlers. Submit the sitemap URL in Google Search Console instead. Any other static host works too: build with the two `VITE_SUPABASE_*` variables (and `VITE_BASE_PATH` when served under a path) and publish `frontend/dist`; `404.html` and `public/_redirects` cover SPA routing.

### 6. First admin

1. Sign in once on `<site>login` with GitHub or Google (this creates the account).
2. In the SQL editor (`https://supabase.com/dashboard/project/<ref>/sql/new`) run, with that account's email:

   ```sql
   insert into private.site_admins (user_id)
   select id from auth.users where lower(email) = lower('you@example.com')
   on conflict (user_id) do nothing;
   ```

   (or `psql "$DIRECT_URL" -v "email=you@example.com" -f scripts/bootstrap-site-admin.sql`). Sign out and in again; the dashboard menu then shows **Quản trị**. Revoke with `scripts/revoke-site-admin.sql`.

## Maintenance

**Unused images.** A cover or avatar is uploaded as soon as it is cropped, before the post or profile is saved, so replacing it twice before saving or closing the editor leaves files nobody uses (replaced and removed covers and avatars of saved posts and profiles are deleted automatically). To remove them:

```bash
export SUPABASE_URL=https://<ref>.supabase.co
read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY   # paste the service role (or secret) key; not echoed
npm run images:cleanup                   # dry run: lists what it would delete
npm run images:cleanup -- --apply        # deletes them
```

Files that no post cover (drafts included) or profile avatar uses are deleted, but only when older than 24 hours (`--min-age-hours=<n>`), so an upload still being edited survives. The service role key bypasses every access rule: never commit it or pass it on the command line.

## Status

- The app runs fully on Supabase; the NestJS backend was removed. The VPS/Docker files (`deploy/`, `docker-compose.yml`, `frontend/Dockerfile`, `frontend/nginx/`) and `docs/api.md`, `docs/deploy.md`, `docs/security.md` still describe that earlier stack and are due for removal or rewrite (`AGENTS.md` is current).
- GitHub Pages deploys the frontend only; database migrations and the feed function are applied by hand (Deployment, step 1). `.gitlab-ci.yml` still includes the earlier GitLab fullstack pipeline template.
- Unused images are cleaned up by hand (Maintenance); a scheduled job is not set up. More ideas are in `docs/ideas.md`.
