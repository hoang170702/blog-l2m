# Plan Record: Audio for posts (read aloud + author recordings)

<!-- workflow-record version:4 kind:plan tracker-id:PLAN-20261125-audio -->

Tracker ID: PLAN-20261125-audio
Created: 2026-11-25 12:50 +07
Last updated: 2026-11-25 13:05 +07
Status: Approved
Plan mode: Active
Execution readiness: Ready
Execute mode: Not started
Resume instruction: Invoke $execute on <repo>/plans/2026-11-25-no1-audio (tracker PLAN-20261125-audio), read index.md and every manifest file, keep this exact bundle as the execution source of truth, and continue updating it until explicit exit.
Workspace: machine A /home/hoangkktt/workspaces/blog-l2m, machine B /home/hoangnh17/workspaces/tool/blog-l2m (no Docker)
Repository: origin https://gitea.com/hoang170702/blog-l2m.git, branch `main` at c32cf3a (R4 of PLAN-20261123-blog-monorepo merged)

<!-- workflow-active-snapshot:start version:2 -->
## Active Snapshot

Profile: Durable
Required references: references/intake.md
Goal: Readers can listen to a post read by the browser's own voice (Web Speech API): zero storage, no server, no voice picker. Regional voices and author recordings are out of scope (decisions.md).
Current state: Approved; no code yet. Phases: P01 read aloud, P03 docs. P02 dropped.
Accepted decisions: D1, D3
Open items: None
Next safe action: $execute P01 on a branch `feature/read-aloud` from `main`, merge `--no-ff`, then P03.
<!-- workflow-active-snapshot:end -->

## Resume Checkpoint

- Last completed: plan approved (user answer to Q1, 2026-11-25 13:05 +07).
- Current work: none.
- Blocking decision or dependency: none.
- Next safe action: execute P01 (`feature/read-aloud`), then P03.
- Deferred work: none.

<!-- workflow-manifest:start -->
index.md
context.md
decisions.md
plan.md
verification.md
evidence.md
phases/P01-read-aloud.md
phases/P03-docs-and-smoke.md
<!-- workflow-manifest:end -->
