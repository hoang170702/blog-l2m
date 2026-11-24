-- Scheduled publishing: a published post whose published_at lies in the future stays hidden from
-- everyone except its author and admins until that time. The post_tags and comments policies
-- look posts up under the caller's RLS, so they follow these two policies without changes;
-- security-definer RPCs check published_at themselves.

drop policy "published posts readable" on public.posts;
create policy "published posts readable" on public.posts for select to anon
  using (status = 'published' and published_at <= now());

drop policy "posts readable by signed-in" on public.posts;
create policy "posts readable by signed-in" on public.posts for select to authenticated
  using ((status = 'published' and published_at <= now())
         or author_id = (select auth.uid()) or private.is_admin());
