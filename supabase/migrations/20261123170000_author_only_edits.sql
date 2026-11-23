-- Only a post's author edits it (D38). Admins still read and delete every post (spam clean-up),
-- but no longer change other users' posts or their tags. Deleting a post removes its tags
-- through the foreign key cascade, so admins need no tag policy for that.

drop policy "authors update own posts" on public.posts;
create policy "authors update own posts" on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy "authors tag own posts" on public.post_tags;
create policy "authors tag own posts" on public.post_tags for insert to authenticated
  with check (private.owns_post(post_id));

drop policy "authors untag own posts" on public.post_tags;
create policy "authors untag own posts" on public.post_tags for delete to authenticated
  using (private.owns_post(post_id));
