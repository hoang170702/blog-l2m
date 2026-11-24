-- Table privileges for the Data API roles, granted explicitly. Earlier migrations assumed
-- Supabase's old default (every new public table fully granted to anon/authenticated/service_role)
-- and only revoked from it; projects created with "auto-expose new tables" off get no grants at
-- all, so anon was refused even published posts. This restores exactly the privileges the
-- earlier migrations left in place; row-level security still decides which rows each role sees.
-- New tables must grant their own privileges.

grant usage on schema public to anon, authenticated, service_role;

-- Signed-out visitors only ever read (reports and likes stay hidden from them).
grant select on public.categories, public.tags, public.posts, public.post_tags, public.comments,
  public.profiles, public.post_stats to anon;

-- Signed-in users: RLS limits writes to their own rows or to admins.
grant select, insert, update, delete on public.categories, public.tags, public.posts,
  public.post_tags to authenticated;
-- Comments are only created through submit_comment().
grant select, update, delete on public.comments to authenticated;
grant select on public.profiles, public.post_stats to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
-- Reports are only created through report_content().
grant select, update, delete on public.reports to authenticated;

grant all on all tables in schema public to service_role;
