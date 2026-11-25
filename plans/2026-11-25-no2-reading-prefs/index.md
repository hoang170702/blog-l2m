# Plan Record: Reading preferences (font size and font family)

<!-- workflow-record version:4 kind:plan tracker-id:PLAN-20261125-reading-prefs -->

Tracker ID: PLAN-20261125-reading-prefs
Created: 2026-11-25 15:40 +07
Last updated: 2026-11-25 16:45 +07
Status: Implemented
Plan mode: Exited
Execution readiness: Ready
Execute mode: Active
Resume instruction: Invoke $execute on <repo>/plans/2026-11-25-no2-reading-prefs (tracker PLAN-20261125-reading-prefs), read index.md and every manifest file, keep this exact bundle as the execution source of truth, and continue updating it until explicit exit.
Workspace: machine A /home/hoangkktt/workspaces/blog-l2m, machine B /home/hoangnh17/workspaces/tool/blog-l2m (no Docker)
Repository: origin https://gitea.com/hoang170702/blog-l2m.git, branch `main` (after `fix/ui-review` of PLAN-20261123-blog-monorepo A040)

<!-- workflow-active-snapshot:start version:2 -->
## Active Snapshot

Profile: Durable
Required references: references/intake.md, references/implementation.md
Goal: Readers pick a text size and a font for reading; the default stays exactly the current look (Plus Jakarta Sans, current sizes). The choice is remembered on the device. No database change.
Current state: Implemented (P01, P02 on machine B), merged into `main`.
Accepted decisions: D1–D4
Open items: None
Next safe action: machine A browser smoke: A−/A+ resize the body and comments, Lora/Be Vietnam Pro render diacritics, choice survives reload without a font flash.
<!-- workflow-active-snapshot:end -->

## Resume Checkpoint

- Last completed: P01 + P02 (2026-11-25 16:45 +07).
- Current work: none.
- Blocking decision or dependency: none.
- Next safe action: browser smoke on machine A.
- Deferred work: none.

<!-- workflow-manifest:start -->
index.md
decisions.md
plan.md
verification.md
evidence.md
phases/P01-reading-prefs.md
phases/P02-docs.md
<!-- workflow-manifest:end -->
