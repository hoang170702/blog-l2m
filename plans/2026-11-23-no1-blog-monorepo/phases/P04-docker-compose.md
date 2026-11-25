# P04: Docker compose, edge proxy and environments

Status: Completed
Depends on: P02, P03
Wave: 3
Subagent: Not eligible — integrates both apps and runs stateful containers
Owned scope: `docker-compose.yml`, `deploy/docker-compose.yml`, `deploy/edge/docker-compose.yml`, `deploy/.env.example`, root `.env.example` (extend)
Produces: Working local stack on `http://localhost:8080`; one environment-agnostic app compose file used for both UAT and PROD (project name + env decide which); shared Traefik edge stack

Revised by E007 (D18): replaces the single-environment prod compose + certbot design. Superseded tasks: `deploy/docker-compose.prod.yml`, `deploy/.env.prod.example`, `deploy/scripts/init-letsencrypt.sh`, certbot service.

## Goal

One-command local stack, plus server-side compose files: an edge proxy shared by all environments and an app stack deployable as `blog-uat` and `blog-prod` on the same VPS.

## Context

Decisions D8, D13, D14, D18. Images from P02/P03; the frontend image's Nginx is HTTP-only.

## Tasks

- [x] `docker-compose.yml` (dev): `postgres` (`${POSTGRES_IMAGE:-postgres:17-alpine}`, volume, healthcheck), `redis` (`redis:7-alpine`, healthcheck), `migrate` one-off (backend image: `prisma migrate deploy` + seed), `backend` (depends on migrate completed + redis healthy, uploads volume), `web` (frontend image, port `8080:80`, uploads volume read-only). Postgres/Redis ports bound to `127.0.0.1` for native dev.
- [x] `deploy/edge/docker-compose.yml`: Traefik v3 (pinned), ports 80/443, HTTP→HTTPS redirect, ACME HTTP-01 resolver `le` with `${ACME_EMAIL}`, `acme.json` volume, Docker provider with `exposedByDefault=false`, external network `edge`, read-only Docker socket mount, dashboard disabled, access log on. — Traefik `v3.7`; Docker API reached through `tecnativa/docker-socket-proxy:3.4` (containers/networks read-only, internal network) instead of mounting the socket into Traefik; ports overridable (`EDGE_HTTP_PORT`/`EDGE_HTTPS_PORT`) for local simulation.
- [x] `deploy/docker-compose.yml` (app, per environment): images `${REGISTRY_IMAGE}/backend:${IMAGE_TAG}` and `/frontend:${IMAGE_TAG}`; services `backend` (internal network only), `redis` (`--requirepass ${REDIS_PASSWORD}`, AOF, no published port), `web` (joins `edge` + internal network, Traefik labels with router name `${COMPOSE_PROJECT_NAME}` and rule `Host(\`${APP_DOMAIN}\`)`, TLS resolver `le`, `traefik.docker.network=edge`); optional `postgres` under profile `selfhost-db`; `restart: unless-stopped`; log rotation; volumes named per project automatically.
- [x] `deploy/.env.example`: documents every key the deploy job renders (`COMPOSE_PROJECT_NAME`, `REGISTRY_IMAGE`, `IMAGE_TAG`, `APP_DOMAIN`, `DATABASE_URL`, `DIRECT_URL`, `REDIS_PASSWORD`, `JWT_*`, `ADMIN_*`, `CORS_ORIGIN`, `COMPOSE_PROFILES`) with Supabase pooler examples; placeholders only.
- [x] Extend root `.env.example` with compose variables.

## Intended Logic

Same images in every environment; behavior switched only by env. Multiple app stacks coexist because compose project names isolate containers, networks and volumes, and Traefik routes by host.

## Verification

- `docker compose config -q` (dev); `docker compose -f deploy/docker-compose.yml --env-file deploy/.env.example config -q` (with and without `COMPOSE_PROFILES=selfhost-db`); `docker compose -f deploy/edge/docker-compose.yml config -q`
- `docker compose up -d --build` → healthy; smoke flow at `http://localhost:8080` (login, CRUD, upload, publish, comment, approve, cache keys present)
- Local two-environment simulation: edge stack with a local-only HTTP entrypoint + two app projects (`blog-uat`, `blog-prod`) using `Host(uat.localhost)` / `Host(prod.localhost)` → both respond via `curl -H Host:`; isolated Redis/volumes (`docker volume ls`)

## Acceptance Gate

Local stack passes the smoke flow; two app projects run side by side behind the edge proxy; all compose files validate.

## Rollback or Recovery

`docker compose down -v` per project; revert phase commits.

## Execution Notes

- Traefik labels use list form: compose does not interpolate `${...}` inside label map keys (found via `docker compose config`).
- Bug found by smoke flow: shared `uploads` volume got root ownership when the nginx container mounted it first → backend EACCES (500) on upload. Fix: frontend image creates `/usr/share/nginx/uploads` owned by uid 1000 (separate fix commit).
- Checks run 2026-11-23: `docker compose config -q` for dev, app (with/without `selfhost-db`), edge → pass. Dev stack `docker compose up -d --build` → postgres/redis/backend/web healthy; smoke script (home, health, login, category, tag, upload + served as image/png, publish post with cover, tag filter, detail, comment, approve, approved list, refresh via cookie) → all pass; Redis `cache:posts:*` keys present.
- Two-environment simulation: edge on 8081/8443 (port 80 busy on this host), `blog-uat` + `blog-prod` with `selfhost-db`, locally tagged images → both `https://<env>.localhost:8443/api/health` ok, HTTP→HTTPS 301, HSTS header, separate volumes, PROD shows 0 posts while UAT has smoke data; rate limit counts the real client IP through Traefik + Nginx and a spoofed `X-Forwarded-For` does not bypass it. ACME errors expected (staging CA, `.localhost`). Smoke script kept in session scratchpad, not committed.
