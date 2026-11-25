# P11: Remove the old stack and rewrite docs

Status: In progress (backend/ removed in A015; rest pending)
Depends on: P10
Wave: 9
Subagent: Not eligible — repo-wide deletions
Owned scope: `backend/`, `deploy/`, `docker-compose.yml`, `.env.example`, `README.md`, `docs/**`, `AGENTS.md`
Produces: Repository containing only the Supabase + Pages architecture, with accurate docs

Covers the planned P12 of revision R2.

## Tasks

- [~] Delete `backend/`, `deploy/`, root `docker-compose.yml` (history keeps them) — `backend/` deleted (c1eca3c); `deploy/`, `docker-compose.yml`, `frontend/Dockerfile`, `frontend/nginx/` still reference it and no longer build
- [ ] Root `.env.example` → frontend/Supabase local values only
- [ ] README: architecture (Pages + Supabase), local dev (`npx supabase start`, `npm run dev`), checks
- [ ] Docs: `docs/data-model.md` (tables, RLS, RPC, storage) replacing `docs/api.md`; `docs/deploy.md` (Supabase projects, admin user creation, GitLab variables, Pages, UAT project); `docs/security.md`; `docs/git-flow.md` updates
- [ ] Agent docs (`AGENTS.md`) updated to the new layout
- [ ] Final checks: fresh clone → `supabase start` → `npm run dev` smoke; gitleaks; simplify/code-review/security-audit on the R2 diff

## Rollback or Recovery

Revert commits.

## Execution Notes
