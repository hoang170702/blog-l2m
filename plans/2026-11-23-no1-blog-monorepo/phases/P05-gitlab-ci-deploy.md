# P05: CI/CD template repo, app pipeline and deploy scripts

Status: Completed
Depends on: P04
Wave: 4
Subagent: Not eligible — depends on final image and compose layout; creates a second repository
Owned scope: new repo `/home/hoangkktt/workspaces/cicd-templates/**`; app repo `.gitlab-ci.yml`, `deploy/scripts/deploy.sh`, `deploy/scripts/setup-server.sh`, `deploy/scripts/set-gitlab-vars.sh`
Produces: Versioned CI templates (tag `v1.0.0`, local), app pipeline that only includes them, deploy/server/variable scripts

Revised by E007 (D16, D17, D19): replaces the single in-repo pipeline and single `PROD_ENV_FILE` variable.

## Goal

Reusable CI/CD templates in their own repo; the app pipeline implements the git flow `feature/* → uat → prod → master` with environment-scoped secrets.

## Context

Decisions D15 (gitleaks, file permissions), D16, D17, D18, D19. Remote push happens in P07.

## Tasks

- [x] Create local repo `/home/hoangkktt/workspaces/cicd-templates` (`git init -b main`), README describing each template, inputs, required variables, versioning policy (semver tags, consumers pin `ref`) — plus CHANGELOG.md
- [x] `templates/jobs/secret-scan.yml`: hidden job `.secret-scan` (gitleaks image pinned, `GIT_DEPTH: 0`, `--redact`, JSON report artifact)
- [x] `templates/jobs/node.yml`: `.node-lint`, `.node-test` with inputs-driven working dir, npm 11 cache keyed on lockfile, JUnit/coverage artifacts — deviation: `.node-base` + `.node-lint`; test jobs live in the pipeline template (backend needs services); cache key `npm-$APP_DIR` (download cache only; `cache:key:files` cannot expand `$APP_DIR`); stock npm (`npm ci` works with npm 10); no JUnit/coverage artifacts (not needed for the gates)
- [x] `templates/jobs/docker-build.yml`: `.docker-build` (docker + dind pinned, login via `CI_JOB_TOKEN` with `--password-stdin`, `--cache-from`, push `:$CI_COMMIT_SHORT_SHA` and `:$CI_COMMIT_REF_SLUG`) — `docker:29` + `docker:29-dind`, login with `CI_REGISTRY_PASSWORD` (job token)
- [x] `templates/jobs/deploy-compose-ssh.yml`: `.deploy-compose-ssh` (alpine + openssh-client; ssh-agent from File var `SSH_PRIVATE_KEY`; `SSH_KNOWN_HOSTS` strict checking; copies compose file + deploy script; renders `.env` remotely under `umask 077` from an allowlist input of variable names via `printf '%s=%s\n'`, never echoing values, no `set -x`; runs `deploy.sh <tag>`; `resource_group: $CI_ENVIRONMENT_NAME`) — values written single-quoted (no compose interpolation); `'`/newline values and missing required vars fail without printing values; `resource_group` set in the pipeline template
- [x] `templates/fullstack-compose.yml` with `spec:inputs` (`backend_dir`, `frontend_dir`, `compose_file`, `deploy_script`, `env_allowlist`, `node_image`): stages `scan → lint → test → build → deploy`; `workflow:rules` (MRs, `uat`, `prod`, `master`, tags; no duplicate branch+MR pipelines); MR/`feature/*`: scan+lint+test; `uat`: + build + `deploy:uat` (auto, `environment: uat`); `prod`: + build + `deploy:production` (`when: manual`, `environment: production`); `master`/tags: scan+lint+test (release record) — inputs also include `postgres_image`, `redis_image`, branch names, `uat_project_name`, `prod_project_name`, `env_required`/`env_optional` (replace `env_allowlist`)
- [x] Validate templates (GitLab CI Lint API via `glab ci lint` once authenticated; otherwise yaml lint) and tag `v1.0.0` locally — YAML parsed locally; every job script executed in containers (see notes). GitLab CI Lint of the include + tagging `v1.0.0` moved to P07 (lint needs the remote project; tagging only after it passes so the tag never moves)
- [x] App repo `.gitlab-ci.yml`: only `include: - project: NguyenHuyHoang170702/cicd-templates, ref: v1.0.0, file: /templates/fullstack-compose.yml, inputs: {...}`
- [x] `deploy/scripts/deploy.sh <tag>` (`set -euo pipefail`): refuse if `.env` mode is not 600; registry login with deploy token from `.env`; `docker compose pull`; one-off `prisma migrate deploy` (abort on failure, old version keeps running); `up -d --remove-orphans`; health wait ≤ 60 s, logs + non-zero exit on failure; `.deployed-tags` history; image prune — also runs the idempotent admin seed; `--wait-timeout 120`
- [x] `deploy/scripts/setup-server.sh` (root, Ubuntu): Docker Engine + compose plugin, `deploy` user in `docker` group, `/opt/edge`, `/opt/blog-uat`, `/opt/blog-prod` (owner `deploy`, mode 700), external network `edge`, SSH hardening (key-only, no root login), UFW 22/80/443, unattended-upgrades — takes `DEPLOY_PUBKEY` for authorized_keys
- [x] `deploy/scripts/set-gitlab-vars.sh <env>`: reads a gitignored local file `deploy/vars/<env>.env` and sets each key as an environment-scoped, protected (masked+hidden where possible) project variable through `glab variable set`; values never printed; `--generate` fills JWT/Redis/admin secrets from `openssl rand` — flag `--generate-secrets` fills JWT + Redis only (a generated hidden admin password could never be read back); `*_FILE` keys become File variables (SSH key); values via stdin; template `deploy/vars.example.env`
- [x] Rollback documented: `./deploy.sh <previous-tag>` or re-run an older pipeline's deploy job — in deploy.sh header; full docs in P06

## Intended Logic

Templates are generic; app-specific details enter via `inputs`. Secrets exist only as environment-scoped protected variables, so feature-branch pipelines cannot read them. Migrations run before containers are replaced.

## Verification

- Template + app YAML: `glab ci lint` (after P07 auth) or yaml lint fallback; `include` resolution validated through GitLab CI Lint API in P07
- `shellcheck` (Docker image) on all scripts
- Grep confirms no `set -x` / `echo`/`cat` of secret variables in templates
- Local deploy simulation of `deploy.sh` against locally built images (`SKIP_LOGIN=1`, `COMPOSE_PROFILES=selfhost-db`) → healthy; `.env` mode 600 enforced

## Acceptance Gate

Templates and app pipeline validate; scripts pass shellcheck; deploy simulation succeeds.

## Rollback or Recovery

Revert commits in either repo; production rollback via `./deploy.sh <previous-tag>`.

## Execution Notes

- CI simulation from a clean `git archive HEAD` in `node:22-slim` with Postgres 17 + Redis 7 service containers (network aliases `postgres`, `redis`): backend lint + typecheck + migrate + 8 unit + 17 e2e pass; frontend lint + typecheck + 8 tests + build pass (after formatting fix commit). This run found the missing `backend/src/uploads` (E013) and a Prettier drift in `Layout.tsx`.
- Prisma prints `failed to detect the libssl/openssl version` on `node:22-slim`; migrations still apply (warning only).
- gitleaks: `git . --log-opts=--all` on the main repo → no leaks (603 KB scanned); template repo → no leaks.
- shellcheck (koalaman/shellcheck:stable) on deploy.sh, setup-server.sh, set-gitlab-vars.sh → clean.
- Deploy simulation: the `.deploy-compose-ssh` script block extracted from the YAML ran in `docker:29-cli` with ssh/scp shims against the local `blog-uat` stack: compose file + deploy.sh copied, `.env` mode 600 (dir 700), migrations + seed, containers healthy with new tag, `.deployed-tags` updated; `$` and `&` in values preserved inside the container; value with `'` → rejected; missing required var → rejected; `deploy.sh sim` rollback works; `.env` mode 644 → refused. Registry login path not exercised (`SKIP_LOGIN=1`; real registry in P07/first deploy).
- Not run: setup-server.sh on a real Ubuntu host; set-gitlab-vars.sh (runs in P07).
