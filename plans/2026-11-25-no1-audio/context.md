# Context

## Goal

Let readers listen to a post. The user asked (2026-11-25, steering): "nghiên cứu chức năng audio nhé, tạo plan sẵn đi". The blog runs as a static SPA on Pages + Supabase (Postgres, Auth, Storage 1 GB free, Edge Functions). Storage is scarce: the user already refused ideas that store more images.

## Research (machine B, code reading + platform knowledge, 2026-11-25)

### Option A: read the post aloud in the browser (Web Speech API)

- `window.speechSynthesis` + `SpeechSynthesisUtterance`, free, no network, no storage. Supported in Chrome, Edge, Safari (desktop + iOS), Firefox, Samsung Internet.
- Vietnamese voices: Chrome desktop ships Google "Tiếng Việt" (online voice); Android has Google TTS `vi-VN`; iOS/macOS have "Linh" (vi-VN). Quality varies; some devices have no `vi` voice at all → pick `vi-VN` if present, else the default voice, and say so in the UI.
- Input text: the post body is Markdown. Strip to plain text before speaking: render with the existing `Markdown` pipeline into a hidden element and read `textContent`, or use a small Markdown-to-text pass (remove code blocks, image/link syntax, heading marks). Code blocks should be skipped or announced as "đoạn mã".
- Long posts: Chrome stops utterances longer than ~15 s in some versions; split by sentence/paragraph into a queue of utterances and advance on `onend`. Keep `speechSynthesis.pause()/resume()/cancel()` wired to Play/Pause/Stop; cancel on route change and unmount.
- Controls: play/pause/stop, speed 0.8–1.5, voice picker when more than one `vi` voice exists; highlight the paragraph being read (optional, P01 stretch).
- Limits: no offline MP3, no sharing; quality depends on the device; iOS requires the first `speak()` to follow a user gesture (our Play button does).

### Option B: author-attached audio file per post

- Storage: new bucket `post-audio` (public read, members write only under `<user_id>/`), `allowed_mime_types` `audio/mpeg`, `audio/mp4` (m4a), `audio/ogg`, `audio/webm`; `file_size_limit` 8 MiB (≈ 8–10 min at 96–128 kbps). Column `posts.audio_path text` with the same path check pattern as covers. 1 GB ≈ 120–250 recordings → a per-author cap is needed: at most one file per post (replacing deletes the old one, like covers) and a trigger limit of N audio files per author (proposal: 20). Deleting the post deletes the file (client, like covers).
- Recording in the browser: `MediaRecorder` produces `audio/webm;codecs=opus` (Chrome/Firefox/Edge) or `audio/mp4` (Safari). Opus at 32–48 kbps is enough for voice (1 MB/3–4 min). Record → preview → upload. No transcoding in the browser (avoid ffmpeg.wasm, 30 MB).
- Generated speech files: Edge Function calling a TTS API (Google Cloud TTS / Azure / OpenAI) costs money and needs a key; out of scope unless the user wants it. Mentioned as future work.
- Player: native `<audio controls preload="none">` under the title; `Content-Security-Policy` in `frontend/vite.config.ts` needs `media-src 'self' <supabaseUrl>` (currently no `media-src`, falls back to `default-src 'self'` which would block Storage URLs).
- Images clean-up script `scripts/cleanup-unused-images.mjs` should learn the `post-audio` bucket.

### Existing code to reuse

- Cover upload flow: `adminApi.upload` (path `<user>/<uuid>.<ext>`), `removeImage` best-effort delete, Storage RLS with per-user folder and hourly quota (`private.upload_quota_left`) in `20261124090100_community_safety.sql`.
- `PostInput` / `toPostRow` / editor sidebar blocks (`PostEditorPage.tsx`), `PostDetail` mapping (`endpoints.ts`), `App.test.tsx` mocks.
- Check set: `npm run db:test:embedded`; frontend `typecheck`, `lint`, `test`, `build`.

## Constraints

- Keep storage use low (user: "bộ nhớ ko có đâu").
- No new paid service without asking.
- Plan bundle and docs updated for the next agent; commits as `hoangkktt <huyhoang11202@gmail.com>`; push to Gitea as hoang170702 (global rule).
