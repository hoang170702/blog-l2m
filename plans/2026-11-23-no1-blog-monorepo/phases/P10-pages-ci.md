# P10: GitLab Pages hosting and CI template v2

Status: Pending
Depends on: P09
Wave: 8
Subagent: Not eligible — two repositories and remote side effects
Owned scope: `/home/hoangkktt/workspaces/cicd-templates/templates/spa-pages-supabase.yml` (+ README/CHANGELOG, tag v2.0.0); app `.gitlab-ci.yml`; GitLab project `NguyenHuyHoang170702/blog-l2m-uat`, deploy key, CI/CD variables
Produces: Pipeline: scan → lint/test/build → db test → migrate → Pages deploy (UAT via push to blog-l2m-uat, PROD via `pages` job on `prod`)

Runs on machine A only (A011): needs gitlab.com auth and the cicd-templates checkout.

Merges the planned P10 (hosting) and P11 (CI template) of revision R2 (D24, D25).

## Tasks

- [ ] Template `spa-pages-supabase.yml` with inputs (app dir, supabase dir, branches, uat pages project); jobs: secret-scan, lint/typecheck/test/build, `test:db` (Supabase CLI in dind), `migrate:uat`/`migrate:production` (`supabase db push --db-url`), `deploy:uat` (push built site to the UAT project with deploy key), `pages` on `prod` (manual gate before migrate+publish)
- [ ] UAT Pages project `blog-l2m-uat` (private repo, Pages public) with its own minimal `.gitlab-ci.yml` publishing `public/`
- [ ] Deploy key (write) on the UAT project, private key as protected File variable in `blog-l2m`
- [ ] Supabase cloud projects `l2m-blog-uat` and `l2m-blog-prod` (user creates them; region `ap-southeast-1` Singapore, see Q20 F3; region cannot be changed later). Apply migrations with `supabase db push`; do not run `seed.sql`.
- [ ] Auth per project (D35): Site URL = that environment's Pages URL; Redirect URLs = `<pages-url>/auth/callback`; Providers → Google enabled with the client ID/secret (entered by the user in the Dashboard), and GitHub with that environment's own OAuth App (D36, one callback URL per app); add `https://<project-ref>.supabase.co/auth/v1/callback` to the Google client's redirect URIs and the Pages origin to its JavaScript origins. Then grant the first admin with `scripts/bootstrap-site-admin.sql` against that project's `DIRECT_URL`.
- [ ] Variables per environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL` (protected, masked) — user supplies Supabase values
- [ ] Remove obsolete variables (JWT_*, REDIS_PASSWORD, DEPLOY_REGISTRY_*) and revoke the registry deploy token
- [ ] Tag cicd-templates v2.0.0 after CI Lint passes; app include bumped

## Verification

- GitLab CI Lint valid; MR pipeline green; local simulation of build + Pages artifact

## Rollback or Recovery

App `.gitlab-ci.yml` back to v1.0.1; UAT project archivable.

## Execution Notes
