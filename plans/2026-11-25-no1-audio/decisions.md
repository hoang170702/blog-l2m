# Decisions

## Accepted (user, 2026-11-25 13:05 +07: "Web Speech API đi, lấy giọng của máy, khỏi chọn")

- D1 (accepted): Read aloud with the browser's Web Speech API only: zero storage, no server, no key. One `ReadAloud` control on the post page using the device's `vi-VN` voice when present, else the default voice with a note. No voice picker.
- D3 (accepted): No server-side TTS. The user first asked for four regional voices (nam/nữ miền Bắc, nam/nữ miền Nam); only Vietnamese paid services (FPT.AI, Viettel, Zalo) offer them, and the free tiers (FPT ~5k chars/day) cover about one post-voice a day. The user dropped the regional-voice requirement in favour of a free solution.

## Dropped

- D2 (dropped with Q1): author-attached audio files (`post-audio` bucket, MediaRecorder). Kept in context.md as research for later.
- D4 (dropped with D2): no `<audio>` player, so no CSP `media-src` change.

## Open Questions

- Q1 (answered: Web Speech API only; regional voices dropped).

## Rejected

- ffmpeg.wasm transcoding in the browser (30 MB download for little gain; Opus/AAC from MediaRecorder is already small).
- Storing audio as base64 in Postgres (the free database quota is 500 MB, smaller than Storage).
