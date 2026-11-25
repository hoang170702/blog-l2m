# Plan

## Strategy

Two independent features behind one "Nghe bài viết" block on the post page. P01 ships without any database or Storage change. P02 adds a bucket, a column, limits and the editor UI. P03 documents and smokes. Each phase is its own `feature/*` branch merged `--no-ff` into `main` (same workflow as R4 of PLAN-20261123-blog-monorepo).

## Phase Table (authoritative)

| ID | Phase | Depends on | Wave | Subagent | Owned scope | Produces |
|---|---|---|---|---|---|---|
| P01 | [Read aloud](phases/P01-read-aloud.md) | None | 1 | Eligible | `frontend/src/lib/speech.ts`, `frontend/src/lib/markdownText.ts`, `frontend/src/components/ReadAloud.tsx`, `frontend/src/pages/PostPage.tsx`, tests | Play/Pause/Stop + speed + voice picker reading the post body |
| P02 | [Audio attachments](phases/P02-audio-attachments.md) | None | 1 | Eligible | new migration, `supabase/tests/database/audio_test.sql`, `frontend/src/api/*`, `frontend/src/components/AudioRecorder.tsx`, `frontend/src/pages/admin/PostEditorPage.tsx`, `frontend/src/pages/PostPage.tsx`, `frontend/vite.config.ts`, `scripts/cleanup-unused-images.mjs` | Author records or uploads one audio file per post; player on the post page; limits enforced in the database |
| P03 | [Docs and smoke](phases/P03-docs-and-smoke.md) | P01, P02 | 2 | Not eligible | `README.md`, `frontend/README.md`, `docs/ideas.md`, this bundle | Docs, plan closure, machine A smoke list |

P01 and P02 both edit `PostPage.tsx` (different blocks); run them serially or give P02 the integration of the block.

## Acceptance criteria

- A reader on a device with a `vi-VN` voice presses "Nghe" and hears the post from the first paragraph; Pause/Resume/Stop work; leaving the page stops the speech.
- Without a Vietnamese voice the control still works with the default voice and tells the reader.
- An author records 30 s in the editor, previews, saves; the post page shows a player; replacing the file removes the old object; the 21st file of an author is refused with a readable message; a visitor cannot upload.
- All checks green; CSP allows the player to load from Storage.
