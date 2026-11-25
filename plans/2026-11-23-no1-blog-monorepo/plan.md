# Plan

## Strategy

Greenfield build in five dependency-ordered phases. The REST API contract below is fixed up front so backend and frontend can be built in parallel in Wave 2. Docker/Nginx integration, then CI/CD, then docs and end-to-end verification follow.

## Phase Table (authoritative)

| ID | Phase | Depends on | Wave | Subagent | Owned scope | Produces |
|---|---|---|---|---|---|---|
| P01 | [Repo foundation](phases/P01-repo-foundation.md) | None | 1 | Not eligible — creates shared root files and git repo | `.git/`, `.gitignore`, `.editorconfig`, `.env.example`, `.pre-commit-config.yaml`, `.gitleaks.toml`, `README.md` (skeleton) | Initialized git repo, root conventions, local gitleaks hook |
| P02 | [Backend API](phases/P02-backend-api.md) | P01 | 2 | Eligible | `backend/**` | NestJS API implementing the contract, Prisma schema/migrations/seed, tests, `backend/Dockerfile` |
| P03 | [Frontend SPA](phases/P03-frontend-spa.md) | P01 | 2 | Eligible | `frontend/**` | React SPA consuming the contract, tests, `frontend/Dockerfile`, Nginx templates |
| P04 | [Docker compose, edge proxy and environments](phases/P04-docker-compose.md) | P02, P03 | 3 | Not eligible — integrates both apps and runs stateful containers | `docker-compose.yml`, `deploy/docker-compose.yml`, `deploy/edge/docker-compose.yml`, `deploy/.env.example`, `.env.example` (extend) | Local stack; per-environment app compose; shared Traefik edge |
| P05 | [CI/CD template repo, app pipeline and deploy scripts](phases/P05-gitlab-ci-deploy.md) | P04 | 4 | Not eligible — depends on final image/compose layout; second repo | `/home/hoangkktt/workspaces/cicd-templates/**`, `.gitlab-ci.yml`, `deploy/scripts/*.sh` | Versioned templates, include-only app pipeline, deploy/server/variable scripts |
| P06 | [Docs and end-to-end verification](phases/P06-docs-e2e.md) | P05 | 5 | Not eligible — final integration gate | `README.md`, `docs/**` | Final docs and verified end-to-end run |
| P07 | [GitLab remote setup](phases/P07-gitlab-remote-setup.md) | P05 | 5 | Not eligible — external side effects | GitLab projects `NguyenHuyHoang170702/cicd-templates`, `NguyenHuyHoang170702/blog-l2m`; local git remotes | Projects pushed, branches protected, environments + variables, MR pipeline |

Revised by E007 (2026-11-23): P04/P05 redesigned, P07 added (D16–D20).

Revision R2 (2026-11-23, D21–D26): Supabase + GitLab Pages, no NestJS/Redis/VPS. P02 backend and P04/P05 server deploy parts are superseded by these phases:

| ID | Phase | Depends on | Wave | Subagent | Owned scope | Produces |
|---|---|---|---|---|---|---|
| P08 | [Supabase schema, security and storage](phases/P08-supabase-schema.md) | P07 | 6 | Not eligible — shared data contract | `supabase/**` | Migrations, RLS, RPC, storage policies, pgTAP tests |
| P09 | [Frontend on supabase-js](phases/P09-frontend-supabase.md) | P08 | 7 | Not eligible — consumes P08 | `frontend/**` | SPA using Supabase data/auth/storage |
| P10 | [GitLab Pages hosting and CI template v2](phases/P10-pages-ci.md) | P09 | 8 | Not eligible — remote effects | template repo, `.gitlab-ci.yml`, UAT Pages project, variables | Pipeline with migrate + Pages deploys |
| P12 | [Multi-author, OAuth sign-in, editor and dashboard](phases/P12-multi-author-oauth.md) | P09 | 7b | Not eligible — data contract + consumer | new migration, `supabase/config.toml` auth, tests, `frontend/**` | Open sign-up via OAuth, author-owned posts, editor upgrade, dashboard |
| P11 | [Remove the old stack and rewrite docs](phases/P11-cleanup-docs.md) | P10 | 9 | Not eligible — repo-wide deletions | `backend/`, `deploy/`, compose, docs | Clean repo + docs |

## Waves

- Wave 1: P01
- Wave 2: P02, P03 (parallel-safe: disjoint dirs, shared API contract below)
- Wave 3: P04
- Wave 4: P05
- Wave 5: P06, P07 (P07 runs serially by the coordinator; needs user's glab auth)

## Integration Gates

- After Wave 2: backend `npm run lint && npm test && npm run test:e2e` and frontend `npm run lint && npm test && npm run build` pass; frontend API types match the contract.
- After Wave 3: `docker compose up -d --build` → all services healthy; smoke flow via `http://localhost:8080` (login, create post, upload image, view publicly, comment, approve).
- After Wave 3: two app projects (`blog-uat`, `blog-prod`) run side by side behind the edge proxy locally.
- After Wave 4: templates + app pipeline YAML valid (yaml lint; GitLab CI Lint in P07); scripts pass shellcheck; local deploy simulation healthy.
- After Wave 5: GitLab projects configured; MR pipeline of `feature/blog-mvp` → `uat` green.

## API Contract (prefix `/api`)

Public:
- `GET /health` → `{status:"ok", db, redis}`
- `GET /posts?page=&limit=&category=&tag=&q=` → `{items: PostSummary[], total, page, limit}` (published only)
- `GET /posts/:slug` → `PostDetail` (published only; 404 otherwise)
- `GET /posts/:slug/comments` → `Comment[]` (APPROVED only)
- `POST /posts/:slug/comments` `{authorName, content}` → 201 `{id, status:"PENDING"}` (rate-limited)
- `GET /categories`, `GET /tags`

Auth:
- `POST /auth/login` `{email,password}` → `{accessToken, user}` + sets refresh cookie
- `POST /auth/refresh` (cookie) → `{accessToken}` + rotates cookie
- `POST /auth/logout` → 204, clears cookie
- `GET /auth/me` → `User`

Admin (Bearer, role ADMIN):
- `GET /admin/posts?page=&status=`, `GET /admin/posts/:id`, `POST /admin/posts`, `PATCH /admin/posts/:id`, `DELETE /admin/posts/:id`
- `POST/PATCH/DELETE /admin/categories[/:id]`, `POST/PATCH/DELETE /admin/tags[/:id]`
- `GET /admin/comments?status=`, `PATCH /admin/comments/:id` `{status}`, `DELETE /admin/comments/:id`
- `POST /admin/uploads` (multipart `file`) → `{url}`

Types:
- `PostSummary {id, title, slug, excerpt, coverImageUrl, publishedAt, category:{id,name,slug}|null, tags:{id,name,slug}[]}`
- `PostDetail = PostSummary + {content}`; admin `Post` adds `{status, createdAt, updatedAt}`
- `Comment {id, authorName, content, createdAt}`; admin adds `{status, postId}`
- Errors: `{statusCode, message, error}` (NestJS default); validation 400, auth 401, forbidden 403, not found 404, rate limit 429.

## Data Model (Prisma)

Datasource: `provider = "postgresql"`, `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")` (Supabase-ready; see decision D13).

- `User {id, email unique, passwordHash, name, role(ADMIN), createdAt}`
- `Category {id, name unique, slug unique}`
- `Tag {id, name unique, slug unique}`
- `Post {id, title, slug unique, excerpt?, content, coverImageUrl?, status(DRAFT|PUBLISHED), publishedAt?, authorId→User, categoryId?→Category, tags Tag[] (implicit m2m), createdAt, updatedAt}`; index on `(status, publishedAt)`
- `Comment {id, postId→Post cascade, authorName, content, status(PENDING|APPROVED|REJECTED), createdAt}`; index on `(postId, status)`
