# P06: Docs and end-to-end verification

Status: Completed
Depends on: P05
Wave: 5
Subagent: Not eligible — final integration gate
Owned scope: `README.md`, `docs/**`
Produces: Complete README and deploy docs; final verified end-to-end run

## Goal

Someone new can run the project locally and deploy it to a VPS + Supabase from the docs alone.

## Context

All previous phases. Docs in English (repo convention), no workflow references.

## Tasks

- [x] `README.md`: overview, architecture diagram (Mermaid), stack, layout, quick start (`cp .env.example .env && docker compose up -d --build`), native dev, scripts, testing, env variable reference, links to docs
- [x] `docs/git-flow.md`: `feature/*` from `master` → MR to `uat` (auto deploy UAT) → MR `uat` → `prod` (manual deploy PROD) → MR `prod` → `master` + tag; protected branches; hotfix path (`feature/hotfix-*` from `prod` → `prod`, then back-merge to `uat`/`master`)
- [x] `docs/deploy.md`: VPS prerequisites, `setup-server.sh`, DNS (`<domain>`, `uat.<domain>`), edge stack (Traefik) start, Supabase setup per environment (project in region near VPS, transaction pooler + session pooler URLs, `sslmode=require`), CI/CD variables table per environment scope and how to set them (`set-gitlab-vars.sh`), CI template repo + version bump procedure, first deploy UAT then PROD, rollback, backup of `uploads` volume and Redis, alternative deploy path when the server has no inbound SSH from the internet (self-hosted GitLab Runner on the server with shell executor + `production` tag, deploy job variant using that tag), interim `selfhost-db` mode and migration to Supabase (`pg_dump --no-owner --no-acl` → `psql $DIRECT_URL`, switch env, redeploy)
- [x] `docs/security.md`: secret handling (what is committed vs not, GitLab variable settings, gitleaks local + CI, `.env` permissions on VPS, `VITE_*` are public, secret rotation steps for JWT/Redis/DB/deploy token/SSH key, what to do if a secret leaks: rotate first, then purge history)
- [x] `docs/api.md`: API contract
- [x] Final end-to-end: clean clone → `docker compose up -d --build` → smoke flow from P04; all lint/test commands from both apps; compose config checks — clone of `feature/blog-mvp` at ebc326d: 4 services healthy, smoke flow all pass; lint/tests from clean archive in P05 notes; compose configs validated in P04

## Intended Logic

Docs mirror actual files; every env var documented matches `.env.example` / `deploy/.env.prod.example`.

## Touchpoints

All repo files (read-only except docs).

## Verification

- Follow README quick start in a fresh clone (`git clone . /tmp/...` equivalent under scratch) and complete smoke flow
- Cross-check env var names in docs vs example files (grep)

## Acceptance Gate

Fresh-clone run succeeds; docs consistent with code.

## Rollback or Recovery

Revert docs commit.

## Execution Notes

- Env var cross-check (grep of example files vs docs) found 8 undocumented local/pipeline variables → added README env table and a deploy.md note.
- Browser-level UI not exercised (no browser automation run); UI covered by component tests (MSW) and API smoke flow through Nginx.
