-- Member chat (PLAN-20261125-chat): one shared room for every signed-in, non-suspended member
-- plus private 1-1 threads. Private threads are readable only by their two participants: admins
-- cannot read them (D2); safety comes from per-user blocks and account suspension. Messages go
-- through the profanity mask and a 20-per-minute limit (D3). The shared room keeps 90 days (D5).
-- Live delivery uses Supabase Realtime `postgres_changes` on `messages`, filtered by these same
-- row-level policies (D4).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  read_a timestamptz,
  read_b timestamptz,
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index dm_threads_user_b on public.dm_threads (user_b);

create table public.user_blocks (
  blocker uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  -- null = the shared room
  thread_id uuid references public.dm_threads (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  masked boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_thread_time on public.messages (thread_id, created_at desc);
create index messages_room_time on public.messages (created_at desc) where thread_id is null;
create index messages_user_time on public.messages (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (private)
-- ---------------------------------------------------------------------------

create function private.in_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.dm_threads t
    where t.id = p_thread and (select auth.uid()) in (t.user_a, t.user_b))
$$;
revoke execute on function private.in_thread(uuid) from public, anon;
grant execute on function private.in_thread(uuid) to authenticated;

-- The other participant of a thread the caller belongs to; null otherwise.
create function private.thread_peer(p_thread uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select case when (select auth.uid()) = t.user_a then t.user_b
              when (select auth.uid()) = t.user_b then t.user_a end
  from public.dm_threads t where t.id = p_thread
$$;
revoke execute on function private.thread_peer(uuid) from public, anon;
grant execute on function private.thread_peer(uuid) to authenticated;

create function private.blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.user_blocks
    where (blocker = p_a and blocked = p_b) or (blocker = p_b and blocked = p_a))
$$;
revoke execute on function private.blocked_between(uuid, uuid) from public, anon;
grant execute on function private.blocked_between(uuid, uuid) to authenticated;

-- May the caller post into this thread (or the shared room when null)?
create function private.can_message(p_thread uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_active() and (
    p_thread is null
    or (private.in_thread(p_thread)
        and not private.blocked_between((select auth.uid()), private.thread_peer(p_thread)))
  )
$$;
revoke execute on function private.can_message(uuid) from public, anon;
grant execute on function private.can_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security and grants
-- ---------------------------------------------------------------------------

alter table public.dm_threads enable row level security;
alter table public.user_blocks enable row level security;
alter table public.messages enable row level security;

revoke all on public.dm_threads, public.user_blocks, public.messages from anon, authenticated;
grant select on public.dm_threads to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant all on public.dm_threads, public.user_blocks, public.messages to service_role;

create policy "participants see their threads" on public.dm_threads for select to authenticated
  using (private.is_active() and (select auth.uid()) in (user_a, user_b));

create policy "own blocks readable" on public.user_blocks for select to authenticated
  using (blocker = (select auth.uid()));
create policy "members block" on public.user_blocks for insert to authenticated
  with check (blocker = (select auth.uid()) and private.is_active());
create policy "members unblock" on public.user_blocks for delete to authenticated
  using (blocker = (select auth.uid()));

create policy "members read the room and their threads" on public.messages for select to authenticated
  using (private.is_active() and (thread_id is null or private.in_thread(thread_id)));
create policy "members send as themselves" on public.messages for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_message(thread_id));
create policy "own messages deletable, admins moderate the room" on public.messages for delete to authenticated
  using (user_id = (select auth.uid()) or (thread_id is null and private.is_admin()));

-- ---------------------------------------------------------------------------
-- Triggers: mask, rate limit, thread bump, retention
-- ---------------------------------------------------------------------------

create function private.prepare_message() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_result record;
begin
  if (select count(*) from public.messages
      where user_id = new.user_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many messages, try again in a minute' using errcode = 'P0429';
  end if;
  select * into v_result from private.mask_profanity(btrim(new.content));
  new.content := v_result.o_text;
  new.masked := v_result.o_masked;
  return new;
end;
$$;
create trigger messages_prepare before insert on public.messages
  for each row execute function private.prepare_message();

create function private.bump_thread() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.thread_id is not null then
    update public.dm_threads set last_message_at = new.created_at where id = new.thread_id;
  end if;
  return null;
end;
$$;
create trigger messages_bump_thread after insert on public.messages
  for each row execute function private.bump_thread();

create function private.expire_room_messages() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.messages where thread_id is null and created_at < now() - interval '90 days';
  return null;
end;
$$;
create trigger messages_expire_room after insert on public.messages
  for each statement execute function private.expire_room_messages();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Opens (or returns) the private thread between the caller and p_user.
create function public.open_dm(p_user uuid) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
begin
  if not private.is_active() then
    raise exception 'sign in to chat' using errcode = '42501';
  end if;
  if p_user is null or p_user = v_me then
    raise exception 'pick another member' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'member not found' using errcode = 'P0404';
  end if;
  if private.blocked_between(v_me, p_user) then
    raise exception 'you cannot message this member' using errcode = 'P0403';
  end if;
  insert into public.dm_threads (user_a, user_b)
  values (least(v_me, p_user), greatest(v_me, p_user))
  on conflict (user_a, user_b) do nothing;
  select id into v_id from public.dm_threads
  where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user);
  return v_id;
end;
$$;

create function public.mark_thread_read(p_thread uuid) returns void
language sql volatile security definer set search_path = ''
as $$
  update public.dm_threads
  set read_a = case when user_a = (select auth.uid()) then now() else read_a end,
      read_b = case when user_b = (select auth.uid()) then now() else read_b end
  where id = p_thread and (select auth.uid()) in (user_a, user_b)
$$;

-- The caller's private threads with the other member's profile and the unread count.
create function public.dm_inbox()
returns table (thread_id uuid, peer_id uuid, peer_name text, peer_avatar text,
               last_message_at timestamptz, unread bigint, blocked boolean)
language sql stable security definer set search_path = ''
as $$
  with me as (select auth.uid() as id),
  mine as (
    select t.id, case when t.user_a = me.id then t.user_b else t.user_a end as peer,
           case when t.user_a = me.id then t.read_a else t.read_b end as read_at,
           t.last_message_at
    from public.dm_threads t, me where me.id in (t.user_a, t.user_b)
  )
  select m.id, m.peer, coalesce(p.display_name, 'Thành viên'), p.avatar_url, m.last_message_at,
         (select count(*) from public.messages x
          where x.thread_id = m.id and x.user_id <> (select id from me)
            and x.created_at > coalesce(m.read_at, 'epoch'::timestamptz)),
         private.blocked_between((select id from me), m.peer)
  from mine m left join public.profiles p on p.id = m.peer
  where private.is_active()
  order by m.last_message_at desc nulls last
$$;

revoke execute on function public.open_dm(uuid), public.mark_thread_read(uuid), public.dm_inbox()
  from public, anon, authenticated;
grant execute on function public.open_dm(uuid), public.mark_thread_read(uuid), public.dm_inbox()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast row changes of messages (RLS decides who receives what)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
