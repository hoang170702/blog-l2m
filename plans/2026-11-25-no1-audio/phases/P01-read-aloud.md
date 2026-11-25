# P01: Read aloud (Web Speech API)

Status: Completed (2026-11-25 13:40 +07, machine B)
Depends on: None
Wave: 1
Subagent: Eligible
Owned scope: `frontend/src/lib/speech.ts`, `frontend/src/lib/markdownText.ts`, `frontend/src/components/ReadAloud.tsx`, `frontend/src/pages/PostPage.tsx` (one block under the meta row), tests
Produces: "Nghe bài viết" control on the post page using the device voice; no DB or Storage change; no voice picker (D1)

## Tasks

- [x] `lib/markdownText.ts`: Markdown → plain-text paragraphs. Drop code fences (replace with "Đoạn mã."), images, HTML, link syntax (keep link text), heading/list/emphasis marks; split into paragraphs; trim empties. Unit tests with a sample post.
- [x] `lib/speech.ts`: `createReader(paragraphs, { rate })` returning `{ play, pause, resume, stop, state, onChange }`; queue one `SpeechSynthesisUtterance` per paragraph (chunk paragraphs longer than ~800 chars at sentence ends); `pickVoice()` returns the first voice whose `lang` starts with `vi` (`getVoices()` may be empty until `voiceschanged`), else `null` (browser default); `supported()` guard. Unit tests with a fake `speechSynthesis`.
- [x] `components/ReadAloud.tsx`: Play/Pause/Stop buttons, speed select (0.8/1/1.25/1.5), note "Thiết bị không có giọng tiếng Việt, dùng giọng mặc định" when no `vi` voice; no voice picker (D1); hidden when `supported()` is false; stops on unmount and when `slug` changes.
- [x] `PostPage.tsx`: render `<ReadAloud title={post.title} markdown={post.content} />` under the header meta row (above the cover).
- [x] Tests in `App.test.tsx`: control renders with a fake `speechSynthesis`; Play calls `speak` with the first paragraph; hidden when unsupported.

## Verification

frontend typecheck, lint, test, build. Browser smoke (machine A).

## Rollback or Recovery

Revert the merge commit; nothing persisted.

## Execution Notes

- Branch `feature/read-aloud`: commits 1e4744c66324c26f29b7bc74a69976c99c76ce21 (feature) and 246d46543a6be7506ce5203b8b35237c4ce5f0ea (lint fix: reader held in state, not a ref read during render); merges d2c51fb4 and f82b8db7 into `main`. Title is spoken first, then the paragraphs. Tests: `markdownText.test.ts` (2), `speech.test.ts` (5), two App tests. Checks: typecheck, lint (2 pre-existing warnings), 68 vitest, build, 190 pgTAP. Not verified: real voices in a browser (machine A).
