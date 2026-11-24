-- Engagement: view counts, likes and one level of comment replies.

-- ---------------------------------------------------------------------------
-- Counters live beside posts, so bumping them never touches posts.updated_at or its triggers
-- ---------------------------------------------------------------------------

create table public.post_stats (
  post_id uuid primary key references public.posts (id) on delete cascade,
  view_count bigint not null default 0 check (view_count >= 0),
  like_count bigint not null default 0 check (like_count >= 0)
);
alter table public.post_stats enable row level security;
revoke insert, update, delete, truncate on public.post_stats from anon, authenticated;
-- The lookup runs under the caller's RLS: stats are visible exactly when the post is.
create policy "stats of readable posts" on public.post_stats for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

-- ---------------------------------------------------------------------------
-- Views: one per client address, post and hour
-- ---------------------------------------------------------------------------

create table private.post_view_hits (
  post_id uuid not null references public.posts (id) on delete cascade,
  client text not null,
  hour timestamptz not null,
  primary key (post_id, client, hour)
);
create index post_view_hits_hour on private.post_view_hits (hour);

create function public.record_post_view(p_post_slug text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_post uuid;
  v_rows integer;
begin
  select id into v_post from public.posts
  where slug = p_post_slug and status = 'published' and published_at <= now();
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

-- ---------------------------------------------------------------------------
-- Likes: signed-in, active users like a live post once
-- ---------------------------------------------------------------------------

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user on public.post_likes (user_id);

alter table public.post_likes enable row level security;
revoke insert, update, delete, truncate on public.post_likes from anon;
revoke update, truncate on public.post_likes from authenticated;
create policy "own likes readable" on public.post_likes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users like live posts" on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active() and exists (
    select 1 from public.posts p
    where p.id = post_id and p.status = 'published' and p.published_at <= now()));
create policy "users remove own likes" on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create function private.count_like() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.post_stats (post_id, like_count) values (new.post_id, 1)
    on conflict (post_id) do update set like_count = public.post_stats.like_count + 1;
  else
    update public.post_stats set like_count = greatest(like_count - 1, 0)
    where post_id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function private.count_like();

-- ---------------------------------------------------------------------------
-- Replies: a comment may answer a top-level comment on the same post (one level deep)
-- ---------------------------------------------------------------------------

alter table public.comments
  add column parent_id uuid references public.comments (id) on delete cascade;
create index comments_parent on public.comments (parent_id);

drop function public.submit_comment(text, text, text);

-- Guest comment or reply: validated, shown immediately, max 3 per minute per client address.
create function public.submit_comment(
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
  where slug = p_post_slug and status = 'published' and published_at <= now();
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

revoke execute on function public.submit_comment(text, text, text, uuid),
  public.record_post_view(text) from public, anon, authenticated;
grant execute on function public.submit_comment(text, text, text, uuid) to anon, authenticated;
grant execute on function public.record_post_view(text) to anon, authenticated;
