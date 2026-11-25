-- Series (D47): an author groups posts into an ordered sequence. Everyone reads series; only the
-- owner creates, edits and deletes theirs, and a post can only join a series of its own author.

create table public.series (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 500),
  created_at timestamptz not null default now()
);
create index series_author on public.series (author_id);
create trigger series_slug before insert or update on public.series
  for each row execute function private.set_slug();

alter table public.series enable row level security;
revoke all on public.series from anon, authenticated;
grant select on public.series to anon;
grant select, insert, update, delete on public.series to authenticated;
grant all on public.series to service_role;

create policy "series readable" on public.series for select to anon, authenticated using (true);
create policy "authors create series" on public.series for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_active());
create policy "authors edit own series" on public.series for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()) and private.is_active());
create policy "authors delete own series" on public.series for delete to authenticated
  using (author_id = (select auth.uid()));

alter table public.posts
  add column series_id uuid references public.series (id) on delete set null,
  add column series_order integer check (series_order >= 1);
create index posts_series on public.posts (series_id, series_order);

-- Runs after posts_author (alphabetical order: "posts_author" < "posts_series_owner"), so
-- new.author_id is already the caller on insert.
create function private.check_series_owner() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.series_id is not null and not exists (
    select 1 from public.series s where s.id = new.series_id and s.author_id = new.author_id
  ) then
    raise exception 'a post can only join a series of its own author' using errcode = '42501';
  end if;
  if new.series_id is null then
    new.series_order := null;
  end if;
  return new;
end;
$$;
create trigger posts_series_owner before insert or update of series_id, series_order, author_id on public.posts
  for each row execute function private.check_series_owner();
