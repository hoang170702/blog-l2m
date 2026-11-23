# Blog — Agent Guide

`CLAUDE.md` only imports this file; edit `AGENTS.md`. Versions live in `*/package.json`, lockfiles, Dockerfiles and compose files, not here.

## Project Map

| Path | What | Read first |
| --- | --- | --- |
| `backend/` | NestJS REST API (`/api`), Prisma, Redis | `backend/AGENTS.md`, `backend/src/app.module.ts`, `backend/prisma/schema.prisma` |
| `frontend/` | Vite + React SPA, served by Nginx in its image | `frontend/src/App.tsx`, `frontend/src/api/` |
| `frontend/nginx/default.conf` | Serves the SPA, proxies `/api/` to `backend:3000`, serves `/uploads/` | — |
| `docker-compose.yml` | Local stack (postgres, redis, migrate, backend, web on :8080) | — |
| `deploy/docker-compose.yml` | One server environment (`blog-uat` / `blog-prod`), Traefik labels | `docs/deploy.md` |
| `deploy/edge/` | Shared Traefik + Let's Encrypt + read-only Docker socket proxy | `docs/deploy.md` |
| `deploy/scripts/` | `deploy.sh` (runs on the server), `setup-server.sh`, `set-gitlab-vars.sh` | script headers |
| `.gitlab-ci.yml` | Only `include:`s the pipeline from the `NguyenHuyHoang170702/cicd-templates` project at a pinned tag | `docs/git-flow.md` |
| `docs/` | API contract, git flow, deployment, security | — |

`backend/src/generated/` (Prisma client) and `*/dist/` are generated: do not edit.

## Common Workflows

- Whole stack: `cp .env.example .env && docker compose up -d --build` → http://localhost:8080 (`/admin`).
- Data services only for native dev: `docker compose up -d postgres redis`.
- Per app (`backend/`, `frontend/`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; backend also `npm run test:e2e` (needs local Postgres + Redis; it truncates all tables).
- CI runs exactly these scripts plus gitleaks; keep script names stable (the shared template calls them).

## Task Routing

- API change: update `docs/api.md` and `frontend/src/api/types.ts` + `frontend/src/api/endpoints.ts` together with the backend DTOs.
- Schema change: `npx prisma migrate dev --name <name>` in `backend/`; never run migrations at app start (`deploy.sh` runs `prisma migrate deploy` before replacing containers).
- New server env var: add it to `deploy/docker-compose.yml`, `deploy/.env.example`, the `env_required`/`env_optional` input in `.gitlab-ci.yml` if the default list lacks it, and `docs/deploy.md`.
- Pipeline change: edit the `cicd-templates` project, tag a new version, then bump `ref` in `.gitlab-ci.yml`. Never move an existing tag.

## Conventions And Guardrails

- Git flow: branch `feature/*` from `master` → MR into `uat` (auto-deploys UAT) → MR `uat` → `prod` (manual deploy) → MR `prod` → `master`. `master`/`uat`/`prod` are protected; never push to them directly.
- Secrets: only `*.example` files are committed; real values are protected, environment-scoped GitLab CI/CD variables. gitleaks blocks commits and pipelines. `VITE_*` values are public.
- Adding or updating npm dependencies needs npm 11 (`npx npm@11 install <pkg>`); npm 10 fails with `Cannot read properties of null (reading 'edgesOut')`. `npm ci` works with either.
- The frontend build needs a glibc image (`node:*-slim`): the native TypeScript compiler has no musl binary.
- The `uploads` volume is shared by `backend` (writes, uid 1000) and `web` (read-only); keep the mount point in `frontend/Dockerfile` owned by uid 1000.
- Supabase runtime `DATABASE_URL` needs `uselibpqcompat=true&sslmode=require` (node-postgres otherwise verifies against public CAs and fails); `DIRECT_URL` (Prisma CLI) uses plain `sslmode=require`.
- Server `.env` values are single-quoted by the deploy job; values must not contain `'` or newlines.
