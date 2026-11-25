# P02: Frontend

Status: Completed (2026-11-25 19:10 +07, machine B)
Depends on: P01
Wave: 2
Subagent: Not eligible
Owned scope: `frontend/src/lib/chat.ts`, `frontend/src/components/chat/` (`ChatDock.tsx`, `ChatRoom.tsx`, `MessageList.tsx`, `MemberPicker.tsx`), `frontend/src/pages/ChatPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/api/endpoints.ts`, `frontend/src/api/types.ts`, tests
Produces: floating dock + `/chat` pages with live updates (D6)

## Tasks

- [x] `api/endpoints.ts` `chatApi`: `messages(threadId | null, before?, limit 50)` with author profile join, `send(threadId | null, content)`, `remove(id)`, `openDm(userId)`, `inbox()`, `markRead(threadId)`, `members(query)` (profiles search), `block(userId)` / `unblock(userId)` / `blocks()`.
- [x] `lib/chat.ts`: `subscribeMessages(onInsert, onDelete)` on one realtime channel (RLS decides what arrives), `presence(roomKey, user)` returning the online count, shared-room read mark in `localStorage['chat-read-general']`, `groupMessages()` (consecutive messages by the same author within 5 min).
- [x] `ChatRoom`: list (oldest at the bottom, infinite scroll up), composer (Enter sends, Shift+Enter newline, 1000-char counter), own messages aligned right, delete for own/admin, masked warning line, empty state, error state with retry, auto-scroll only when already at the bottom.
- [x] `ChatDock`: floating button with unread badge (shared mark + `dm_inbox` unread, polled 30 s and on realtime insert), panel with tabs Chung / Riêng; Riêng lists the inbox and a "Nhắn cho…" member picker; opens the thread in place; full screen under `sm`.
- [x] `ChatPage` at `/chat` and `/chat/:threadId` behind `RequireAuth`, same components, two-column on `md`.
- [x] Block / unblock from the thread header (confirm), surfaced error text when sending to a blocker.
- [x] Tests: `chat.test.ts` (grouping, read mark), `ChatRoom.test.tsx` (renders, Enter sends via mocked api, realtime insert appends), `ChatDock.test.tsx` (hidden when signed out, badge count), route smoke in `App.test.tsx`.

## Verification

typecheck, lint, vitest, build. Live behaviour needs two browsers against a running Supabase (machine A).

## Rollback or Recovery

Revert the merge.

## Execution Notes

- Commit `feat(chat): floating chat dock and /chat page`. `CHAT_PAGE` lives in `lib/chat.ts` so test mocks of `endpoints.ts` need not export it. Realtime topics are unique per subscriber (supabase-js reuses same-topic channels). `useInbox` sits in its own file for the fast-refresh lint rule. Four existing signed-in tests now mock `chatApi` and `supabase.channel` through `src/test/chat.ts`. Tests: `chat.test.ts` (4), `ChatRoom.test.tsx` (3), `ChatDock.test.tsx` (2); vitest 85 / 22 files, typecheck, lint (2 pre-existing warnings), build. Not verified: live delivery, presence and the dock in a real browser (no Supabase stack on machine B).
