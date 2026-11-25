# P02: Backend API

Status: Completed
Depends on: P01
Wave: 2
Subagent: Eligible
Owned scope: `backend/**`
Produces: NestJS API implementing the API contract in `plan.md`, Prisma schema + migrations + seed, unit and e2e tests, `backend/Dockerfile`, npm scripts `lint`, `test`, `test:e2e`, `build`, `start:prod`, `prisma:migrate:deploy`, `seed`

## Goal

A production-ready NestJS API for the blog, Supabase-ready via Prisma `DATABASE_URL`/`DIRECT_URL`.

## Context

Decisions D2, D5, D6, D7, D8, D12, D13, D14 in `decisions.md`. API contract and data model in `plan.md`.

## Tasks

- [x] Scaffold NestJS 11 app in `backend/` (Node 22, TypeScript strict), ESLint + Prettier, global prefix `/api`
- [x] Config module with env validation (zod or class-validator): fail fast on missing `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, JWT secrets
- [x] Prisma: schema per data model, `directUrl`, initial migration, `PrismaService`; seed script creating admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (idempotent upsert) plus sample category/tag/post in dev only
- [x] Redis module (ioredis) shared by cache, throttler storage and refresh tokens
- [x] Auth module: login (argon2 verify), access JWT 15m, refresh token rotation in Redis + httpOnly cookie, logout, `me`; `JwtAuthGuard` + `RolesGuard(ADMIN)`
- [x] Throttler with Redis storage: global 100/min; `@Throttle` login 5/min, comment 3/min
- [x] Posts: public list (pagination, category/tag slug filter, `q` ILIKE on title), detail by slug; admin CRUD with slug generation (unique, slugify + suffix), `publishedAt` set on first publish
- [x] Categories and tags: public list, admin CRUD; deleting a category nulls posts' `categoryId`
- [x] Comments: public submit (validated, length limits, PENDING), public list APPROVED; admin list/moderate/delete
- [x] Cache: post list/detail read-through in Redis (D7); invalidation on post/category/tag/comment-approval writes
- [x] Uploads: multer memory storage, 5 MB limit, `file-type` magic-byte check (jpeg/png/webp/gif), save `uploads/<uuid>.<ext>` to `UPLOAD_DIR`, return `/uploads/<file>`
- [x] Security: helmet, CORS from `CORS_ORIGIN` with credentials, `ValidationPipe({whitelist, forbidNonWhitelisted, transform})`, `cookie-parser`, trust proxy
- [x] Health endpoint checking DB (`SELECT 1`) and Redis (`PING`)
- [x] Tests: unit for auth service, slug util, cache invalidation, upload validation; e2e (supertest) against real Postgres + Redis from env covering the contract's main flows and 401/403/404/429
- [x] `backend/Dockerfile`: multi-stage (deps → build → runtime `node:22-alpine`, non-root user, `prisma generate`, includes `prisma/` for migrate deploy), `HEALTHCHECK` on `/api/health`; `.dockerignore`

## Intended Logic

Modules: `config`, `prisma`, `redis`, `auth`, `users`, `posts`, `categories`, `tags`, `comments`, `uploads`, `health`. Controllers split `public` vs `admin` routes. Migrations are never run automatically at app startup in prod; `prisma migrate deploy` runs as a one-off (P05 deploy script) using `DIRECT_URL`.

## Touchpoints

Postgres (local or Supabase), Redis, upload directory volume, frontend via API contract.

## Verification

- `npm ci && npm run lint && npm test && npm run build`
- `npm run test:e2e` with Postgres + Redis running (temporary `docker run` containers or P04 compose)
- `npx prisma migrate deploy` on a fresh DB succeeds; seed is idempotent (run twice)

## Acceptance Gate

All commands above pass; every endpoint in the API contract exists with the documented shape and auth rules.

## Rollback or Recovery

Remove `backend/` (greenfield) or revert the phase commit.

## Execution Notes

- Deviations (routine, E002/E006): NestJS 12 (latest) instead of 11; Vitest + oxlint + Prettier (scaffold defaults) instead of Jest + ESLint; `RolesGuard(ADMIN)` implemented as `AdminGuard extends JwtAuthGuard`; Prisma 7.10 has no `directUrl` → `prisma.config.ts` uses `DIRECT_URL`, runtime `PrismaPg` adapter uses `DATABASE_URL`; `@node-rs/argon2` instead of `argon2` (prebuilt binaries, no node-gyp in Docker); own `RedisThrottlerStorage` (Lua fixed window) instead of a third-party storage package; comment approval does not invalidate post cache because comments are not cached.
- Unit tests cover slug, env validation, upload magic-byte detection; auth rotation/reuse revocation, cache invalidation, rate limits, access control, upload rejection are covered by e2e (17 tests) against real Postgres 17 + Redis 7 containers (`blogdev-pg`, `blogdev-redis`).
- Checks run 2026-11-23: `npm run lint` (oxlint + prettier) pass; `tsc --noEmit` pass; `npm test` 8/8 pass; `npm run test:e2e` 17/17 pass; `docker build ./backend` pass (image 788 MB, non-root `node`, health ok on `/api/health`, `prisma migrate deploy` works offline from bundled CLI); `npm ci` with npm 10 works on the lockfile.
- `npm audit --omit=dev`: 3 high via `effect` (ReDoS GHSA-7589-6fvf-x4pw) inside Prisma CLI config parsing; not reachable from request input; fix only via Prisma 6 downgrade → accepted residual risk.
- Commits: see evidence.md Commits (backend API, Dockerfile, docs as separate commits).
