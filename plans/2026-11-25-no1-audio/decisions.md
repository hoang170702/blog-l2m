# Decisions

## Proposed (awaiting Q1)

- D1: Build Option A (read aloud, Web Speech API) first: zero storage, works everywhere a `vi-VN` voice exists, one component `ReadAloud` on the post page.
- D2: Build Option B (one audio attachment per post) with a hard budget: bucket `post-audio`, 8 MiB per file, 20 files per author (admins exempt), replace-deletes-old, delete-post-deletes-file. Recording in the browser with `MediaRecorder`; uploading an existing MP3/M4A also allowed.
- D3: No server-side TTS (paid API) in this plan.
- D4: Player = native `<audio>`; CSP gains `media-src 'self' <supabase>`.

## Open Questions

- Q1 (pending): Which layers?
  1. A + B (read aloud now, attachments with the 20-files cap). Recommended.
  2. Only A (no storage at all).
  3. Only B.
  4. Other.

## Rejected

- ffmpeg.wasm transcoding in the browser (30 MB download for little gain; Opus/AAC from MediaRecorder is already small).
- Storing audio as base64 in Postgres (the free database quota is 500 MB, smaller than Storage).
