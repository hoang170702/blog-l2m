# Product ideas

Backlog of product ideas for L2M Blog, from a product review of the current code (2026-11-23). Nothing here is scheduled; an idea moves into a plan once it is picked.

Current baseline: multi-author Markdown posts, Google/GitHub sign-in, categories (admin) and tags (any author), guest comments shown immediately, search over title, excerpt and content without accents, author pages, one 16:9 cover per post, static SPA on GitLab Pages talking to Supabase.

## Done

Details and commits are in `plans/2026-11-23-no1-blog-monorepo/` (decisions D34-D50, evidence A016-A038).

- Comments without moderation (D34).
- One 16:9 cover per post, no images in the body (D37).
- Only the author edits a post; admins may delete (D38).
- Replaced, removed and deleted covers are deleted from Storage (D39).
- Search over title, excerpt and content, ignoring case and Vietnamese accents (D40).
- Author page `/u/:id` (D41).
- 2026-11-24: RSS feed and sitemap (Edge Function `feed`); reading time, table of contents and related posts; view counts (one per address, post and hour) and likes; one level of comment replies; local autosave in the editor; scheduled publishing; reports with an admin queue, account suspension, and rate limits on new posts (10/hour) and image uploads (30/hour); delete from the post page for the author or an admin; profile page. Migrations `20261124090000`-`20261124090200`.
- 2026-11-25 (R4, one feature branch each, merged into `main`): dark theme (D45); share buttons (D46); comment counts and view/like totals on the dashboard (D48); bookmarks (D42); admin hide via `posts.hidden_at` (D49); profanity mask with partial IP, full IP + device for admins/author, IP blocks (D50); follows and `/following` (D43); series (D47); in-app notifications (D44). Migrations `20261125100000`-`20261125150000`. Dropped: draft preview links (idea 7), CSS default covers (idea 10).
- 2026-11-25: "Nghe bài viết" with the browser's Web Speech API (`plans/2026-11-25-no1-audio/`, D1). No storage, no server. The user first wanted four regional voices (nam/nữ Bắc, nam/nữ Nam): only paid Vietnamese TTS (FPT.AI, Viettel, Zalo) has them and the free tiers cover about one post-voice a day, so voice choice was dropped.
- 2026-11-25: security-audit fixes (migration `20261125160000`): one like notification per liker and post and one new-post notification per follower and post (unique index, `on conflict do nothing`), no follower notification for a post an admin hid, the API role may only update `comments.status` (authors could rewrite `content`, `masked`, `client_hint` before), and the read-aloud Markdown stripper uses bounded regexes (an unclosed `<a<a…` body of 40 kB took 5 s to convert before, 20 ms after).

## Accepted direction

### Comments without moderation (done, D34)

Anyone may comment and the comment shows immediately; there is no approval step.

Scope: one migration, `submit_comment`, frontend, tests. No backfill: comments have no production data yet.

- Migration (forward-only): `comments.status` defaults to `approved`; `submit_comment` inserts `approved` explicitly and keeps the 3 comments/min per client limit. The `pending` enum value stays in the type but is no longer written, and the UI never shows it.
- The post author and admins can hide (`rejected`) a comment, show it again (`approved`), or delete it. Hide/delete exist only to remove spam after it shows.
- Touchpoints:
  - `frontend/src/api/endpoints.ts`: `submitComment` returns `APPROVED` (264); drop the pending count from dashboard stats (437-457); the row status type (68).
  - `frontend/src/api/types.ts`: `CommentStatus` (53), `pendingComments` (74).
  - `frontend/src/pages/CommentSection.tsx`: replace the "hiển thị sau khi được duyệt" message (82) and refetch the list so the new comment appears.
  - `frontend/src/pages/admin/DashboardPage.tsx`: remove the "Bình luận chờ duyệt" card (74-75).
  - `frontend/src/pages/admin/CommentsPage.tsx`: labels "Đang hiện" / "Đã ẩn" (13-14); default filter "Tất cả" (24); buttons "Ẩn", "Hiện lại", "Xoá" instead of "Duyệt" / "Từ chối" (88-102).
  - Tests: `frontend/src/App.test.tsx` (48-66), `supabase/tests/database/functions_test.sql` (36), `supabase/tests/database/access_test.sql` (20).
  - Decision D31 in the plan bundle.

## Engagement

- Email the author about new comments on their posts (Supabase Edge Function); in-app notifications exist, email does not.
- Notify followers when a scheduled post's time arrives (today the notification goes out when the author publishes, which for a scheduled post is before it is readable).

## Writing

- Audio follow-ups: regional voices through FPT.AI/Viettel TTS (paid, Edge Function + `post-audio` bucket, see the audio plan's context.md); author recordings per post (researched as Option B there); highlight the paragraph being read.

## Community safety

- Profanity filter matches whole words only; split or disguised spellings ("đ.m", "v c l") get through. A normalization step (strip punctuation between single letters) would catch more.
- IP blocks are temporary by nature (mobile networks, VPNs); a block by account for signed-in commenters would be stronger once comments require sign-in.
- Left open after the 2026-11-25 security audit (low impact, not fixed): an author can escape an admin hide by deleting and re-creating the post (a hide by author, i.e. suspension, already exists); the post author sees the full address and device of commenters by design (D50); `posts.hidden_by` is readable by the author; no retention limit on `private.comment_clients`; GitHub Actions in `.github/workflows` are pinned to major tags, not commit SHAs; the two moderate `npm audit` findings are build-time only (`postcss-selector-parser` via `@tailwindcss/typography`).

## Measurement

- Cookie-less analytics such as Umami or Plausible.
- Pick one north-star metric, for example "posts read past 50% per week" or "authors who publish at least one post a month".

## Housekeeping

- `README.md` and `AGENTS.md` still describe NestJS, Redis and the VPS deploy, although commit `c1eca3c` removed the backend in favour of Supabase + GitLab Pages.

## Suggested order

1. Verify on Supabase cloud what machine B could not: IP and user-agent capture in `private.comment_clients` (locally the address is `unknown`), the Edge Function `feed`, and every new page in a browser.
2. Clean up covers uploaded but never saved (scheduled job over `storage.objects` not referenced by `posts.cover_image_path`; needs an Edge Function with the service key, because Storage files cannot be deleted through SQL).

## Rejected

- Per-post Open Graph / Twitter meta tags prerendered in CI: not needed.
- Showing only signed-in users' comments immediately while keeping guest moderation: replaced by "comments without moderation" for everyone.
