# L2M Blog — Agent Guide

`CLAUDE.md` only imports this file; edit `AGENTS.md`. Versions live in `*/package.json` and lockfiles, not here. `README.md` is the operator manual (features, deployment, usage); this file is the map for an agent.

## What this is

A Vietnamese blog: Vite + React SPA on GitHub Pages, data in Supabase (Postgres with row-level security, Auth with Google/GitHub, Storage for covers and avatars, one Edge Function for RSS/sitemap). There is no application server: the browser talks to PostgREST directly, and every rule lives in SQL (RLS policies, `security definer` RPCs, triggers). The earlier NestJS/VPS stack is gone; `deploy/`, `docker-compose.yml`, `frontend/Dockerfile`, `frontend/nginx/`, `.gitlab-ci.yml`, `docs/api.md`, `docs/deploy.md`, `docs/security.md` are leftovers from it and are not used.

## Project map

| Path | What | Read first |
| --- | --- | --- |
| `frontend/src/App.tsx` | Route tree (public, `/login`, `/write`, `/dashboard/*`, admin pages) | — |
| `frontend/src/api/` | `client.ts` (Supabase client, `ApiError`), `endpoints.ts` (`publicApi`, `adminApi`: every query and RPC call), `types.ts` | `endpoints.ts` |
| `frontend/src/pages/` | Pages; `admin/` holds dashboard pages; `PostPage.tsx` is the richest (likes, bookmarks, follow, series, read-aloud, reading prefs, comments) | — |
| `frontend/src/components/` | Shared UI (`Layout`, `Brand`, `PostCard`, `Status`, `Markdown`, `ReadAloud`, `ReadingPrefs`, `ThemeToggle`, …) | `Status.tsx` for the error/loading conventions |
| `frontend/src/lib/` | Pure helpers with unit tests (`theme`, `readingPrefs`, `speech`, `markdownText`, `fold`, `crop`, `autosave`, …) | — |
| `frontend/src/index.css` | Tailwind v4 entry: fonts, **all color tokens** (`:root`, `[data-theme='dark']`), status tokens, `.btn-*`, `.card`, `.pill`, `.meta`, reader size rules | yes, before any styling |
| `frontend/vite.config.ts` | CSP meta tag, `404.html` for SPA deep links, robots/RSS links | when touching hosting or external resources |
| `supabase/migrations/` | Schema, RLS, RPCs, triggers, in timestamp order; each file states its purpose at the top | the latest few before adding one |
| `supabase/tests/database/` | pgTAP suites, one per area; `functions_test.sql` holds the RPC allowlist | the suite of the area you change |
| `supabase/functions/feed/` | RSS + sitemap Edge Function | — |
| `scripts/` | `test-db-embedded.mjs` (PGlite + pgTAP, no Docker), admin grant/revoke SQL, `cleanup-unused-images.mjs` | — |
| `docs/ideas.md` | Done log by date, accepted direction, backlog, known gaps | yes |
| `plans/` | Plan bundles (workflow-record v4) for the `$plan`/`$execute` skills: `2026-11-23-no1-blog-monorepo` (everything so far, tracker `PLAN-20261123-blog-monorepo`), `2026-11-25-no1-audio`, `2026-11-25-no2-reading-prefs` | `index.md` + `evidence.md` of the monorepo bundle for history and machine notes |

## Workflows

- Checks (CI runs the same): `frontend/`: `npm run lint && npm run typecheck && npm test && npm run build`; repository root: `npm run db:test:embedded` (pgTAP in PGlite, no Docker) or `npm run db:test` (needs `npx supabase start`).
- Local stack: `npx supabase start && npx supabase db reset`, then `frontend/.env.local` from `.env.example` with the anon key of `npx supabase status`, `npm run dev`. Seed admin `admin@example.com` / `local-dev-admin-password`.
- Branching: one `feature/*` or `fix/*` branch per change, merged `--no-ff` into `main`, full check set after the merge. `main` on gitea.com (`hoang170702/blog-l2m`) is where work lands; GitHub Pages builds only from GitHub `main`, so pushing GitHub too is part of a release.
- Release = `npx supabase db push --remote` (migrations first, always) → push `main` to GitHub → Pages workflow. A frontend that queries a column the production database does not have yet shows the error box instead of posts.
- Commits: Conventional Commits, author `hoangkktt <huyhoang11202@gmail.com>` set per command. Never commit without the user's explicit approval in the conversation (see the global rules).

## Task routing

- Schema or rule change: new file via `npx supabase migration new <name>`; add or extend the matching pgTAP suite and bump its `plan(n)`; new tables `revoke all … from anon, authenticated` then grant exactly what is needed (projects have "auto-expose" off); new RPCs: `revoke execute … from public` then grant, add to the allowlist in `functions_test.sql`; `security definer` functions set `search_path = ''`.
- New page or feature: `endpoints.ts` + `types.ts` together with the migration; pages read through `useQuery` and show `<Spinner />`, `<ErrorMessage error onRetry={refetch} />`, `<Empty>`.
- Styling: tokens only (`primary`, `secondary`, `canvas`, `surface`, `ink`, `muted`, `line`, `danger`, `warning`, `success`, `on-primary`, `*-soft`). No Tailwind palette classes (`red-600`, `amber-50`): they break the dark theme. Text on a primary-colored surface is `text-on-primary`. Meta rows use the `.meta` class for the `·` separators.
- Fonts: self-hosted through `@fontsource` (CSP `font-src 'self'`), Vietnamese subset required; adding a reader font = package + `@import` + `[data-font]` block in `index.css` + row in `lib/readingPrefs.ts`.
- Dependencies: `npx npm@11 install <pkg>` inside `frontend/` (npm 10 fails on this lockfile). `npm audit --audit-level=high` must stay clean; two moderate build-time findings in `@tailwindcss/typography` are accepted.
- Docs after a change: `README.md` (features/usage), `frontend/README.md` (frontend internals), `docs/ideas.md` (Done entry + follow-ups), and the plan bundle (`evidence.md` action, `index.md` snapshot/checkpoint).

## Conventions and guardrails

- UI copy is Vietnamese; code, comments and docs are English.
- Public writes go through RPCs with rate limits (`submit_comment`, `report_content`, `record_post_view`); never grant table inserts to `anon`.
- Secrets never enter the repo or chat; the anon key and Supabase URL are public by design.
- Reading preferences and theme are device-local (`localStorage`), applied in `main.tsx` before the first render.
- Known gaps and deliberate non-fixes are listed in `docs/ideas.md` (security audit leftovers, data quirks like a `#` typed into a title).

## Reviews done so far (how to repeat them)

- Security: the `security-audit` skill over the repository (2026-11-25); fixes in migration `20261125160000_notification_limits.sql` and `lib/markdownText.ts`; leftovers in `docs/ideas.md` → Community safety.
- UI/UX: the evondev `ui-ux` skill (`github.com/evondev/evondevKit`, installed under `~/.kiro/skills/ui-ux` on machine B via `~/skill/agent-skills`). Its probe (`scripts/probe.mjs`, Playwright) was run against the live site and a local build of `main` (`npx vite build --outDir /tmp/evon-site` with the production `VITE_SUPABASE_*`, served by a tiny SPA static server). Behind a TLS-intercepting proxy, wrap Playwright so contexts use `ignoreHTTPSErrors`. Findings and fixes: `docs/ideas.md` 2026-11-25 entry and plan action A040.
