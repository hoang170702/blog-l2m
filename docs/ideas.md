# Product ideas

Backlog of product ideas for L2M Blog, from a product review of the current code (2026-11-23). Nothing here is scheduled; an idea moves into a plan once it is picked.

Current baseline: multi-author Markdown posts, Google/GitHub sign-in, categories (admin) and tags (any author), guest comments, title-only search (`ilike` on `title`), static SPA on GitLab Pages talking to Supabase.

## Accepted direction

### Comments without moderation

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
| Full-text search with Postgres `tsvector` + `unaccent` | Matches content as well as titles, and "lap trinh" finds "lập trình" | Low (one migration, one RPC) |
| Author page `/u/:id` | `profiles` exists but no page lists an author's posts | Low |
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

1. Comments without moderation (accepted).
2. RSS + sitemap.
3. Full-text search with accent folding.
4. Author page.

## Rejected

- Per-post Open Graph / Twitter meta tags prerendered in CI: not needed.
- Showing only signed-in users' comments immediately while keeping guest moderation: replaced by "comments without moderation" for everyone.
