# Verification

## Phase-local

- P01: `git check-ignore plans/`; no secrets tracked.
- P02: `npm ci && npm run lint && npm test && npm run build`; `npm run test:e2e` with Postgres + Redis; `prisma migrate deploy` on fresh DB; seed idempotent.
- P03: `npm ci && npm run lint && npm test && npm run build`; `docker build ./frontend`; `nginx -t` in image.
- P04: compose `config -q` (dev, prod, prod + `selfhost-db`); local stack healthy; smoke flow; shellcheck.
- P04 (revised E007): + edge stack config check; two-environment local simulation.
- P05 (revised E007): template + app YAML validation; shellcheck; secret-echo grep; local deploy simulation with `.env` mode 600.
- P06: fresh-clone quick start; docs/env consistency grep.
- P07: projects/branches/protections/environments/variables verified via `glab`; MR pipeline green; GitLab CI Lint on app config (include resolution).

## Wave Integration

- Wave 2 → 3: frontend contract types match backend responses (checked in P04 smoke flow).
- Wave 3 → 4: images and compose used by CI are the same as validated locally.

## Regression

Greenfield; no prior behavior. Each later phase reruns both apps' lint/test.

## Final End-to-End

- [x] Fresh clone → `docker compose up -d --build` → smoke flow (login, CRUD, upload, publish, comment, moderate, cache hit) — fresh clone at ebc326d: 4 services healthy, smoke script all pass (P06). Later commits verified by unit/e2e + real GitLab MR pipelines.
- [x] Rate limit: 6th login attempt within a minute → 429 — e2e test + behind Traefik/Nginx simulation (P04)
- [x] Markdown `<script>` not executed in rendered post — frontend test `Markdown.test.tsx` (script/img onerror/javascript: stripped); CSP `script-src 'self'`
- [x] Upload of a non-image renamed `.png` → 400 — e2e test
- [x] `gitleaks git .` on the final history → no findings; `git ls-files | grep -E '(^|/)\.env($|\.)' ` lists only example files — app repo (all refs) and template repo: no leaks; tracked env files: `.env.example`, `deploy/.env.example`; `deploy/vars/` untracked
- [x] simplify pass on the complete current-session change scope — see evidence.md "Simplify pass" (fixes 298089e, 5ec1615, cb90fb5, ca58eae; template f97f02d / v1.0.1)
- [x] Code review (user workflow) — 3 findings fixed (77e4543, bdd7533, 56c57e9)
- [x] Security audit (user workflow) — 1 Low verified + 1 functional fixed (a50196c, 0e49eb9); hardening observations recorded
- [x] Real GitLab MR pipelines: 3101077811 (success), 3101086364 (success, templates v1.0.1); latest push 0e49eb9 → see evidence E018

## Skipped Checks / Residual Risks

- Real VPS deploy, real Let's Encrypt issuance (Traefik), real Supabase connection: not executable without the user's server, domain and Supabase projects; covered by local simulation (edge + two stacks, deploy job with ssh shims) and docs. The `uselibpqcompat=true&sslmode=require` URL was verified only at parse level.
- Registry login + pull path of `deploy.sh` not exercised (local images with `SKIP_LOGIN=1`); `build:*` and `deploy:*` CI jobs have never run (they run only on `uat`/`prod`).
- R4 (A029–A038, 2026-11-25, machine B): after each merge into `main`: `npm run db:test:embedded` (final 190 assertions, 11 suites), frontend `typecheck`, `lint` (2 pre-existing `only-export-components` warnings), `npm test` (final 59 tests, 15 files), `build`. `npm audit --audit-level=high` clean (2 moderate build-time findings in `@tailwindcss/typography`'s `postcss-selector-parser`). Not run: browser smoke of any R4 page, Edge Function `feed`, real IP/user-agent capture (local requests carry no proxy headers → `unknown`), `kiro-simplify` over `6f99253..HEAD`.
- Security-audit fixes (A039, 2026-11-25, machine B, `fix/security-audit` → `main`): pgTAP 195 assertions / 11 suites (notifications 13, profanity 26; the 5 new cases fail when the migration is removed), typecheck, lint clean, vitest 69 tests / 17 files (new adversarial-input case: 5.4 s on the old regexes, 23 ms fixed), build. Not run: browser smoke; the migration's dedupe `delete` on a database with existing duplicate notifications (local test data has none).
- A024-A026 (F1-F3): `npm run db:test:embedded` 55/55 (adds search migration checks); 15 frontend tests from this session pass with a scratch vitest config (see A027); typecheck, lint, build pass. Not run: the repo's `npm test` (broken config), browser smoke, Storage removal against a real Supabase.
- D38 author-only edits (A021): `npm run db:test:embedded` 50/50, new assertions shown to fail without the migration; frontend typecheck/lint/build pass; browser smoke pending (machine A).
- D37 cover crop (A020): `coverCrop` unit tests and Markdown test pass via a scratch vitest config; repo `npm test` still broken at startup; browser upload untested.
- P12 GitHub sign-in (A019): same limits as Google below; only config validation checked on machine B.
- P12 Google sign-in (A018): only CLI 3.2.0 config validation was checked on machine B; auth container start with an empty Google client ID and the real OAuth round trip are unverified until machine A step 6.
- `setup-server.sh` not executed on a real Ubuntu host (shellcheck only).
- Browser-level UI not exercised end-to-end; component tests (MSW) and API smoke through Nginx cover behavior.
- `npm audit`: 3 high via `effect` inside the Prisma CLI config parser (not request-reachable).
