# Plan

## Strategy

One `feature/chat` branch. P01 adds the schema, policies, RPCs, triggers and pgTAP suite (no frontend); P02 adds `lib/chat.ts`, the dock, the pages and tests; P03 documents. Merge `--no-ff` into `main`, run the security-audit skill over the diff, push.

## Phase Table (authoritative)

| ID | Phase | Depends on | Wave | Subagent | Owned scope | Produces |
|---|---|---|---|---|---|---|
| P01 | [Database](phases/P01-database.md) | None | 1 | Not eligible | `supabase/migrations/20261125170000_chat.sql`, `supabase/tests/database/chat_test.sql`, `functions_test.sql` allowlist | Tables, RLS, RPCs, realtime publication |
| P02 | [Frontend](phases/P02-frontend.md) | P01 | 2 | Not eligible | `frontend/src/lib/chat.ts`, `frontend/src/components/chat/*`, `frontend/src/pages/ChatPage.tsx`, `App.tsx`, `Layout.tsx`, `api/endpoints.ts`, `api/types.ts`, tests | Dock, pages, live updates |
| P03 | [Docs](phases/P03-docs.md) | P02 | 3 | Not eligible | `README.md`, `frontend/README.md`, `docs/ideas.md`, `AGENTS.md`, this bundle | Docs, closure |

## Acceptance criteria

- A signed-in member sends a message in Chung and another signed-in member sees it without reloading; a guest sees no chat UI and gets 42501 on the table.
- A member opens a private thread with another member from the member list; the thread is the same row whichever side opens it; a third member cannot read it; an admin cannot read it.
- A blocked member cannot open a thread with, or send to, the blocker; the 21st message within a minute is refused; a banned word is masked; a suspended member can neither read nor send.
- Unread badges: dock button shows the total unread; opening a thread clears it.
- Checks green: pgTAP (new suite + allowlist), typecheck, lint, vitest, build.
