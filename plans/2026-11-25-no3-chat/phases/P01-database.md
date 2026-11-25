# P01: Database

Status: Completed (2026-11-25 19:10 +07, machine B)
Depends on: None
Wave: 1
Subagent: Not eligible
Owned scope: `supabase/migrations/20261125170000_chat.sql`, `supabase/tests/database/chat_test.sql`, `supabase/tests/database/functions_test.sql`
Produces: `dm_threads`, `user_blocks`, `messages` with RLS; RPCs `open_dm`, `mark_thread_read`, `dm_inbox`; triggers (mask, rate limit, thread bump, retention); realtime publication

## Tasks

- [x] Tables: `dm_threads (id, user_a < user_b unique, created_at, last_message_at, read_a, read_b)`, `user_blocks (blocker, blocked)`, `messages (id, thread_id null = shared room, user_id, content 1..1000, masked, created_at)`; indexes on `(thread_id, created_at desc)` and the shared room.
- [x] Helpers in `private`: `in_thread(thread)`, `thread_peer(thread)`, `blocked_between(a, b)`, all `security definer set search_path = ''`.
- [x] RLS + grants: members (`is_active()`) read the shared room and their own threads; insert only as themselves, into the shared room or an unblocked thread; delete own, admins delete in the shared room; `dm_threads` select for participants only (writes through RPCs); `user_blocks` own rows select/insert/delete. Revoke everything from anon.
- [x] Triggers: before insert → `mask_profanity`, rate limit 20/min (`P0429`); after insert row → bump `dm_threads.last_message_at`; after insert statement → delete shared-room messages older than 90 days.
- [x] RPCs: `open_dm(p_user) returns uuid` (not self, peer exists in `profiles`, caller active, not blocked either way, upsert on the ordered pair); `mark_thread_read(p_thread)`; `dm_inbox()` returns `(thread_id, peer_id, peer_name, peer_avatar, last_message_at, unread bigint)` for the caller. Grant to `authenticated` only; add to the allowlist in `functions_test.sql`.
- [x] Realtime: `alter publication supabase_realtime add table public.messages` inside a `do` block that checks the publication exists (PGlite has none).
- [x] `chat_test.sql`: ≈ 20 assertions covering the acceptance criteria (anon, guest, suspended, mask, rate limit, dm symmetry, third party, admin, block, read marks, inbox, retention, admin delete).

## Verification

`npm run db:test:embedded` green (all suites).

## Rollback or Recovery

New objects only; a down migration would drop the three tables and the functions.

## Execution Notes

- Commit `feat(db): member chat` (see `git log feature/chat`). `user_id` and `blocker` default to `auth.uid()` so the API inserts need no id. `chat_test.sql` 24 assertions; all 12 suites green (219 assertions). The publication statement is guarded by a `do` block because PGlite has no `supabase_realtime`.
