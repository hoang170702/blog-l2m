# Plan Record: Audio for posts (read aloud + author recordings)

<!-- workflow-record version:4 kind:plan tracker-id:PLAN-20261125-audio -->

Tracker ID: PLAN-20261125-audio
Created: 2026-11-25 12:50 +07
Last updated: 2026-11-25 13:45 +07
Status: Implemented
Plan mode: Exited
Execution readiness: Ready
Execute mode: Active
Resume instruction: Invoke $execute on <repo>/plans/2026-11-25-no1-audio (tracker PLAN-20261125-audio), read index.md and every manifest file, keep this exact bundle as the execution source of truth, and continue updating it until explicit exit.
Workspace: machine A /home/hoangkktt/workspaces/blog-l2m, machine B /home/hoangnh17/workspaces/tool/blog-l2m (no Docker)
Repository: origin https://gitea.com/hoang170702/blog-l2m.git, branch `main` at c32cf3a (R4 of PLAN-20261123-blog-monorepo merged)

<!-- workflow-active-snapshot:start version:2 -->
## Active Snapshot

Profile: Durable
Required references: references/intake.md
Goal: Readers can listen to a post read by the browser's own voice (Web Speech API): zero storage, no server, no voice picker. Regional voices and author recordings are out of scope (decisions.md).
Current state: Implemented (P01, P03 done on machine B). P02 dropped.
Accepted decisions: D1, D3
Open items: None
Next safe action: machine A browser smoke (Chrome desktop, Android Chrome, iOS Safari): Play/Pause/Stop, speed, the no-Vietnamese-voice note, speech stops on navigation.
<!-- workflow-active-snapshot:end -->

## Resume Checkpoint

- Last completed: P01 + P03 (2026-11-25 13:45 +07, machine B), merged into `main` and pushed.
- Current work: none.
- Blocking decision or dependency: none.
- Next safe action: browser smoke on machine A.
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
