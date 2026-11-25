# P08: Supabase schema, security and storage

Status: Completed
Depends on: P07
Wave: 6
Subagent: Not eligible — owns the shared data contract
Owned scope: `supabase/**` (config, migrations, seed, tests)
Produces: Migrations + RLS + RPC + storage bucket policies; pgTAP tests; local stack via `supabase start`

Added by revision R2 (D21–D23).

## Tasks

- [x] `supabase init` (CLI via `npx supabase`), config: email auth only, sign-ups disabled, site URL for local dev — CLI 3.2.0 as root devDependency; `enable_signup = false`, min password 12, site URL http://localhost:5173
- [x] Migration: `categories`, `tags`, `posts` (status enum, `published_at`, cover image URL, author), `post_tags`, `comments` (status enum); indexes; length checks — cover stored as object name `cover_image_path`, not URL
- [x] Functions/triggers: `is_admin()` (`auth.jwt() -> app_metadata ->> role`), `updated_at`, `published_at` set on first publish, slug generation (`slugify` + unique suffix) when slug empty — `is_admin()` reads `private.site_admins` per D27; Vietnamese-aware slugify with NFC normalisation
- [x] RLS: anon/auth read published posts + terms + approved comments; admin full CRUD; no direct anon insert into comments
- [x] RPC `submit_comment(p_slug, p_author_name, p_content)` security definer: validation, published-only, PENDING, per-IP rate limit (3/min) from request headers
- [x] Storage: public bucket `post-images` (MIME allowlist, size cap); storage RLS insert/update/delete admin only — 2 MiB, webp/jpeg/png/gif, object names must be `<uuid>.<ext>`
- [x] Seed: sample category/tag/post; admin user created via script/docs (not committed credentials) — local-only seed admin `admin@example.com` / `local-dev-admin-password` (never pushed to hosted DBs)
- [x] pgTAP tests (`supabase test db`): anon cannot read drafts or pending comments, anon cannot write, admin can, submit_comment validation + rate limit, storage policies
- [x] D27: `private.site_admins` registry (`is_admin()` reads it) + `scripts/bootstrap-site-admin.sql` (fail-closed, idempotent, verified email) — plus `allow-account.sql`, `revoke-site-admin.sql`
- [x] D27: revoke execute on app functions from public/anon; grant only `submit_comment` to anon; test asserting anon can execute nothing else
- [x] D27: `before_user_created` hook rejecting sign-ups (enabled in `config.toml`) — allowlist `private.account_allowlist`
- [x] D27: check constraints: cover image URL / inline image references must point to the `post-images` public path or be null — cover constrained to `<uuid>.<ext>` object names; inline Markdown images restricted by frontend CSP/sanitizer (P09)
- [x] D27: `scripts/test-db-embedded.mjs` (PGlite + pgTAP with minimal auth/storage stubs) + npm script; documented limits

## Verification

- `npx supabase start`, `npx supabase db reset`, `npx supabase test db` pass

## Rollback or Recovery

Revert commits; `supabase db reset` locally.

## Execution Notes

- 2026-11-23: `npx supabase start` applied both migrations + seed (after fixing `new.title` access in the shared slug trigger via `to_jsonb(new)`). API smoke on the local stack: anon reads only the published post; anon insert → 401; `is_admin` not exposed (PGRST202); `submit_comment` → pending comment hidden from anon; admin password login works, `get_my_admin_status` true, admin sees pending; `/auth/v1/signup` → 422 signup_disabled.
- `npx supabase test db`: 3 suites, 36 assertions pass (real Supabase local stack). `npm run db:test:embedded` (PGlite): same 36 pass; harness verified to exit 1 on a failing assertion.
- Embedded limits: stubs only roles, auth.users/uid/jwt and storage tables; hook wiring, Data API and Storage service are covered only by the full stack.
