-- Community safety: suspended accounts, content reports with an admin review queue, and rate
-- limits on new posts and image uploads. Sign-up stays open (D28/D29); these limit the damage.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Client address for rate limits. The leftmost X-Forwarded-For entry is whatever the client sent,
-- so it is never used: Cloudflare's CF-Connecting-IP (set by the edge, not by the client) wins,
-- else the rightmost entry, which the proxy in front of the Data API appended itself.
create function private.request_client() returns text
language sql stable set search_path = ''
as $$
  with headers as (
    select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h
  )
  select coalesce(
    nullif(btrim(h ->> 'cf-connecting-ip'), ''),
    nullif(btrim((regexp_split_to_array(coalesce(h ->> 'x-forwarded-for', ''), ','))[
      cardinality(regexp_split_to_array(coalesce(h ->> 'x-forwarded-for', ''), ','))]), ''),
    'unknown')
  from headers
$$;
revoke execute on function private.request_client() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Suspended accounts: they keep reading and signing in, but can no longer write
-- ---------------------------------------------------------------------------

create table private.suspended_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users (id) on delete set null
);

create function private.is_active() returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
     and not exists (select 1 from private.suspended_users where user_id = (select auth.uid()))
$$;
revoke execute on function private.is_active() from public, anon;
grant execute on function private.is_active() to authenticated;

drop policy "signed-in users write posts" on public.posts;
create policy "signed-in users write posts" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_active());

drop policy "authors update own posts" on public.posts;
create policy "authors update own posts" on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and private.is_active());

drop policy "authors tag own posts" on public.post_tags;
create policy "authors tag own posts" on public.post_tags for insert to authenticated
  with check (private.owns_post(post_id) and private.is_active());

drop policy "authors untag own posts" on public.post_tags;
create policy "authors untag own posts" on public.post_tags for delete to authenticated
  using (private.owns_post(post_id) and private.is_active());

drop policy "signed-in users add tags" on public.tags;
create policy "signed-in users add tags" on public.tags for insert to authenticated
  with check (private.is_active());

drop policy "own profile editable" on public.profiles;
create policy "own profile editable" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and private.is_active());

-- ---------------------------------------------------------------------------
-- Rate limits: 10 new posts and 30 image uploads per hour per author (admins exempt)
-- ---------------------------------------------------------------------------

create function private.limit_new_posts() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() and (
    select count(*) from public.posts
    where author_id = (select auth.uid()) and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many new posts, try again later' using errcode = 'P0429';
  end if;
  return new;
end;
$$;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function private.limit_new_posts();

create function private.upload_quota_left() returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_admin() or (
    select count(*) from storage.objects
    where bucket_id = 'post-images'
      and split_part(name, '/', 1) = (select auth.uid())::text
      and created_at > now() - interval '1 hour') < 30
$$;
revoke execute on function private.upload_quota_left() from public, anon;
grant execute on function private.upload_quota_left() to authenticated;

drop policy "users upload own post images" on storage.objects;
create policy "users upload own post images" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images'
              and split_part(name, '/', 1) = (select auth.uid())::text
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png|gif)$'
              and private.is_active()
              and private.upload_quota_left());

-- ---------------------------------------------------------------------------
-- Reports: anyone may report a post or a comment; admins review them
-- ---------------------------------------------------------------------------

create type public.report_status as enum ('open', 'resolved', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  reporter_id uuid references auth.users (id) on delete set null,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  check (num_nonnulls(post_id, comment_id) = 1)
);
create index reports_status_time on public.reports (status, created_at desc);
create index reports_post on public.reports (post_id);
create index reports_comment on public.reports (comment_id);

alter table public.reports enable row level security;
revoke all on public.reports from anon;
revoke insert on public.reports from authenticated;
create policy "admins read reports" on public.reports for select to authenticated
  using (private.is_admin());
create policy "admins resolve reports" on public.reports for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "admins delete reports" on public.reports for delete to authenticated
  using (private.is_admin());

create table private.report_attempts (
  client text not null,
  created_at timestamptz not null default now()
);
create index report_attempts_client_time on private.report_attempts (client, created_at);

-- Exactly one of p_post_id / p_comment_id; only content the public can see may be reported.
-- Max 5 reports per 10 minutes per client address.
create function public.report_content(p_post_id uuid, p_comment_id uuid, p_reason text)
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
    where p.status = 'published' and p.published_at <= now()
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
-- Admin RPCs: member list and suspensions (the registry itself stays private)
-- ---------------------------------------------------------------------------

create function public.admin_list_users(p_query text default null, p_page integer default 1)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  email text,
  created_at timestamptz,
  post_count bigint,
  is_admin boolean,
  suspended_at timestamptz,
  suspended_reason text,
  total bigint
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select p.id, p.display_name, p.avatar_url, u.email::text, p.created_at,
           (select count(*) from public.posts po where po.author_id = p.id),
           exists (select 1 from private.site_admins a where a.user_id = p.id),
           s.suspended_at, s.reason,
           count(*) over ()
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join private.suspended_users s on s.user_id = p.id
    where coalesce(btrim(p_query), '') = ''
       or private.fold_vi(p.display_name || ' ' || coalesce(u.email, ''))
          like '%' || private.fold_vi(btrim(p_query)) || '%'
    order by p.created_at desc
    limit 20 offset (greatest(coalesce(p_page, 1), 1) - 1) * 20;
end;
$$;

create function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if exists (select 1 from private.site_admins where user_id = p_user) then
    raise exception 'admins cannot be suspended' using errcode = '22023';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'reason must be at most 500 characters' using errcode = '22023';
  end if;
  if p_suspended then
    insert into private.suspended_users (user_id, reason, suspended_by)
    values (p_user, nullif(btrim(p_reason), ''), (select auth.uid()))
    on conflict (user_id) do update
      set reason = excluded.reason, suspended_at = now(), suspended_by = excluded.suspended_by;
  else
    delete from private.suspended_users where user_id = p_user;
  end if;
end;
$$;

-- Lets the UI tell a suspended author why writing fails.
create function public.get_my_suspension_status() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.suspended_users where user_id = (select auth.uid()))
$$;

-- Schema-level default privileges cannot remove PostgreSQL's global EXECUTE for PUBLIC, so every
-- new function is closed explicitly before it is opened to the intended roles.
revoke execute on function public.report_content(uuid, uuid, text),
  public.admin_list_users(text, integer),
  public.admin_set_suspended(uuid, boolean, text),
  public.get_my_suspension_status() from public, anon, authenticated;
grant execute on function public.report_content(uuid, uuid, text) to anon, authenticated;
grant execute on function public.admin_list_users(text, integer) to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.get_my_suspension_status() to authenticated;
