# Plan Record: Member chat (one shared room + direct messages)

<!-- workflow-record version:4 kind:plan tracker-id:PLAN-20261125-chat -->

Tracker ID: PLAN-20261125-chat
Created: 2026-11-25 17:40 +07
Last updated: 2026-11-25 19:10 +07
Status: Implemented
Plan mode: Exited
Execution readiness: Ready
Execute mode: Active
Resume instruction: Invoke $execute on <repo>/plans/2026-11-25-no3-chat (tracker PLAN-20261125-chat), read index.md and every manifest file, keep this exact bundle as the execution source of truth, and continue updating it until explicit exit.
Workspace: machine A /home/hoangkktt/workspaces/blog-l2m, machine B /home/hoangnh17/workspaces/tool/blog-l2m (no Docker)
Repository: origin https://gitea.com/hoang170702/blog-l2m.git, branch `main` at a4e13d3

<!-- workflow-active-snapshot:start version:2 -->
## Active Snapshot

Profile: Durable
Required references: references/intake.md, references/implementation.md
Goal: Signed-in, non-suspended members chat in one shared room and in private 1-1 threads, live through Supabase Realtime, with the blog's existing safety tools (suspension, profanity mask, rate limit, per-user block). Zero extra services.
Current state: Implemented (P01–P03, machine B), merged into `main`, audited.
Accepted decisions: D1–D6
Open items: None
Next safe action: machine A: `npx supabase db push --remote` (with the other pending `20261125*` migrations), then two browsers: room delivery, presence count, private thread from both sides, block, unread badge.
<!-- workflow-active-snapshot:end -->

## Resume Checkpoint

- Last completed: P01–P03 (2026-11-25 19:10 +07).
- Current work: none.
- Blocking decision or dependency: none.
- Next safe action: machine A db push + two-browser smoke.
- Deferred work: none.

<!-- workflow-manifest:start -->
index.md
decisions.md
plan.md
verification.md
evidence.md
phases/P01-database.md
phases/P02-frontend.md
phases/P03-docs.md
<!-- workflow-manifest:end -->
