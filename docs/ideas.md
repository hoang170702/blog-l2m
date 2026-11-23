# Product ideas

Backlog of product ideas for L2M Blog, from a product review of the current code (2026-11-23). Nothing here is scheduled; an idea moves into a plan once it is picked.

Current baseline: multi-author Markdown posts, Google/GitHub sign-in, categories (admin) and tags (any author), guest comments shown immediately, search over title, excerpt and content without accents, author pages, one 16:9 cover per post, static SPA on GitLab Pages talking to Supabase.

## Done

Details and commits are in `plans/2026-11-23-no1-blog-monorepo/` (decisions D34-D41, evidence A016-A027).

- Comments without moderation (D34).
- One 16:9 cover per post, no images in the body (D37).
- Only the author edits a post; admins may delete (D38).
- Replaced, removed and deleted covers are deleted from Storage (D39).
- Search over title, excerpt and content, ignoring case and Vietnamese accents (D40).
- Author page `/u/:id` (D41).

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

## Readers and discovery

| Idea | Why | Effort |
| --- | --- | --- |
| RSS feed and `sitemap.xml` | Readers can subscribe; search engines can index posts | Low if generated at build time, but the files go stale between deploys unless a scheduled pipeline rebuilds them; a Supabase Edge Function serving them live avoids that (Medium) |
| Related posts at the end of a post, by tag or category | Keeps readers on the site | Low |
| Reading time and table of contents for long posts | Easier reading | Low |

## Engagement

- Reactions / likes on posts: a `reactions` table unique on `(post_id, user_id)`.
- View count through an increment RPC, shown on the author's dashboard.
- Replies to comments (one level).
- Email the author about new comments on their posts (Supabase Edge Function).
- Bookmarks / read later for signed-in users.

## Writing

- Autosave drafts every few seconds (the editor only warns about unsaved changes today).
- Scheduled publishing: `published_at` in the future, readable only once `published_at <= now()`. Medium effort: every RLS policy and query that checks `status = 'published'` (posts, post tags, comments, `submit_comment`) needs the extra condition, and the editor needs a date picker (the `set_published_at` trigger already keeps a date that is set).
- Post series with an ordered list of parts.
- Shareable preview link for a draft, to get feedback before publishing.
- Per-post stats on the dashboard: views, comments, reactions.

## Community safety

Sign-up is open (D28/D29 accept the spam risk); these matter once the user count grows.

- Report a post or comment, with a review queue for admins.
- Admins hide posts or suspend accounts.
- Rate limits on creating posts and uploading images (today only the 2 MiB image cap and the comment limit exist).

## Measurement

- Cookie-less analytics such as Umami or Plausible.
- Pick one north-star metric, for example "posts read past 50% per week" or "authors who publish at least one post a month".

## Housekeeping

- `README.md` and `AGENTS.md` still describe NestJS, Redis and the VPS deploy, although commit `c1eca3c` removed the backend in favour of Supabase + GitLab Pages.

## Suggested order

1. RSS + sitemap.
2. Clean up covers uploaded but never saved (scheduled job over `storage.objects` not referenced by `posts.cover_image_path`).
3. Fix `frontend/vitest.config.ts` (fails at startup: "Cannot merge config in form of callback") and rewrite `App.test.tsx`, which still mocks the removed REST API.

## Rejected

- Per-post Open Graph / Twitter meta tags prerendered in CI: not needed.
- Showing only signed-in users' comments immediately while keeping guest moderation: replaced by "comments without moderation" for everyone.
