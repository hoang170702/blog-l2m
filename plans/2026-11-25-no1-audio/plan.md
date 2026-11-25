# Plan

## Strategy

One "Nghe bài viết" control on the post page, built on the browser's Web Speech API. P01 ships without any database or Storage change; P03 documents and smokes. P02 (author audio files) was dropped by the user. Each phase is its own `feature/*` branch merged `--no-ff` into `main` (same workflow as R4 of PLAN-20261123-blog-monorepo).

## Phase Table (authoritative)

| ID | Phase | Depends on | Wave | Subagent | Owned scope | Produces |
|---|---|---|---|---|---|---|
| P01 | [Read aloud](phases/P01-read-aloud.md) | None | 1 | Eligible | `frontend/src/lib/speech.ts`, `frontend/src/lib/markdownText.ts`, `frontend/src/components/ReadAloud.tsx`, `frontend/src/pages/PostPage.tsx`, tests | Play/Pause/Stop + speed + voice picker reading the post body |
| P03 | [Docs and smoke](phases/P03-docs-and-smoke.md) | P01 | 2 | Not eligible | `README.md`, `frontend/README.md`, `docs/ideas.md`, this bundle | Docs, plan closure, machine A smoke list |

## Acceptance criteria

- A reader on a device with a `vi-VN` voice presses "Nghe" and hears the post from the first paragraph; Pause/Resume/Stop work; leaving the page stops the speech.
- Without a Vietnamese voice the control still works with the default voice and tells the reader.
- Speech uses the device's `vi-VN` voice when one exists; no voice picker.
- All checks green.
