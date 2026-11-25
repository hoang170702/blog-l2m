# P01: Repo foundation

Status: Completed
Depends on: None
Wave: 1
Subagent: Not eligible — creates shared root files and the git repo
Owned scope: `.git/`, `.gitignore`, `.editorconfig`, `.env.example`, `.pre-commit-config.yaml`, `.gitleaks.toml`, `README.md` (skeleton)
Produces: Initialized git repo on branch `main` with root conventions; `/plans/` ignored

## Goal

Initialize the monorepo so P02/P03 can add `backend/` and `frontend/` independently.

## Context

Workspace `/home/hoangkktt/workspaces/blog-l2m` is empty and not a git repo. User git rules: Conventional Commits, no attribution trailers, no `claude`/`agent` in branch names.

## Tasks

- [x] `git init -b main` (A001; bootstrap commit c6e842a on `main`, work on `feature/blog-mvp` worktree)
- [x] `.gitignore`: `/plans/`, `node_modules/`, `dist/`, `coverage/`, `.env`, `.env.*` (keep `!.env.example`, `!deploy/.env.prod.example`), `backend/uploads/`, `*.log`, `.DS_Store`, `.idea/`, `.vscode/` (except shared settings if any) — also `/.worktrees/`
- [x] `.editorconfig`: utf-8, lf, 2 spaces, final newline
- [x] `.pre-commit-config.yaml` with the official gitleaks hook (pinned rev) + `.gitleaks.toml` extending the default ruleset with an allowlist for `*.example` placeholder values; README notes `pipx install pre-commit && pre-commit install` — note: allowlist for example files intentionally dropped (examples must stay scanned; placeholders use `change-me`)
- [x] `.env.example` (root, dev): `POSTGRES_IMAGE`, `POSTGRES_USER/PASSWORD/DB`, `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGIN`
- [x] `README.md` skeleton: project summary, stack, directory layout (filled out in P06)
- [x] Initial commit `chore: initialize monorepo` (only when execution is authorized to commit) — done as de03abc `chore: add repository conventions and secret scanning config`

## Intended Logic

Root holds only cross-cutting files; each app owns its tooling.

## Touchpoints

Root files listed in Owned scope.

## Verification

- `git status` clean after commit; `git check-ignore plans/ .env` prints both.
- `gitleaks git .` (or `docker run --rm -v $PWD:/repo zricethezav/gitleaks git /repo`) reports no leaks; a test commit containing a fake AWS-style key is blocked by the pre-commit hook (then discarded).

## Acceptance Gate

Repo initialized on `main`, `/plans/` ignored, no secrets tracked.

## Rollback or Recovery

`rm -rf .git` and the created root files (greenfield).

## Execution Notes

- Verified: `git check-ignore` matches `.env`, `.env.local`, `backend/uploads/x`; `.env.example` not ignored. gitleaks v8.30.1 (Docker) `dir` scan of worktree → "no leaks found"; planted fake token file in scratch dir → "leaks found: 1". Pre-commit hook itself not exercised (pre-commit not installed locally); same gitleaks rules verified via Docker.
