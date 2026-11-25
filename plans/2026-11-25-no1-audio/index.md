# Plan Record: Audio for posts (read aloud + author recordings)

<!-- workflow-record version:4 kind:plan tracker-id:PLAN-20261125-audio -->

Tracker ID: PLAN-20261125-audio
Created: 2026-11-25 12:50 +07
Last updated: 2026-11-25 12:50 +07
Status: Draft (awaiting the user's approval of D1–D4, see decisions.md)
Plan mode: Active
Execution readiness: Not ready (open question Q1)
Execute mode: Not started
Resume instruction: Invoke $plan on <repo>/plans/2026-11-25-no1-audio (tracker PLAN-20261125-audio), read index.md and every manifest file, answer Q1 with the user, then hand off to $execute.
Workspace: machine A /home/hoangkktt/workspaces/blog-l2m, machine B /home/hoangnh17/workspaces/tool/blog-l2m (no Docker)
Repository: origin https://gitea.com/hoang170702/blog-l2m.git, branch `main` at c32cf3a (R4 of PLAN-20261123-blog-monorepo merged)

<!-- workflow-active-snapshot:start version:2 -->
## Active Snapshot

Profile: Durable
Required references: references/intake.md
Goal: Readers can listen to a post. Two layers: (A) browser text-to-speech of the post body, zero storage; (B) the author attaches one audio file per post (own voice or a generated file), stored in Supabase Storage under a tight quota.
Current state: Research done (context.md). Decisions proposed, not yet accepted. No code.
Accepted decisions: None yet (D1–D4 proposed)
Open items: Q1 (which layer(s) to build)
Next safe action: Ask Q1; on answer accept decisions, set Status: Approved, hand off to $execute starting with P01.
<!-- workflow-active-snapshot:end -->

## Resume Checkpoint

- Last completed: research + plan drafted (machine B, 2026-11-25).
- Current work: none; waiting for Q1.
- Blocking decision or dependency: Q1.
- Next safe action: answer Q1, then P01.
- Deferred work: none.

<!-- workflow-manifest:start -->
index.md
context.md
decisions.md
plan.md
verification.md
evidence.md
phases/P01-read-aloud.md
phases/P02-audio-attachments.md
phases/P03-docs-and-smoke.md
<!-- workflow-manifest:end -->
