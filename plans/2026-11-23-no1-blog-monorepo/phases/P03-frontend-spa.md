# P03: Frontend SPA

Status: Completed
Depends on: P01
Wave: 2
Subagent: Eligible
Owned scope: `frontend/**`
Produces: React SPA consuming the API contract, tests, `frontend/Dockerfile` (build → Nginx), `frontend/nginx/default.conf` (HTTP only), npm scripts `dev`, `lint`, `test`, `build`

## Goal

Public blog UI and admin panel as a Vite React SPA, shipped as an Nginx image that also reverse-proxies the API.

## Context

Decisions D3, D5, D8, D9, D12. API contract in `plan.md`. Backend may not exist yet; develop against the contract (Vite dev proxy `/api` and `/uploads` → `http://localhost:3000`).

## Tasks

- [x] Scaffold Vite + React 19 + TypeScript strict; ESLint + Prettier; Tailwind CSS (+ typography plugin) — create-vite scaffold uses oxlint (kept) + Prettier; TypeScript 7
- [x] API client (`fetch` wrapper): base `/api`, `credentials: 'include'`, attach access token from in-memory store, on 401 call `/auth/refresh` once then retry, typed by contract types in `src/api/types.ts`
- [x] TanStack Query setup; React Router routes (react-router 8):
  - Public: `/` (list, pagination), `/category/:slug`, `/tag/:slug`, `/search?q=`, `/posts/:slug` (detail + approved comments + comment form showing "pending moderation" notice)
  - Admin: `/admin/login`, `/admin` (protected layout), `/admin/posts`, `/admin/posts/new`, `/admin/posts/:id/edit` (Markdown editor with live preview, category/tag pickers, cover image upload, status), `/admin/categories`, `/admin/tags`, `/admin/comments` (filter by status, approve/reject/delete)
- [x] Markdown render: `react-markdown` + `remark-gfm` + `rehype-sanitize` (no raw HTML), code highlighting
- [x] Image upload helper → `/api/admin/uploads`, insert `![](url)` into editor
- [x] Auth bootstrap on load: try `/auth/refresh` to restore session; protected route guard
- [x] Loading/error/empty states, 404 page, responsive layout, document titles
- [x] Tests (Vitest + Testing Library + MSW): API client refresh-retry, protected route redirect, post list render, comment form submit, markdown sanitization (script tag stripped)
- [x] Nginx config `nginx/default.conf` (HTTP only on port 80; TLS terminated by the Traefik edge proxy per E007/D18): SPA `try_files $uri /index.html`; `location /api/` → `http://backend:3000` with `X-Forwarded-*` passthrough; `location /uploads/` → alias `/usr/share/nginx/uploads/` with `nosniff`, long cache; `client_max_body_size 6m`; gzip; security headers (HSTS set at edge); long cache for hashed assets; `/healthz` returns 200
- [x] ~~`http-only.conf.template` + `NGINX_MODE` switch~~ — superseded by E007/D18 (no TLS in the image); no work
- [x] `frontend/Dockerfile`: multi-stage build → nginx; `.dockerignore` — build stage `node:22-slim` (TS 7 native binary needs glibc), runtime `nginx:1.29-alpine`

- [x] A-UI (2026-11-23): restyle inspired by meowmuc.com — ~~warm orange/purple~~ theme tokens (palette superseded by A-UI2: crimson red `#c8102e` + golden amber `#f2a900`), Epilogue + Plus Jakarta Sans (self-hosted @fontsource), glass sticky navbar, home hero, rounded card grid (featured first post) with cover images, pill tags, restyled post page/comments/404, admin recolor
- [x] A-UI2 (2026-11-23): site name "L2M Blog" (shared `Brand` component + `SITE_NAME`, navbar/footer/admin/login/document titles, `index.html`, own L2M monogram favicon, README heading); red/gold palette, no third-party logo or brand codes

## Intended Logic

Access token lives only in memory; refresh token is httpOnly cookie handled by backend. Same-origin deployment (Nginx serves SPA and proxies `/api`) so no CORS in prod.

## Touchpoints

Backend API contract; Nginx config consumed by P04 compose.

## Verification

- `npm ci && npm run lint && npm test && npm run build`
- `docker build -t blog-frontend ./frontend` succeeds; `nginx -t` inside image with `NGINX_MODE=http` passes

## Acceptance Gate

All commands pass; every route listed renders against mocked API; markdown XSS test passes.

## Rollback or Recovery

Remove `frontend/` or revert the phase commit.

## Execution Notes

- Library versions at execution: react 19.3, react-router 8.5, @tanstack/react-query 5, tailwindcss 4, vitest 5, msw 3 (`onUnhandledFrame: 'error'` replaces `onUnhandledRequest`), TypeScript 7.
- Admin pages and the post page are lazy-loaded: main chunk 254 kB (was 655 kB); highlight.js only loads with Markdown.
- Nginx resolves `backend` at request time via Docker DNS (`resolver 127.0.0.11`) so the web container can start before the backend; CSP set (`script-src 'self'`), `/uploads/` served with `default-src 'none'` CSP and `nosniff`.
- Checks run 2026-11-23: `npm run lint` pass (1 warning: react only-export-components on `useAuth` export, accepted); `npm test` 8/8 pass; `npm run build` pass; `docker build ./frontend` pass; `nginx -t` in image pass.
