# Evidence

## Planning Evidence

- 2026-11-25 15:40 +07 (machine B): plan written from the current `main` (`ee44829`) and the user's one-message request. The theme mechanism (`lib/theme.ts`, `data-theme`, `localStorage`) is the model for the new preference. Fonts checked on fontsource: `@fontsource/be-vietnam-pro` and `@fontsource-variable/lora` both ship a `vietnamese` subset.

## Approval

- 2026-11-25 15:30 +07: the user approved in advance ("lên plan xong làm luôn đi nha, khỏi hỏi lại"). Status: Approved. Standing permissions from the session: commit, merge into `main`, push to Gitea without asking; then `/security-audit`, patch, push.

## Amendments

None.

## Execution Log

<!-- workflow-action:A001 status:completed -->
- A001 (completed 2026-11-25 16:45 +07, machine B): P01 + P02 on `feature/reading-prefs`, merged `--no-ff` into `main`; checks as in verification.md. Followed by the session's `/security-audit` over the UI-fix and reading-prefs diffs (results recorded in PLAN-20261123-blog-monorepo A041).

## Handoff Notes

- Same workflow as R4: one `feature/*` branch, `--no-ff` merge into `main`, full check set, push `main` + branch as hoang170702.
