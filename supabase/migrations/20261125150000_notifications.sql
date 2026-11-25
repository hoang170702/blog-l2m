-- In-app notifications (D44): a new comment on my post, a like on my post, and a post published
-- by an author I follow. Rows are written by security-definer triggers; the owner reads them and
-- marks them read. No reply notifications: comments are guest comments without an account.

create type public.notification_kind as enum ('comment', 'like', 'new_post');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.notification_kind not null,
  post_id uuid references public.posts (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null check (char_length(actor_name) between 1 and 60),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_unread on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

create policy "own notifications readable" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own notifications markable" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.notify_comment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_author uuid;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  if v_author is not null then
    insert into public.notifications (user_id, kind, post_id, actor_name)
    values (v_author, 'comment', new.post_id, left(new.author_name, 60));
  end if;
  return null;
end;
$$;
create trigger comments_notify after insert on public.comments
  for each row execute function private.notify_comment();

create function private.notify_like() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_author uuid;
  v_name text;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  if v_author is not null and v_author <> new.user_id then
    select display_name into v_name from public.profiles where id = new.user_id;
    insert into public.notifications (user_id, kind, post_id, actor_id, actor_name)
    values (v_author, 'like', new.post_id, new.user_id, coalesce(left(v_name, 60), 'Ai đó'));
  end if;
  return null;
end;
$$;
create trigger post_likes_notify after insert on public.post_likes
  for each row execute function private.notify_like();

-- Fires when the post becomes published (also for a scheduled post: at the time the author
-- publishes it, not when its date arrives). Followers of the author are notified.
create function private.notify_followers() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if new.status = 'published' and new.author_id is not null
     and (tg_op = 'INSERT' or old.status <> 'published') then
    select display_name into v_name from public.profiles where id = new.author_id;
    insert into public.notifications (user_id, kind, post_id, actor_id, actor_name)
    select f.follower_id, 'new_post', new.id, new.author_id, coalesce(left(v_name, 60), 'Tác giả')
    from public.follows f where f.author_id = new.author_id;
  end if;
  return null;
end;
$$;
create trigger posts_notify_followers after insert or update of status on public.posts
  for each row execute function private.notify_followers();

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

create function public.mark_notifications_read() returns void
language sql volatile security definer set search_path = ''
as $$
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null
$$;
revoke execute on function public.mark_notifications_read() from public, anon, authenticated;
grant execute on function public.mark_notifications_read() to authenticated;
