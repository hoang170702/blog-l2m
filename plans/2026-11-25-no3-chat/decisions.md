# Decisions

## Accepted (user, 2026-11-25 17:30 +07)

- D1 (accepted): One shared room for every signed-in, non-suspended member (`messages.thread_id is null`), plus private 1-1 threads (`dm_threads`, one row per unordered pair). Guests see nothing. No group DMs, no channels per category (may come later).
- D2 (accepted): Private threads are readable only by their two participants: admins cannot read them (the select policy has no admin clause). Safety valves instead: either participant can block the other (`user_blocks`: the blocked member can neither open a thread nor send), and suspension (`private.is_active()`) removes chat entirely. Reporting a private message is not in v1 (`docs/ideas.md`).
- D3 (accepted): Reuse what exists: `private.mask_profanity` on every message, `private.is_active()` in every policy, 20 messages per minute per member (counted on `messages` itself, no attempts table), admins may delete any message in the shared room.
- D4 (accepted): Live updates through Supabase Realtime `postgres_changes` on `messages` (RLS-filtered per subscriber) plus Presence for "n người đang online". Free tier: 200 concurrent connections, 2M messages/month.
- D5 (accepted): Retention: shared-room messages older than 90 days are deleted by a statement trigger on insert; private threads are kept. Text only (≤ 1000 chars): no images, reactions, edits, quotes or search in v1.
- D6 (accepted): UI: floating button bottom-right for signed-in members opening a 380×560 dock (full screen on mobile) with tabs Chung / Riêng, plus `/chat` and `/chat/:threadId` pages using the same components. Unread: shared room by a `localStorage` read mark, private threads by `read_a/read_b` columns via `mark_thread_read()`.

## Rejected

- Admin read access to private threads (privacy; the user accepted the trade-off of blocks + suspension).
- Web Push for messages while the tab is closed (needs a service worker and a push server key; revisit if the room is used).
- Separate attempts table for the rate limit (the `messages` table already holds the timestamps).
