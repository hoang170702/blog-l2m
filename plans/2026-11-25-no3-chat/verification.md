# Verification

- P01: `npm run db:test:embedded` (new `chat_test.sql`, allowlist in `functions_test.sql`).
- P02: frontend typecheck, lint, vitest, build. Realtime and presence cannot be exercised on machine B (no Supabase stack; production lacks the migration until `db push`); covered by unit tests with a mocked channel.
- P03: docs read back; final check set green on `main`.
- Result (2026-11-25 19:10 +07, machine B): pgTAP 219 assertions / 12 suites; typecheck; lint (2 pre-existing warnings); vitest 85 tests / 22 files; build. Security audit of the diff: see evidence A001. Not run: realtime delivery, presence, dock in a browser; `supabase db push` of this migration.
