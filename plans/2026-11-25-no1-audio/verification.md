# Verification

- P01: `frontend` typecheck, lint, test (unit test for `markdownText` and for the utterance queue with a fake `speechSynthesis`), build. Browser smoke on machine A: Chrome desktop, Android Chrome, iOS Safari if available.
- P03: docs reviewed; final check set on `main`.
- Known gap for machine B: jsdom has no `speechSynthesis`; only unit tests with a fake. Real voices are checked on machine A.
