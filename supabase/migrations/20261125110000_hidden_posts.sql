-- Admin hide (D49): an admin takes a post offline without deleting it. A hidden post is visible only
-- to its author (who sees a banner) and to admins; nobody else can read, like, comment, report or
-- record views on it. The author cannot clear the flag; admin_set_hidden() does.
-- Implemented as a timestamp rather than a post_status value: a new enum value cannot be used in
-- the transaction that adds it, and the status/schedule logic stays untouched.

alter table public.posts
  add column hidden_at timestamptz,
  add column hidden_by uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- "Live" = published, time reached, not hidden. One definition for policies and RPCs.
-- ---------------------------------------------------------------------------

create function private.is_live(p_status public.post_status, p_published_at timestamptz, p_hidden_at timestamptz)
returns boolean
language sql stable set search_path = ''
as $$
  select p_status = 'published' and p_published_at <= now() and p_hidden_at is null
$$;
revoke execute on function private.is_live(public.post_status, timestamptz, timestamptz) from public;
grant execute on function private.is_live(public.post_status, timestamptz, timestamptz) to anon, authenticated;

-- Runs with the owner's rights so dependent tables can test a post the caller may not read.
create function private.post_is_live(p_post uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.posts p
    where p.id = p_post and private.is_live(p.status, p.published_at, p.hidden_at))
$$;
revoke execute on function private.post_is_live(uuid) from public;
grant execute on function private.post_is_live(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies: the author still sees their hidden post; everyone else only live posts
-- ---------------------------------------------------------------------------

drop policy "published posts readable" on public.posts;
create policy "published posts readable" on public.posts for select to anon
  using (private.is_live(status, published_at, hidden_at));

drop policy "posts readable by signed-in" on public.posts;
create policy "posts readable by signed-in" on public.posts for select to authenticated
  using (private.is_live(status, published_at, hidden_at)
         or author_id = (select auth.uid()) or private.is_admin());

drop policy "tags of published posts readable" on public.post_tags;
create policy "tags of published posts readable" on public.post_tags for select to anon
  using (private.post_is_live(post_id));

drop policy "post tags readable by signed-in" on public.post_tags;
create policy "post tags readable by signed-in" on public.post_tags for select to authenticated
  using (private.owns_post(post_id) or private.is_admin() or private.post_is_live(post_id));

drop policy "approved comments readable" on public.comments;
create policy "approved comments readable" on public.comments for select to anon
  using (status = 'approved' and private.post_is_live(post_id));

drop policy "comments readable by signed-in" on public.comments;
create policy "comments readable by signed-in" on public.comments for select to authenticated
  using (private.is_admin() or private.owns_post(post_id)
         or (status = 'approved' and private.post_is_live(post_id)));

drop policy "users like live posts" on public.post_likes;
create policy "users like live posts" on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active() and private.post_is_live(post_id));

drop policy "users bookmark live posts" on public.bookmarks;
create policy "users bookmark live posts" on public.bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active() and private.post_is_live(post_id));

-- Only admins change the hide flag; any other update keeps the stored values.
create function private.keep_hidden_flag() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    new.hidden_at := old.hidden_at;
    new.hidden_by := old.hidden_by;
  end if;
  return new;
end;
$$;
create trigger posts_keep_hidden before update on public.posts
  for each row execute function private.keep_hidden_flag();

-- ---------------------------------------------------------------------------
-- RPCs look the post up through is_live too
-- ---------------------------------------------------------------------------

create or replace function public.record_post_view(p_post_slug text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_post uuid;
  v_rows integer;
begin
  select id into v_post from public.posts
  where slug = p_post_slug and private.is_live(status, published_at, hidden_at);
  if v_post is null then
    return;
  end if;

  delete from private.post_view_hits where hour < now() - interval '1 day';
  insert into private.post_view_hits (post_id, client, hour)
  values (v_post, private.request_client(), date_trunc('hour', now()))
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    insert into public.post_stats (post_id, view_count) values (v_post, 1)
    on conflict (post_id) do update set view_count = public.post_stats.view_count + 1;
  end if;
end;
$$;

create or replace function public.submit_comment(
  p_post_slug text, p_author_name text, p_content text, p_parent_id uuid default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_post uuid;
  v_name text := btrim(coalesce(p_author_name, ''));
  v_content text := btrim(coalesce(p_content, ''));
  v_client text := private.request_client();
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'author name must be 1-60 characters' using errcode = '22023';
  end if;
  if char_length(v_content) not between 1 and 2000 then
    raise exception 'comment must be 1-2000 characters' using errcode = '22023';
  end if;

  select id into v_post from public.posts
  where slug = p_post_slug and private.is_live(status, published_at, hidden_at);
  if v_post is null then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.comments
    where id = p_parent_id and post_id = v_post and parent_id is null and status = 'approved'
  ) then
    raise exception 'the comment you reply to no longer exists' using errcode = '22023';
  end if;

  delete from private.comment_attempts where created_at < now() - interval '1 hour';
  if (select count(*) from private.comment_attempts
      where client = v_client and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'too many comments, try again in a minute' using errcode = 'P0429';
  end if;
  insert into private.comment_attempts (client) values (v_client);

  insert into public.comments (post_id, parent_id, author_name, content, status)
  values (v_post, p_parent_id, v_name, v_content, 'approved')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.report_content(p_post_id uuid, p_comment_id uuid, p_reason text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_client text := private.request_client();
  v_id uuid;
begin
  if num_nonnulls(p_post_id, p_comment_id) <> 1 then
    raise exception 'report exactly one post or comment' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 1 and 500 then
    raise exception 'reason must be 1-500 characters' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.posts p
    left join public.comments c on c.post_id = p.id and c.id = p_comment_id
    where private.is_live(p.status, p.published_at, p.hidden_at)
      and (p.id = p_post_id or (c.id is not null and c.status = 'approved'))
  ) then
    raise exception 'content not found' using errcode = 'P0002';
  end if;

  delete from private.report_attempts where created_at < now() - interval '1 hour';
  if (select count(*) from private.report_attempts
      where client = v_client and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'too many reports, try again later' using errcode = 'P0429';
  end if;
  insert into private.report_attempts (client) values (v_client);

  insert into public.reports (post_id, comment_id, reason, reporter_id)
  values (p_post_id, p_comment_id, v_reason, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPC
-- ---------------------------------------------------------------------------

create function public.admin_set_hidden(p_post uuid, p_hidden boolean) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.posts
  set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end,
      hidden_by = case when p_hidden then (select auth.uid()) end
  where id = p_post;
  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.admin_set_hidden(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_hidden(uuid, boolean) to authenticated;
