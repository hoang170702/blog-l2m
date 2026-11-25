# Verification

- P01: `frontend` typecheck, lint, test (unit test for `markdownText` and for the utterance queue with a fake `speechSynthesis`), build. Browser smoke on machine A: Chrome desktop, Android Chrome, iOS Safari if available.
- P02: `npm run db:test:embedded` with `audio_test.sql` (RLS: own folder only, mime/size handled by bucket config, 20-file cap trigger, anon refused, path check on `posts.audio_path`); frontend tests for the recorder state machine (mock `MediaRecorder`) and the player; build; CSP string contains `media-src`.
- P03: docs reviewed; final check set on `main`.
- Known gaps for machine B: no Docker → no real Storage upload; no microphone → recorder only unit-tested.
