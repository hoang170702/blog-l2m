# Verification

- P01: frontend typecheck, lint, test, build; probe screenshots of the post page at 375 and 1280 on the local build (`/tmp/evon-site`, production Supabase) — note the production database lacks the `20261125*` migrations, so the post page may show the error state there; the control is then checked on a fixture post in vitest instead.
- P02: docs read back; final check set green on `main`.
- Result (2026-11-25 16:45 +07, machine B): typecheck, lint, vitest 76 tests / 19 files, build; pgTAP unchanged (195). Probe screenshot of the post page not possible (production DB lacks the R4 migrations); the control is covered by `ReadingPrefs.test.tsx`.
