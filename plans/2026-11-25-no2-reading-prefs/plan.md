# Plan

## Strategy

One "Tuỳ chỉnh đọc" control on the post page (next to "Nghe bài viết") with a text-size stepper and a font picker. The choice is applied with `data-font` on `<html>` and a `--reader-size` variable on the article, stored in `localStorage`, and restored before first paint (same place as the theme). One `feature/*` branch merged `--no-ff` into `main`, then a security audit of the diff.

## Phase Table (authoritative)

| ID | Phase | Depends on | Wave | Subagent | Owned scope | Produces |
|---|---|---|---|---|---|---|
| P01 | [Reading preferences](phases/P01-reading-prefs.md) | None | 1 | Not eligible | `frontend/src/lib/readingPrefs.ts`, `frontend/src/components/ReadingPrefs.tsx`, `frontend/src/index.css`, `frontend/src/main.tsx` (restore on load), `frontend/src/pages/PostPage.tsx`, `frontend/package.json` (two fontsource packages), tests | Size stepper + font picker, default unchanged |
| P02 | [Docs](phases/P02-docs.md) | P01 | 2 | Not eligible | `README.md`, `frontend/README.md`, `docs/ideas.md`, this bundle | Docs and plan closure |

## Acceptance criteria

- A reader who never opens the control sees today's fonts and sizes (snapshot of computed `font-family` and `font-size` unchanged in tests).
- Picking "Lớn" enlarges the post body (paragraphs, headings, lists, code) and comments; cards, header, dashboard are unchanged.
- Picking "Lora" changes the body font site-wide; headings keep Epilogue; Vietnamese diacritics render (subset present).
- The choice survives a reload and applies before the first paint (no flash of the default font).
- Checks green: typecheck, lint, vitest, build; pgTAP unchanged (no migration).
