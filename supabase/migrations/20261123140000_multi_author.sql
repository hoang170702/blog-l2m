-- Revision R3: multi-author blog with open OAuth sign-up.
-- Anyone signed in writes posts and publishes them without review; everyone reads published
-- posts; authors manage only their own posts, images and the comments on their posts; site
-- admins (private.site_admins) keep full control. Accounts and OAuth identities stay in
-- auth.users / auth.identities; public.profiles holds the public author card. Provider
-- access/refresh tokens are never stored.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  avatar_url text check (avatar_url ~ '^https://'),
  provider text,
  created_at timestamptz not null default now()
);

-- Name and avatar come from the OAuth provider (Google: full_name/name/picture,
-- GitHub: full_name/name/user_name/avatar_url), else the email's local part.
create function private.profile_from_user(u auth.users) returns public.profiles
language sql stable set search_path = ''
as $$
  select row(
    u.id,
    left(coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'user_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Thành viên'
    ), 80),
    case when coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') ~ '^https://'
         then coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') end,
    u.raw_app_meta_data ->> 'provider',
    coalesce(u.created_at, now())
  )::public.profiles
$$;

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles select (private.profile_from_user(new)).*
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.create_profile();

insert into public.profiles select (private.profile_from_user(u)).* from auth.users u
on conflict (id) do nothing;

alter table public.profiles enable row level security;
revoke insert, update, delete, truncate on public.profiles from anon;
revoke insert, update, delete, truncate on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
create policy "profiles readable" on public.profiles for select to anon, authenticated using (true);
create policy "own profile editable" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Lets the Data API embed the author card (posts -> profiles).
alter table public.posts
  add constraint posts_author_profile_fkey foreign key (author_id)
  references public.profiles (id) on delete set null;

-- The author is always the caller; nobody can post as someone else or take over a post.
create function private.set_post_author() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.author_id := (select auth.uid());
    end if;
  else
    new.author_id := old.author_id;
  end if;
  return new;
end;
$$;
create trigger posts_author before insert or update on public.posts
  for each row execute function private.set_post_author();

-- Cover images now live under the uploader's folder: <user_id>/<uuid>.<ext>.
alter table public.posts drop constraint posts_cover_image_path_check;
alter table public.posts add constraint posts_cover_image_path_check
  check (cover_image_path ~ '^([0-9a-f-]{36}/)?[0-9a-f-]{36}\.(webp|jpg|png|gif)$');

-- ---------------------------------------------------------------------------
-- Ownership helpers
-- ---------------------------------------------------------------------------

create function private.owns_post(p_post uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.posts where id = p_post and author_id = (select auth.uid()))
$$;
revoke execute on function private.owns_post(uuid) from public, anon;
grant execute on function private.owns_post(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Posts and post tags: authors own theirs, admins everything
-- ---------------------------------------------------------------------------

drop policy "posts readable by signed-in" on public.posts;
drop policy "admin writes posts" on public.posts;
drop policy "admin updates posts" on public.posts;
drop policy "admin deletes posts" on public.posts;

create policy "posts readable by signed-in" on public.posts for select to authenticated
  using (status = 'published' or author_id = (select auth.uid()) or private.is_admin());
create policy "signed-in users write posts" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "authors update own posts" on public.posts for update to authenticated
  using (author_id = (select auth.uid()) or private.is_admin())
  with check (author_id = (select auth.uid()) or private.is_admin());
create policy "authors delete own posts" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_admin());

drop policy "post tags readable by signed-in" on public.post_tags;
drop policy "admin manages post tags" on public.post_tags;

create policy "post tags readable by signed-in" on public.post_tags for select to authenticated
  using (private.owns_post(post_id) or private.is_admin() or exists (
    select 1 from public.posts p where p.id = post_id and p.status = 'published'));
create policy "authors tag own posts" on public.post_tags for insert to authenticated
  with check (private.owns_post(post_id) or private.is_admin());
create policy "authors untag own posts" on public.post_tags for delete to authenticated
  using (private.owns_post(post_id) or private.is_admin());

-- ---------------------------------------------------------------------------
-- Tags: any author may add one; renaming and deleting stay with admins
-- ---------------------------------------------------------------------------

create policy "signed-in users add tags" on public.tags for insert to authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- Comments: the post's author moderates too
-- ---------------------------------------------------------------------------

drop policy "comments readable by signed-in" on public.comments;
drop policy "admin moderates comments" on public.comments;
drop policy "admin deletes comments" on public.comments;

create policy "comments readable by signed-in" on public.comments for select to authenticated
  using (private.is_admin() or private.owns_post(post_id) or (status = 'approved' and exists (
    select 1 from public.posts p where p.id = post_id and p.status = 'published')));
create policy "authors moderate comments" on public.comments for update to authenticated
  using (private.is_admin() or private.owns_post(post_id))
  with check (private.is_admin() or private.owns_post(post_id));
create policy "authors delete comments" on public.comments for delete to authenticated
  using (private.is_admin() or private.owns_post(post_id));

-- ---------------------------------------------------------------------------
-- Storage: every signed-in user has a folder named after their user id
-- ---------------------------------------------------------------------------

drop policy "admin uploads post images" on storage.objects;
drop policy "admin updates post images" on storage.objects;
drop policy "admin deletes post images" on storage.objects;
drop policy "admin lists post images" on storage.objects;

create policy "users upload own post images" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images'
              and split_part(name, '/', 1) = (select auth.uid())::text
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png|gif)$');
create policy "users list own post images" on storage.objects for select to authenticated
  using (bucket_id = 'post-images'
         and (split_part(name, '/', 1) = (select auth.uid())::text or private.is_admin()));
create policy "users update own post images" on storage.objects for update to authenticated
  using (bucket_id = 'post-images'
         and (split_part(name, '/', 1) = (select auth.uid())::text or private.is_admin()))
  with check (bucket_id = 'post-images'
              and (split_part(name, '/', 1) = (select auth.uid())::text or private.is_admin()));
create policy "users delete own post images" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images'
         and (split_part(name, '/', 1) = (select auth.uid())::text or private.is_admin()));

-- ---------------------------------------------------------------------------
-- Sign-up is open now: drop the allowlist hook and its table
-- ---------------------------------------------------------------------------

drop function public.hook_before_user_created(jsonb);
drop table private.account_allowlist;
