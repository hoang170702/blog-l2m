# Evidence

## Planning Evidence

- 2026-11-25 17:40 +07 (machine B): plan written from `main` a4e13d3 after a design discussion in chat (three shapes A/B/C; the user chose A + C). Building blocks confirmed in code: `private.is_active()`, `private.mask_profanity`, `private.is_admin()`, `profiles` readable by members, `[realtime] enabled = true` in `supabase/config.toml`, supabase-js 2.x in the frontend.

## Approval

- 2026-11-25 17:30 +07: user "có 1 channel chung cho toàn bộ member, sau đó nhắn riêng với nhau cũng ok" after being told admins would not be able to read private threads and that abuse control is block + suspension. Status: Approved. Standing permissions: commit, merge into `main`, push; then security audit and patch.

## Amendments

None.

## Execution Log

<!-- workflow-action:A001 status:completed -->
- A001 (completed 2026-11-25 19:10 +07, machine B): P01–P03 on `feature/chat`, merged `--no-ff` into `main`. Security audit over `a4e13d3..HEAD` (local lenses; sub-agents not used for a two-commit diff). Access Control: every `messages`/`dm_threads` policy requires `private.is_active()`; private threads visible only to `user_a`/`user_b` (pgTAP: third member and admin both see 0); `open_dm`, `mark_thread_read`, `dm_inbox` are `security definer` with `search_path = ''`, check the caller, and are granted to `authenticated` only (allowlist test). Unsafe Sinks: message text rendered as React text; member search strips `%`/`_` and goes through PostgREST parameters; no HTML/URL sinks added. Business Logic: block is symmetric (`blocked_between`) so neither side can message; `open_dm` refuses self/unknown/blocked; delete limited to own rows (admins: room only). Abuse/DoS: 20 messages per minute per member (trigger), 1000-char cap, 90-day room retention; realtime fan-out bounded by RLS. Finding fixed during the audit (Low → fixed): both the dock and the room subscribed to the same realtime topic `messages`; supabase-js returns the existing channel for a repeated topic, so unmounting one would have torn down the other's subscription — topics are now unique per subscriber. Hardening noted, not fixed: the rate limit counts stored rows, so deleting one's own messages frees quota (bounded, no lasting flood); `dm_inbox.blocked` and `open_dm`'s P0403 tell a member that the peer blocked them (deliberate, avoids silent failure). `npm audit --audit-level=high` clean. Findings: none open.

## Handoff Notes

- Same workflow as R4: one branch, `--no-ff` merge, full check set, push `main` + branch as hoang170702.
- Release still requires `npx supabase db push --remote` on machine A (together with the pending `20261125*` migrations) before the frontend is published.
