-- Follows (D43): a signed-in reader follows authors; /following lists their posts.
-- Who follows whom is private to the follower; only the follower count is public.

create table public.follows (
  follower_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id),
  check (follower_id <> author_id)
);
create index follows_author on public.follows (author_id);

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;

create policy "own follows readable" on public.follows for select to authenticated
  using (follower_id = (select auth.uid()));
create policy "users follow authors" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and private.is_active());
create policy "users unfollow" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

create function public.follower_count(p_author uuid) returns bigint
language sql stable security definer set search_path = ''
as $$
  select count(*) from public.follows where author_id = p_author
$$;
revoke execute on function public.follower_count(uuid) from public, anon, authenticated;
grant execute on function public.follower_count(uuid) to anon, authenticated;
