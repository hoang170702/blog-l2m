# P07: GitLab remote setup

Status: Completed
Depends on: P05
Wave: 5
Subagent: Not eligible — external side effects on the user's GitLab account
Owned scope: GitLab projects `NguyenHuyHoang170702/cicd-templates` and `NguyenHuyHoang170702/blog-l2m` (settings, branches, protections, environments, variables, deploy token); git remotes of both local repos
Produces: Both projects on gitlab.com with code pushed, git flow branches protected, environments and variables configured, first pipelines run on available branches

Added by E007 (D16, D17, D19, D20). Requires `glab` installed and authenticated by the user (Q8 = glab + auth login).

## Goal

The GitLab side is ready: pushing a `feature/*` branch runs CI; merging into `uat`/`prod` deploys once the user fills in server/Supabase values.

## Tasks

- [x] Verify `glab auth status` for gitlab.com and the namespace `NguyenHuyHoang170702` (user id 20192628; no token env overrides)
- [x] Create private project `cicd-templates`; push `main`; validate the app config's include through GitLab CI Lint, then create and push tag `v1.0.0` (moved from P05 so the tag never has to move) — id 89325896; v1.0.0 → 7e8383d; simplify fix released as v1.0.1 → f97f02d
- [x] Create private project `blog-l2m`; push `master` (bootstrap commit, local `main` renamed/pushed as `master`), create `uat` and `prod` from `master`; set default branch `master` — id 89325897; local `main` pushed as `master` (not renamed locally)
- [x] Allow `blog-l2m` CI job token to read `cicd-templates` if required by include (job token allowlist) — include by `project:` uses the pipeline user's permissions; verify — not needed: MR pipeline resolved the include and passed
- [x] Protect `master`, `uat`, `prod`: push = no one, merge = maintainers; MR setting "pipelines must succeed" — also "all discussions resolved"; force push off
- [x] Create environments `uat` and `production` — ids 43515448 (staging tier), 43515450
- [x] Create project deploy token (`read_registry`) → variables `DEPLOY_REGISTRY_USER`/`DEPLOY_REGISTRY_PASSWORD` (never printed) — token 17417664, scope `*`
- [x] Generate and set random secrets per environment (JWT access/refresh, Redis password, admin password) via `set-gitlab-vars.sh --generate`; user-owned values (Supabase URLs, `DEPLOY_HOST`, `DEPLOY_USER`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `APP_DOMAIN`, `ADMIN_EMAIL`, `ACME_EMAIL`) left for the user with exact instructions — not invented — JWT + Redis generated per env; ADMIN_PASSWORD left to the user (a generated hidden value could not be read back); user-owned list handed over in the final report
- [x] Push `feature/blog-mvp` and open MR → `uat` (CI runs scan/lint/test); do not merge (merge = deploy, requires the user's server values) — [MR !1](https://gitlab.com/NguyenHuyHoang170702/blog-l2m/-/merge_requests/1)
- [x] Validate pipeline config through GitLab CI Lint (`glab ci lint`) on the app repo — via `POST projects/89325897/ci/lint` (valid, 5 includes)

## Verification

- `glab repo view` for both projects; branch protection and environment lists via `glab api`; variable list shows keys/scopes only
- MR pipeline for `feature/blog-mvp` passes (or failures recorded and fixed)

## Acceptance Gate

Both projects exist with expected settings; MR pipeline green; remaining user-owned variables listed for the user.

## Rollback or Recovery

Projects can be deleted/archived by the user; variables and tokens revocable; nothing is deployed in this phase.

## Execution Notes
