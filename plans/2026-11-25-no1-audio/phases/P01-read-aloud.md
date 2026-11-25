# P01: Read aloud (Web Speech API)

Status: Pending
Depends on: None
Wave: 1
Subagent: Eligible
Owned scope: `frontend/src/lib/speech.ts`, `frontend/src/lib/markdownText.ts`, `frontend/src/components/ReadAloud.tsx`, `frontend/src/pages/PostPage.tsx` (one block under the meta row), tests
Produces: "Nghe bài viết" control on the post page using the device voice; no DB or Storage change; no voice picker (D1)

## Tasks

- [ ] `lib/markdownText.ts`: Markdown → plain-text paragraphs. Drop code fences (replace with "Đoạn mã."), images, HTML, link syntax (keep link text), heading/list/emphasis marks; split into paragraphs; trim empties. Unit tests with a sample post.
- [ ] `lib/speech.ts`: `createReader(paragraphs, { rate })` returning `{ play, pause, resume, stop, state, onChange }`; queue one `SpeechSynthesisUtterance` per paragraph (chunk paragraphs longer than ~800 chars at sentence ends); `pickVoice()` returns the first voice whose `lang` starts with `vi` (`getVoices()` may be empty until `voiceschanged`), else `null` (browser default); `supported()` guard. Unit tests with a fake `speechSynthesis`.
- [ ] `components/ReadAloud.tsx`: Play/Pause/Stop buttons, speed select (0.8/1/1.25/1.5), note "Thiết bị không có giọng tiếng Việt, dùng giọng mặc định" when no `vi` voice; no voice picker (D1); hidden when `supported()` is false; stops on unmount and when `slug` changes.
- [ ] `PostPage.tsx`: render `<ReadAloud title={post.title} markdown={post.content} />` under the header meta row (above the cover).
- [ ] Tests in `App.test.tsx`: control renders with a fake `speechSynthesis`; Play calls `speak` with the first paragraph; hidden when unsupported.

## Verification

frontend typecheck, lint, test, build. Browser smoke (machine A).

## Rollback or Recovery

Revert the merge commit; nothing persisted.

## Execution Notes

(none yet)
