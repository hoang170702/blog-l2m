-- Bookmarks (D42): a signed-in reader saves live posts to read later. Private to the reader.

create table public.bookmarks (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index bookmarks_user_time on public.bookmarks (user_id, created_at desc);

alter table public.bookmarks enable row level security;
-- Default privileges may have granted everything; set exactly what the API roles get.
revoke all on public.bookmarks from anon, authenticated;
grant select, insert, delete on public.bookmarks to authenticated;
grant all on public.bookmarks to service_role;

create policy "own bookmarks readable" on public.bookmarks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users bookmark live posts" on public.bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active() and exists (
    select 1 from public.posts p
    where p.id = post_id and p.status = 'published' and p.published_at <= now()));
create policy "users remove own bookmarks" on public.bookmarks for delete to authenticated
  using (user_id = (select auth.uid()));
