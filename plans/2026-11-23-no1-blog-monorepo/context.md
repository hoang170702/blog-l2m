# Context

## Goal

Build a blog as a monorepo in `/home/hoangkktt/workspaces/blog-l2m` with:

- Frontend: Vite + React + TypeScript SPA
- Backend: Node.js (NestJS + Prisma, TypeScript)
- Database: PostgreSQL — local container for dev/CI; production target is Supabase (managed Postgres)
- Cache/state: Redis 7 (self-hosted on the VPS; Supabase does not provide Redis)
- Docker for local dev and production
- GitLab CI pipeline (lint → test → build image → push to GitLab Container Registry → deploy) and deploy to one Linux VPS over SSH

## Background and history

- User first asked for FE/BE/DB/Redis/Docker/GitLab CI/deploy.
- First stack choice was Java (Spring Boot 3 + Maven) for BE; the user then switched BE to Node.js and selected NestJS + Prisma. Java is no longer in scope.
- FE: Vite + React SPA (chosen over Next.js). DB: PostgreSQL (chosen over MySQL).
- User chose to plan before implementation.
- User then stated production DB will be Supabase. Only the DB moves to Supabase; image uploads stay on a VPS Docker volume (user choice). Supabase Auth/Storage are not used.

## Current-state inspection (verified 2026-11-23)

- Workspace `/home/hoangkktt/workspaces/blog-l2m` is empty and is NOT a Git repository (only this `plans/` bundle exists).
- Local toolchain: Node v22.23.4 (nvm), Docker 29.8.1, Docker Compose v5.5.1, git available. Java 21 / Maven present but unused.
- No existing behavior to preserve (greenfield). Baseline = empty directory.

## Scope

In scope (MVP):

1. Posts written in Markdown: title, slug, excerpt, cover image, content, status (DRAFT/PUBLISHED), publishedAt; public list with pagination and filter by category/tag; public detail by slug; simple search by title.
2. Categories (one per post) and tags (many per post); admin CRUD.
3. Comments on published posts by guests (name + content), moderated: PENDING → APPROVED/REJECTED by admin; only APPROVED shown publicly.
4. Admin authentication with JWT (access token) + refresh token (httpOnly cookie, stored/rotated in Redis). Single ADMIN role, no public registration; admin seeded from env.
5. Image upload by admin (jpeg/png/webp/gif, ≤ 5 MB, verified by magic bytes), stored on a Docker volume, served by Nginx at `/uploads/`.
6. Redis: cache public post list/detail (invalidated on write), rate limiting (login, comment submit, global), refresh token store.
7. Docker: `docker-compose.yml` for dev (includes local Postgres); `deploy/docker-compose.prod.yml` for prod (connects to Supabase via env; optional self-hosted Postgres behind a compose profile for the interim before Supabase is ready); Nginx (inside the frontend image) serving SPA, reverse-proxying `/api`, serving `/uploads`, TLS via Let's Encrypt (certbot).
8. GitLab CI `.gitlab-ci.yml` + deploy scripts + VPS setup docs.
9. README and docs.

Out of scope: multi-user/roles beyond ADMIN, public sign-up, SSR/SEO prerendering, S3/object storage, email notifications, Kubernetes, multi-server/HA, monitoring stack, blue-green deploy.

## Constraints

- Code, comments, commits, docs in repo: normal English/project convention (no workflow IDs).
- Commit messages: Conventional Commits, no Co-Authored-By trailers (user CLAUDE.md). Branch names must not contain `claude`/`agent`.
- Secrets never committed; `.env.example` only. Prod secrets come from GitLab CI/CD variables.
- `/plans/` must be git-ignored once the repo is initialized.

## Touchpoints (to be created)

`backend/`, `frontend/`, `deploy/`, `docker-compose.yml`, `.gitlab-ci.yml`, `.gitignore`, `.editorconfig`, `.env.example`, `README.md`, `docs/`.

## Risks

- R1: CI docker-in-docker needs a privileged GitLab runner; shared gitlab.com runners support it. Self-hosted runner may need config → documented in docs.
- R2: Let's Encrypt chicken-and-egg (Nginx needs cert to start 443). Mitigation: init script issues a cert with HTTP-only bootstrap config first.
- R3: Prisma migrations at container start can fail on deploy → backend container exits, old containers already replaced. Mitigation: deploy script runs `prisma migrate deploy` as a one-off before `up -d`, aborts on failure; rollback by redeploying previous image tag.
- R4: Upload validation (malicious files) → magic-byte check, random filenames, Nginx serves `/uploads` with `X-Content-Type-Options: nosniff` and no script execution.
- R5: Markdown XSS → render with `react-markdown` + `rehype-sanitize`, no raw HTML.

- R6: Supabase connection limits / pooler semantics. Mitigation: runtime `DATABASE_URL` via Supavisor transaction pooler (port 6543, `pgbouncer=true`, small `connection_limit`); migrations via `DIRECT_URL` (session pooler port 5432, since the direct host is IPv6-only by default); `sslmode=require`.
- R7: Latency VPS ↔ Supabase. Mitigation: documented requirement to create the Supabase project in the region closest to the VPS; Redis cache absorbs public read traffic.
- R8: Dev/prod Postgres drift. Mitigation: local image pinned to the Supabase project's Postgres major version via `POSTGRES_IMAGE` (default `postgres:17-alpine`); no Supabase-only extensions used.

## Rollback

Greenfield: each phase is additive; rollback = revert that phase's commit. Production rollback = redeploy previous image tag (`IMAGE_TAG=<sha>` via deploy script / re-run previous pipeline's deploy job).
