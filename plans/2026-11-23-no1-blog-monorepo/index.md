# Plan Record: Blog monorepo (React + Supabase + GitLab Pages, earlier NestJS/VPS baseline)

<!-- workflow-record version:4 kind:plan tracker-id:PLAN-20261123-blog-monorepo -->

Tracker ID: PLAN-20261123-blog-monorepo
Created: 2026-11-23 09:17 +07
Last updated: 2026-11-25 23:55 +07 (A043)
Status: In progress
Plan mode: Exited
Execution readiness: Ready
Execute mode: Active
Resume instruction: Invoke /execute on <repo>/plans/2026-11-23-no1-blog-monorepo of the current machine (machine A: /home/hoangkktt/workspaces/blog-l2m, machine B: /home/hoangnh17/workspaces/tool/blog-l2m; see evidence.md "Machines") (tracker PLAN-20261123-blog-monorepo), read index.md and every manifest file, keep this exact bundle as the execution source of truth, and continue updating it until explicit exit.
Machines: work alternates between two machines (A011). The bundle under `plans/` is git-ignored, so copy it to the other machine when switching and keep only one copy active.
Workspace: machine A /home/hoangkktt/workspaces/blog-l2m; machine B /home/hoangnh17/workspaces/tool/blog-l2m
Repository (machine A): /home/hoangkktt/workspaces/blog-l2m (remote origin https://gitlab.com/NguyenHuyHoang170702/blog-l2m.git); worktree /home/hoangkktt/workspaces/blog-l2m/.worktrees/blog-l2m-mvp, branch feature/blog-mvp at 4daba0e (R2 work goes to feature/supabase-pages); template repo /home/hoangkktt/workspaces/cicd-templates (main f97f02d, tags v1.0.0, v1.0.1)
Repository (machine B): /home/hoangnh17/workspaces/tool/blog-l2m (remote origin https://gitea.com/hoang170702/blog-l2m.git); main checkout on feature/supabase-pages (aa0a1a6), no worktree (user override A013); no cicd-templates checkout
Active action: None (R4 complete: A029–A038; A039 security fixes; A040 UI-review fixes; A041 reading prefs + audit; A042 member chat, all merged into main and pushed; A043 release + evening fixes on machine A, live on GitHub Pages); R4 = 9 feature branches merged into main in order: dark-mode, share-buttons, post-stats, bookmarks, hidden-posts, comment-profanity-filter, follows, series, notifications; then docs + push

<!-- workflow-active-snapshot:start version:2 -->
## Active Snapshot

Profile: Durable
Required references: references/intake.md, references/implementation.md (execute skill)
Goal: L2M Blog — React SPA on GitLab Pages with Supabase (Postgres, Auth, RLS, Storage); GitLab CI via shared template; git flow feature→uat→prod→master. (Revision R2 replaces the NestJS/Redis/VPS baseline P02/P04/P05.)
Current state: Baseline P01–P07 done (VPS architecture); UI restyle done; R2 approved (D21–D27, incl. wander-plan learnings); P08 done; P09 next. Machine split recorded (A011): P09 code on either machine, P09 Supabase smoke and P10 on machine A.
Accepted decisions: D1–D50 (R4: D42–D50) (R3: D28–D33; D34 comments without moderation; D35 Google sign-in in every environment; D36 GitHub sign-in, one OAuth App per environment; D37 cover-only images in one 16:9 frame; D38 only the author edits a post, admins may delete; D39 cover clean-up; D40 accent-folding search; D41 author page)
Open items: Q20 (slow loading, unmeasured) (slow post loading, findings F1-F4, awaiting environment/timings), Q22 (admin management page, not asked yet on machine A)
Next safe action: On machine A pull feature/supabase-pages from Gitea; user creates the Google OAuth client (P12 "Google OAuth setup" steps), then enable the provider, `supabase db reset`, UI smoke, rewrite frontend tests; finish P11 (deploy/, compose, Dockerfile, docs); P10.
<!-- workflow-active-snapshot:end -->

## Resume Checkpoint

- Last completed: P08 (007ac56..aa0a1a6) on feature/supabase-pages; local Supabase stack running (`npx supabase start`).
- Current work: P09 + P12 committed and pushed to Gitea (A015); backend/ removed. Remaining: UI smoke + frontend tests on machine A, rest of P11, P10.
- Blocking decision or dependency: None for P09 code. P09 manual smoke against `supabase start` needs Docker (machine A). P10 needs gitlab.com auth and the cicd-templates repo (machine A).
- Next safe action: released 2026-11-25 (A043): production database and GitHub Pages are current with `main` 8f4562d. Next: smoke chat and read-aloud on a real iPhone/Safari, verify `private.comment_clients` on Supabase cloud, clean up the NestJS leftovers (`docs/ideas.md` Housekeeping), bump `actions/deploy-pages`. Release = `npx supabase db push --remote` first, then push `main` to `gitea` and `github`.
- Deferred work (only items the user explicitly excluded or postponed): None.
- Revalidation required: MR !1 (old architecture) must not be merged; decide close-as-superseded when the R2 MR exists.

<!-- workflow-manifest:start -->
index.md
context.md
decisions.md
plan.md
verification.md
evidence.md
phases/P01-repo-foundation.md
phases/P02-backend-api.md
phases/P03-frontend-spa.md
phases/P04-docker-compose.md
phases/P05-gitlab-ci-deploy.md
phases/P06-docs-e2e.md
phases/P07-gitlab-remote-setup.md
phases/P08-supabase-schema.md
phases/P09-frontend-supabase.md
phases/P10-pages-ci.md
phases/P11-cleanup-docs.md
phases/P12-multi-author-oauth.md
<!-- workflow-manifest:end -->
