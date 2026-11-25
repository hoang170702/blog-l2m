# Decisions

## Accepted

- D1: Monorepo with `frontend/`, `backend/`, `deploy/`, `docs/`, root `docker-compose.yml`, `.gitlab-ci.yml`. Each app has its own `package.json` (npm, `package-lock.json`); no workspace tool.
- D2: Backend = Node.js 22 LTS + NestJS 11 + TypeScript + Prisma (PostgreSQL) + ioredis. (User choice; replaces earlier Java/Spring Boot choice.)
- D3: Frontend = Vite + React 19 + TypeScript + React Router + TanStack Query + Tailwind CSS. (User choice.)
- D4: Database = PostgreSQL; Redis 7. (User choice.) Revised by D13: production DB is Supabase; dev/CI use a local Postgres container pinned to the Supabase major version (`POSTGRES_IMAGE`, default `postgres:17-alpine`).
- D13: Supabase as production DB (user direction). Prisma datasource uses `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`; prod `DATABASE_URL` = Supavisor transaction pooler (6543, `?pgbouncer=true&connection_limit=5&sslmode=require`), `DIRECT_URL` = session pooler (5432, `sslmode=require`) used by `prisma migrate deploy`. In dev/CI both URLs point to the local Postgres. Prod compose has no Postgres by default; an optional `postgres` service under compose profile `selfhost-db` covers the period before Supabase is provisioned. Only standard Postgres features; no Supabase Auth/Storage/RLS dependency.
- D15: Secret handling (user choice, Q4): no real env file is ever committed (`.gitignore` + example files only); prod secrets live in GitLab CI/CD variables marked protected (and masked/hidden where GitLab allows — multi-line File variables like `PROD_ENV_FILE` cannot be masked, so jobs must never print them and run with no `set -x`); gitleaks blocks leaks both locally (`.pre-commit-config.yaml` gitleaks hook) and in CI (`secret-scan` job in the `lint` stage, failing the pipeline); on the VPS `$DEPLOY_PATH/.env` is written with `umask 077` → mode 600, owned by the deploy user, `$DEPLOY_PATH` mode 700. FE has no secrets; `VITE_*` vars are treated as public. Rejected for now: Docker secrets files, SOPS + age, external secret manager (Infisical/Vault).
- D16 (proposed, E007): Separate GitLab project `NguyenHuyHoang170702/cicd-templates` (private) holding reusable CI templates using `spec:inputs`, versioned by tags (`v1.0.0`). App repo `NguyenHuyHoang170702/blog-l2m` (private) `.gitlab-ci.yml` only `include:`s `project: NguyenHuyHoang170702/cicd-templates`, `ref: v1.0.0`, `file: /templates/fullstack-compose.yml` with `inputs`. Local clone of the template repo at `/home/hoangkktt/workspaces/cicd-templates` (sibling of the app repo). Supersedes D10's single-file pipeline.
- D17 (accepted, Q5=1): Git flow — `master` is the base; `feature/*` branches from `master`; MR `feature/*` → `uat` auto-deploys UAT; MR `uat` → `prod` deploys PROD via manual job; after a stable release, MR `prod` → `master` and tag `vX.Y.Z`. `master`, `uat`, `prod` protected (no direct push, merge via MR, maintainers only); MRs on `feature/*` run secret-scan + lint + test only.
- D18 (accepted, Q6=1): UAT and PROD on the same VPS as separate compose projects (`/opt/blog-uat` project `blog-uat`, `/opt/blog-prod` project `blog-prod`), each with its own Redis, uploads volume and domain (`uat.<domain>`, `<domain>`), one Supabase project per environment. A shared edge reverse proxy stack (`/opt/edge`, Traefik v3 with automatic Let's Encrypt via HTTP-01, external Docker network `edge`) routes by host. Frontend image Nginx becomes HTTP-only (SPA + `/api` + `/uploads` proxy); TLS moves to Traefik. Supersedes D9 TLS/certbot parts and `init-letsencrypt.sh`.
- D19 (proposed, E007): CI/CD variables — "setup kỹ": GitLab environments `uat` and `production`; every secret is its own variable (protected, masked+hidden where single-line), environment-scoped: `DEPLOY_PATH`, `APP_DOMAIN`, `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`; shared (scope `*`): `SSH_PRIVATE_KEY` (File, protected), `SSH_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_REGISTRY_USER`/`DEPLOY_REGISTRY_PASSWORD` (project deploy token, `read_registry`), `ACME_EMAIL`. Deploy job renders `.env` on the server from an explicit allowlist of variable names (never printed). Random secrets (JWT, Redis, admin password) generated and set directly via API without printing; user-owned values (Supabase URLs, SSH key, host, domain) set by the user or via a helper script reading gitignored local files. Supersedes D15's single `PROD_ENV_FILE`; rest of D15 unchanged.
- D20 (proposed, E007): Remote GitLab operations (create projects, push branches/tags, protect branches, environments, variables, deploy token) are performed only after the revised plan is approved and GitLab auth is available (`glab` not installed locally).
- D21 (accepted, Q11/Q12, 2026-11-23): Revision R2 — no VPS, no NestJS backend, no Redis. Static SPA on GitLab Pages talking directly to Supabase (Postgres + Auth + RLS + Storage). Supersedes D2 (backend), D5 (JWT/refresh), D6 (Redis throttler), D7 (Redis cache), D8/D14 (uploads volume), D9/D18 (VPS topology, Traefik), the SSH deploy parts of D16/D19; D20's remote scope extends to the new UAT Pages project.
- D22 (accepted): Admin auth = Supabase Auth email/password; sign-ups disabled; admin role via `auth.users.raw_app_meta_data.role = 'admin'` checked by SQL `is_admin()`; RLS enforces all access.
- D23 (accepted, Q13 = Supabase Storage): images in a public Supabase Storage bucket `post-images`; read public, insert/update/delete only `is_admin()` (storage RLS); client compresses images before upload (max ~1600px, WebP/JPEG); allowed MIME png/jpeg/webp/gif, size cap on the bucket. Base64-in-DB, GitLab-repo and Google Drive options rejected.
- D24 (accepted): PROD = GitLab Pages of `blog-l2m` (built from `prod`); UAT = GitLab Pages of separate project `NguyenHuyHoang170702/blog-l2m-uat`, published by the `uat` pipeline pushing the build with a write deploy key. One Supabase project per environment.
- D25 (accepted): CI template `templates/spa-pages-supabase.yml` released as cicd-templates v2.0.0; `fullstack-compose.yml` kept for compatibility.
- D26 (accepted): Work continues on branch `feature/supabase-pages` (from `feature/blog-mvp`) in the same dedicated worktree; MR !1 handling (close as superseded) asked when the new MR exists.
- D27 (accepted, Q16 = option 1): adopt from the wander-plan review: (1) admin registry `private.site_admins` + fail-closed bootstrap SQL by verified email (supersedes the `app_metadata.role` part of D22); (2) revoke execute from anon on all app functions except `submit_comment`, with a pgTAP test; (3) PGlite + pgTAP DB tests in CI, `supabase test db` locally; (4) `before_user_created` hook blocking sign-ups; (5) `npm audit --audit-level=high` gate + non-empty Supabase vars check before build; (6) check constraints restricting cover/image URLs to the project's Supabase Storage public path. Keep hosted UAT (Pages + Supabase UAT) and CI-driven forward-only migrations.
- D14: Uploads remain on the VPS Docker volume (user choice, over Supabase Storage and a pluggable adapter). Volume backup documented in deploy docs.
- D5: Auth = access JWT (15 min, `Authorization: Bearer`) + refresh token (7 days, httpOnly `SameSite=Strict` cookie scoped to `/api/auth`), stored in Redis as `refresh:<userId>:<jti>`, rotated on each refresh, deleted on logout. Passwords hashed with argon2. Single ADMIN seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- D6: Rate limiting = `@nestjs/throttler` with Redis storage; global 100 req/min/IP, login 5/min/IP, comment 3/min/IP.
- D7: Cache = Redis keys `cache:posts:list:<hash(query)>` (TTL 60 s) and `cache:posts:slug:<slug>` (TTL 300 s); any post/category/tag write deletes `cache:posts:*` via SCAN.
- D8: Uploads stored on Docker volume `uploads` mounted to backend `/app/uploads` (write) and Nginx `/usr/share/nginx/uploads` (read-only); public URL `/uploads/<uuid>.<ext>`.
- D9: Production topology: containers `nginx` (= frontend image: built SPA + Nginx reverse proxy + TLS), `backend`, `redis`, `certbot`; DB = Supabase (external), or `postgres` only when profile `selfhost-db` is enabled. Only Nginx publishes ports 80/443.
- D10: CI = GitLab CI on Docker executor with docker:dind; images pushed to `$CI_REGISTRY_IMAGE/backend` and `$CI_REGISTRY_IMAGE/frontend` tagged `$CI_COMMIT_SHORT_SHA` and `latest` (main only). Deploy job on `main`, `when: manual`, environment `production`, over SSH.
- D11: Guest comments with moderation (PENDING by default). Assumption accepted as default; user may revise at approval.
- D12: Package manager npm; lint = ESLint + Prettier; tests = Jest (backend unit + e2e with supertest), Vitest + Testing Library (frontend).

## Revision R3 (accepted Q18, 2026-11-23 14:10 +07)

- D28 (accepted): Multi-author blog. Any signed-in user writes posts; "Đăng bài" publishes immediately, drafts stay optional; everyone reads published posts; an author edits/deletes only their own posts; site admins (`private.site_admins`) can manage every post. Supersedes the admin-only write part of D22/D27.
- D29 (accepted): Supabase Auth with OAuth 2 (Google and GitHub, PKCE flow, return route `/auth/callback`). Sign-up = first OAuth sign-in; the allowlist hook and `enable_signup = false` are removed. Email/password sign-in stays only for existing accounts (local seed admin), with no email sign-up form.
- D30 (accepted): "Store OAuth in the DB" = accounts and provider identities stay in Supabase's `auth.users` / `auth.identities`; new `public.profiles` (id, display_name, avatar_url, provider, created_at) filled by a trigger on sign-up and shown as post author. Provider access/refresh tokens are not stored (not needed, avoids a token leak).
- D31 (accepted; comment part superseded by D34): Guest comments keep moderation (the dashboard counts pending comments); the post author or an admin approves/rejects. Categories: admin only. Tags: any author may create, admin renames/deletes.
- D32 (accepted): Storage: any signed-in user uploads to `post-images` as `<user_id>/<uuid>.<ext>` and deletes only their own files; 2 MiB cap and MIME allowlist kept.
- D33 (accepted): UI: `/login` (Google, GitHub buttons + email form for existing accounts), `/auth/callback`, `/write` and `/write/:id` editor (toolbar bold/italic/heading/link/image/code, side-by-side live preview, drag-and-drop images, cover preview, unsaved-changes warning), `/dashboard` (own posts, drafts, pending comments on own posts, recently edited; admins see site-wide counts and links to categories/tags/comments). Header shows "Viết bài" and the account menu. DB changes go in a new forward-only migration plus updated pgTAP tests.
- Risks (accepted by the user: internal, for-fun blog, "đừng sợ spam"): open sign-up invites spam posts and image uploads (no rate limit on Storage or inserts beyond the size cap); OAuth needs client IDs/secrets from Google Cloud and GitHub per environment (user-supplied; local values via `supabase/.env`, never committed).
- D34 (accepted Q19, 2026-11-23 +07): Comments show immediately, no approval step. Forward-only migration `20261123160000_comments_without_moderation.sql`: `comments.status` defaults to `approved`, `submit_comment` inserts `approved` and keeps the 3/min per client limit. `pending` stays in the enum but is no longer written or shown. The post author or an admin hides (`rejected`), shows again (`approved`) or deletes a comment. The dashboard drops the pending-comments card. No backfill (no production comments).
- D35 (accepted Q21, 2026-11-23 15:57 +07): Google sign-in is enabled in every environment: local (Supabase CLI on machine A) now, UAT and PROD once their Supabase cloud projects exist (P10). One Google OAuth client ("Web application") may serve all environments by listing every redirect URI; a separate client for PROD is optional. Secrets never enter the repository: `supabase/.env` locally (git-ignored), Supabase Dashboard per cloud project. GitHub sign-in stays as built (P12) and is enabled the same way when the user creates a GitHub OAuth app.
- D36 (accepted, A019, 2026-11-23 16:25 +07): GitHub sign-in is enabled in every environment like Google (extends D35). A GitHub OAuth App has exactly one Authorization callback URL, so each environment needs its own app: local (`http://127.0.0.1:54321/auth/v1/callback`), UAT and PROD (`https://<project-ref>.supabase.co/auth/v1/callback`). Secrets stay in `supabase/.env` / the Supabase Dashboard.
- D37 (accepted Q23, 2026-11-23 16:45 +07): Posts carry images only as the cover, shown on the home card and at the top of the post. The cover is center-cropped to 16:9 at upload (1600x900 WebP, JPEG fallback; GIF kept as-is and cropped by CSS). The editor no longer inserts images into the body: no toolbar image button; an image dropped or pasted on the content becomes the cover. `Markdown` drops `img` elements, so inline images in older posts no longer show.
- D38 (accepted Q24, 2026-11-23 17:00 +07): Only a post's author edits it (content, status, tags). Admins keep reading every post and deleting any post (spam clean-up with open sign-up), but no longer edit others' posts. Supersedes the "admins can manage every post" edit part of D28. UI: "Sửa bài" on the post page for its author only; the editor refuses other users' posts; a save or delete that changes no row reports an error.
- D39 (accepted A023): Covers no longer leak in Storage. After a post saves with a different cover (or none), the old file is removed; deleting a post removes its cover. Done in the client through the Storage API (direct `delete from storage.objects` does not remove the file and Supabase blocks it); best effort: a failed removal never fails the save. Covers uploaded and then abandoned without saving still stay (known gap).
- D40 (accepted A023): Search matches title, excerpt and content, ignoring case and Vietnamese accents ("lap trinh" finds "Lập trình"). A stored generated column `posts.search_text` = `private.fold_vi(title || excerpt || content)`, where `fold_vi` is an immutable `translate()`-based folding (no `unaccent` extension, so it also works in the PGlite test runner); the client folds the query the same way and filters with `ilike`. No index: blog-sized table.
- D41 (accepted A023): Author page `/u/:id` lists an author's published posts with their profile card; author names on cards and posts link to it.
## Revision R4 (feature set of 2026-11-25, A028)

- D42 (accepted): Bookmarks. `public.bookmarks (post_id, user_id)`; owner-only RLS; insert needs `private.is_active()` and a live post; page `/dashboard/saved`.
- D43 (accepted): Follows. `public.follows (follower_id, author_id)`; owner-only RLS; `/following` lists posts of followed authors; `public.follower_count(uuid)` for the author page.
- D44 (accepted, Q3=a): In-app notifications for: a new comment on my post, a like on my post, a post published by an author I follow. No reply notifications (guest comments). Rows written by security-definer triggers; `mark_notifications_read()`.
- D45 (accepted): Dark theme. Colors become CSS variables switched by `data-theme`; choice in `localStorage`, default follows `prefers-color-scheme`.
- D46 (accepted): Share buttons: copy link, Facebook sharer, Web Share API when available (no backend).
- D47 (accepted): Series. `public.series` owned by an author; `posts.series_id`, `posts.series_order`; a post may only join its own author's series; `/series/:slug`; prev/next on the post page.
- D48 (accepted): Per-post stats on the dashboard from the existing `post_stats` and comment counts; no DB change.
- D49 (accepted, Q2=a): Admin hide. `posts.hidden_at`/`hidden_by` (not an enum value: new enum values are unusable inside the migration transaction). Hidden posts are visible only to the author (banner) and admins; nobody else can read, like, comment, report or record views; the author cannot clear `hidden_at`; `admin_set_hidden()`.
- D50 (accepted, answers 1=a, 2=a): Profanity filter. Banned words (admin-managed, accent-folded) are replaced by `*` in the database on insert; `comments.masked` drives a warning line. The commenter's address and user agent are stored in `private.comment_clients`; publicly only a masked IP (`113.161.*.*`) is shown under masked comments; admins and the post's author read the full IP and a short device/browser label; admins may block an address (`private.blocked_clients`, `submit_comment` refuses with P0403). Device model is only what the user agent carries (no Client Hints), so usually OS + browser.
- Dropped by the user: draft preview links (idea 7) and CSS default covers (idea 10). Avatar upload and cover size unchanged.

## Rejected

- Java 21 + Spring Boot 3 + Maven backend (user switched to Node.js).
- Next.js SSR (user chose Vite SPA).
- MySQL (user chose PostgreSQL).
- Express + Prisma, Fastify + Drizzle (user chose NestJS + Prisma).
- Supabase Storage for uploads; pluggable storage adapter (user chose VPS volume).
- Self-hosted Postgres as the long-term prod DB (user direction: Supabase).

## Assumptions

- A1: Target VPS runs Ubuntu 22.04/24.04 with Docker Engine + Compose plugin, a domain whose A record points to it, ports 22/80/443 open.
- A2: GitLab project uses gitlab.com shared runners or a runner allowing privileged docker:dind.
- A4: The user's purchased server is reachable over SSH from the internet (public IP, port 22 open), so gitlab.com shared runners can deploy via SSH. If it is not (NAT/internal network/firewall blocks inbound SSH), the documented fallback is installing a self-hosted GitLab Runner on the server itself (shell executor, tag `production`); the runner polls GitLab outbound, so no inbound SSH is needed, and the deploy job runs `deploy.sh` locally. User asked "gitlab có deploy lên đc server mà tôi mua ko?" — answered yes with this caveat.
- A3: Domain and VPS details are not known yet; config uses placeholders (`DOMAIN`, `DEPLOY_HOST`, ...) set via CI/CD variables and `.env`.

## Unknowns

- Real domain, VPS host, GitLab project path, Supabase project ref/region/password: supplied by user at deploy time; not blocking implementation.

## Open Questions

- Q1 (answered): BE chuyển sang Node.js, đạo hữu chọn framework nào?

  1. NestJS + Prisma. Recommended.
  2. Express + Prisma.
  3. Fastify + Drizzle.
  4. Other — specify.

  Answer: 1 → D2.

- Q3 (answered): Khi DB chuyển sang Supabase, ảnh upload lưu ở đâu?

  1. Volume trên VPS. Recommended.
  2. Supabase Storage.
  3. Storage adapter có thể đổi (local/supabase).
  4. Other — specify.

  Answer: 1 → D14.

- Q4 (answered): Đạo hữu muốn bảo vệ secret ở mức nào?

  1. GitLab Vars + gitleaks (+ chmod 600 trên VPS). Recommended.
  2. Như trên + Docker secrets (`/run/secrets`, `*_FILE`).
  3. SOPS + age (env mã hóa commit vào repo).
  4. Secret manager ngoài (Infisical/Vault, OIDC).

  Answer: 1 → D15. (User raised this instead of answering Q2; Q2 re-asked after update.)

- Q5 (answered): Git flow 4 nhánh đi theo luồng nào?

  1. master gốc → uat → prod (prod → master sau release). Recommended.
  2. feature → uat và feature → prod.
  3. master là nhánh dev → uat → prod.
  4. Other — specify.

  Answer: 1 → D17.

- Q6 (answered): Môi trường UAT chạy ở đâu?

  1. Cùng VPS, tách stack. Recommended.
  2. VPS riêng cho mỗi môi trường.
  3. Cấu hình được cả hai.
  4. Other — specify.

  Answer: 1 → D18.

- Q7 (answered: 1 — approved; D16, D19, D20 now accepted): Approve revised plan (E007: D16, D18 Traefik edge, D19, D20, phases P04/P05/P07 revised)?

  1. Duyệt bản sửa đổi. Recommended.
  2. Sửa cục bộ.
  3. Giữ plan cũ (1 môi trường, CI trong repo).
  4. Other — specify.

- Q8 (answered): Tại hạ truy cập GitLab (tạo repo, biến, nhánh) bằng cách nào?

  1. glab + auth login (user installs glab, runs `! glab auth login`). Recommended.
  2. Token file + REST API.
  3. Làm code trước, GitLab sau.
  4. Other — specify.

  Answer: 1. Pending user action: install glab + login (blocks P07 only).

- Q2 (answered 2026-11-23): Approval of this plan. Answer: 1 (approved, no execution requested).

  1. Duyệt kế hoạch: chốt bản hiện tại, chưa triển khai. Recommended.
  2. Sửa cục bộ: đạo hữu nêu phần cần điều chỉnh.
  3. Lập lại kế hoạch: đánh giá lại hướng tiếp cận.
  4. Other — specify.
