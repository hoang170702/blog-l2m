# P01: Reading preferences

Status: Completed (2026-11-25 16:40 +07, machine B)
Depends on: None
Wave: 1
Subagent: Not eligible
Owned scope: `frontend/src/lib/readingPrefs.ts`, `frontend/src/components/ReadingPrefs.tsx`, `frontend/src/index.css`, `frontend/src/main.tsx`, `frontend/src/pages/PostPage.tsx`, `frontend/src/pages/CommentSection.tsx` (size variable only), `frontend/package.json`, tests
Produces: "Tuỳ chỉnh đọc" control on the post page; default look unchanged (D1)

## Tasks

- [x] `npx npm@11 install @fontsource/be-vietnam-pro @fontsource-variable/lora` (npm 11 per AGENTS.md); import the `vietnamese`-subset CSS in `index.css` (Be Vietnam Pro weights 400/600/700; Lora variable).
- [x] `index.css`: `[data-font='be-vietnam'] { --font-sans: 'Be Vietnam Pro', … }`, `[data-font='lora']`, `[data-font='system']`; the article gets `font-size: var(--reader-size, 1.125rem)` through a `.reader` class whose `prose` scales from it (Tailwind typography uses `em`, so one variable is enough).
- [x] `lib/readingPrefs.ts`: `FONTS` and `SIZES` tables (D2, D3), `getPrefs()`/`setPrefs()` on `localStorage` key `reading-prefs` with validation (unknown values fall back to defaults), `applyPrefs()` sets `data-font` on `<html>` and `--reader-size` on `:root`. Unit tests: defaults, persistence, invalid JSON, unknown font.
- [x] `main.tsx`: call `applyPrefs(getPrefs())` next to the theme restore so the font is set before React renders.
- [x] `components/ReadingPrefs.tsx`: a `<details>`-free inline bar: label "Aa", buttons A− / A+ (disabled at the ends, `aria-label` "Chữ nhỏ hơn" / "Chữ lớn hơn"), a `<select>` of fonts (own `.input` styling, not the browser default), "Mặc định" link to reset when anything differs. Shares the row with `ReadAloud` on the post page.
- [x] `PostPage.tsx`: wrap the body `prose` in the `.reader` class and render `<ReadingPrefs />` next to `<ReadAloud />`; `CommentSection` comment text also uses `var(--reader-size)`.
- [x] Tests: `readingPrefs.test.ts`; `ReadingPrefs.test.tsx` (A+ changes the variable and persists; select changes `data-font`; reset returns to defaults); `App.test.tsx` smoke renders the control on a post.

## Verification

frontend typecheck, lint, test, build. Visual check with the skill's probe on the local build at 375 and 1280 (control does not wrap the header row; select styled).

## Rollback or Recovery

Revert the merge commit; `localStorage` key is ignored by older code.

## Execution Notes

- Branch `feature/reading-prefs` from `main` f18d00a. Sizes are 16/18/20/22 px (18 = today's `prose-lg`), not the 15–21 of the first draft, so the default stays pixel-identical (D1/D3 corrected). The size rules are unlayered CSS because the typography utilities sit in a later cascade layer and would win otherwise. `ReadAloud` and `ReadingPrefs` share one `md:grid-cols-2` row under the post header. Tests: `readingPrefs.test.ts` (4), `ReadingPrefs.test.tsx` (3); vitest 76 / 19 files, typecheck, lint, build (9 Vietnamese-subset font files emitted). Not verified: the control in a real browser (production database lacks the `20261125*` migrations, so the local build cannot open a post).
