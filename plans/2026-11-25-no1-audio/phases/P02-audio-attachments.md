# P02: Audio attachments (one file per post)

Status: Pending
Depends on: None (P01 first if run serially; both touch PostPage.tsx)
Wave: 1
Subagent: Eligible
Owned scope: `supabase/migrations/<ts>_post_audio.sql`, `supabase/tests/database/audio_test.sql`, `frontend/src/api/{types,endpoints}.ts`, `frontend/src/components/AudioRecorder.tsx`, `frontend/src/pages/admin/PostEditorPage.tsx`, `frontend/src/pages/PostPage.tsx` (player block), `frontend/vite.config.ts`, `scripts/cleanup-unused-images.mjs`
Produces: authors attach one recording or uploaded file per post; player on the post page; database-enforced limits

## Tasks

- [ ] Migration: bucket `post-audio` (public, `file_size_limit` 8388608, `allowed_mime_types` audio/mpeg, audio/mp4, audio/ogg, audio/webm); Storage policies copied from `post-images` (own folder `<uid>/<uuid>.<ext>`, `private.is_active()`, reuse hourly quota or a dedicated 10/hour); `posts.audio_path text check (audio_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp3|m4a|ogg|webm)$')`; `private.audio_quota_left()` counting `storage.objects` in `post-audio` under the caller's folder < 20 unless admin; insert policy uses it. Grants per the explicit-grants convention.
- [ ] `audio_test.sql`: own-folder-only insert, anon refused, 20-file cap refused with 42501, path check on posts.audio_path, admin exempt.
- [ ] API: `adminApi.uploadAudio(blob, ext)` → path; `removeAudio` best effort; `updatePost/deletePost` also delete the replaced/old `audio_path` (same pattern as covers, extend `endpoints.cover.test.ts`); `PostDetail.audioUrl`, `AdminPost.audioPath`, `PostInput.audioPath`.
- [ ] `AudioRecorder.tsx`: states idle → recording (timer, max 10 min) → preview (`<audio>`) → upload; `MediaRecorder` with `audio/webm;codecs=opus` or `audio/mp4` fallback; "Tải file lên" input accepting the four mime types; error texts for no microphone / permission denied. Unit tests with a mocked `MediaRecorder` and `getUserMedia`.
- [ ] Editor sidebar block "Âm thanh": recorder, current file player, "Bỏ file".
- [ ] `PostPage.tsx`: `<audio controls preload="none" src={post.audioUrl}>` block "Nghe bản ghi âm" above the ReadAloud control when present.
- [ ] `vite.config.ts` CSP: add `media-src 'self' ${supabaseUrl}`; test in `vite.config` or build-output check.
- [ ] `scripts/cleanup-unused-images.mjs`: also list/delete `post-audio` objects not referenced by `posts.audio_path` (dry-run first, as today).
- [ ] README (Storage section): bucket, limits, personal-data note (a voice is personal data; the author uploads their own).

## Verification

`npm run db:test:embedded`; frontend typecheck, lint, test, build. Real upload + playback on machine A with `supabase start`.

## Rollback or Recovery

Revert the merge; forward-only migration stays (column nullable, bucket unused).

## Execution Notes

(none yet)
