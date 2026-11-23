-- L2M Blog: posts, categories, tags and moderated comments.
-- Access rules live here (RLS, grants, security-definer RPCs); the browser talks to the
-- Data API directly, so nothing below may rely on client-side checks.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin registry and account allowlist (never exposed through the Data API)
-- ---------------------------------------------------------------------------

create table private.site_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

create table private.account_allowlist (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  added_at timestamptz not null default now()
);

create table private.comment_attempts (
  client text not null,
  created_at timestamptz not null default now()
);
create index comment_attempts_client_time on private.comment_attempts (client, created_at);

-- Checked on every request, so revoking a row takes effect immediately.
create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.site_admins where user_id = (select auth.uid()))
$$;

-- Policies for signed-in users call private.is_admin(); anon policies never do.
grant usage on schema private to authenticated;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Vietnamese-aware slug: strip diacritics, lowercase, keep [a-z0-9] joined by '-'.
create function private.slugify(value text) returns text
language sql immutable set search_path = ''
as $$
  select btrim(
    regexp_replace(
      translate(
        normalize(lower(coalesce(value, '')), NFC),
        'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
        'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  )
$$;

create function private.unique_slug(target regclass, base text, exclude_id uuid) returns text
language plpgsql stable set search_path = ''
as $$
declare
  root text := coalesce(nullif(private.slugify(base), ''), 'item');
  candidate text := root;
  n integer := 1;
  taken boolean;
begin
  loop
    execute format('select exists (select 1 from %s where slug = $1 and id is distinct from $2)', target)
      into taken using candidate, exclude_id;
    exit when not taken;
    n := n + 1;
    candidate := root || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- Security definer: runs the uniqueness lookup with the owner's rights, not the caller's.
create function private.set_slug() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    -- posts are slugged from title, categories/tags from name.
    new.slug := private.unique_slug(
      tg_relid::regclass,
      coalesce(to_jsonb(new) ->> 'title', to_jsonb(new) ->> 'name'),
      new.id
    );
  end if;
  return new;
end;
$$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create type public.post_status as enum ('draft', 'published');
create type public.comment_status as enum ('pending', 'approved', 'rejected');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text check (char_length(excerpt) <= 500),
  content text not null check (char_length(content) <= 200000),
  -- Object name inside the post-images bucket, never an arbitrary URL.
  cover_image_path text check (cover_image_path ~ '^[0-9a-f-]{36}\.(webp|jpg|png|gif)$'),
  status public.post_status not null default 'draft',
  published_at timestamptz,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_status_published on public.posts (status, published_at desc);
create index posts_category on public.posts (category_id);

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (post_id, tag_id)
);
create index post_tags_tag on public.post_tags (tag_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  content text not null check (char_length(content) between 1 and 2000),
  status public.comment_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index comments_post_status on public.comments (post_id, status, created_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger categories_slug before insert or update on public.categories
  for each row execute function private.set_slug();
create trigger tags_slug before insert or update on public.tags
  for each row execute function private.set_slug();
create trigger posts_slug before insert or update on public.posts
  for each row execute function private.set_slug();
create trigger posts_touch before update on public.posts
  for each row execute function private.touch_updated_at();

-- published_at is set on the first publish and kept afterwards.
create function private.set_published_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger posts_published_at before insert or update on public.posts
  for each row execute function private.set_published_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.posts enable row level security;
alter table public.post_tags enable row level security;
alter table public.comments enable row level security;

-- Signed-out visitors only ever read.
revoke insert, update, delete, truncate on public.categories, public.tags, public.posts,
  public.post_tags, public.comments from anon;
-- Comments are only created through submit_comment().
revoke insert on public.comments from authenticated;

create policy "terms readable" on public.categories for select to anon, authenticated using (true);
create policy "admin manages categories" on public.categories for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "terms readable" on public.tags for select to anon, authenticated using (true);
create policy "admin manages tags" on public.tags for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "published posts readable" on public.posts for select to anon
  using (status = 'published');
create policy "posts readable by signed-in" on public.posts for select to authenticated
  using (status = 'published' or private.is_admin());
create policy "admin writes posts" on public.posts for insert to authenticated
  with check (private.is_admin());
create policy "admin updates posts" on public.posts for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "admin deletes posts" on public.posts for delete to authenticated
  using (private.is_admin());

create policy "tags of published posts readable" on public.post_tags for select to anon
  using (exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));
create policy "post tags readable by signed-in" on public.post_tags for select to authenticated
  using (private.is_admin() or exists (
    select 1 from public.posts p where p.id = post_id and p.status = 'published'));
create policy "admin manages post tags" on public.post_tags for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "approved comments readable" on public.comments for select to anon
  using (status = 'approved' and exists (
    select 1 from public.posts p where p.id = post_id and p.status = 'published'));
create policy "comments readable by signed-in" on public.comments for select to authenticated
  using (private.is_admin() or (status = 'approved' and exists (
    select 1 from public.posts p where p.id = post_id and p.status = 'published')));
create policy "admin moderates comments" on public.comments for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "admin deletes comments" on public.comments for delete to authenticated
  using (private.is_admin());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Guest comment: validated, held for moderation, max 3 per minute per client address.
create function public.submit_comment(p_post_slug text, p_author_name text, p_content text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_post uuid;
  v_name text := btrim(coalesce(p_author_name, ''));
  v_content text := btrim(coalesce(p_content, ''));
  v_client text := coalesce(
    nullif(btrim(split_part(
      coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown');
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'author name must be 1-60 characters' using errcode = '22023';
  end if;
  if char_length(v_content) not between 1 and 2000 then
    raise exception 'comment must be 1-2000 characters' using errcode = '22023';
  end if;

  select id into v_post from public.posts where slug = p_post_slug and status = 'published';
  if v_post is null then
    raise exception 'post not found' using errcode = 'P0002';
  end if;

  delete from private.comment_attempts where created_at < now() - interval '1 hour';
  if (select count(*) from private.comment_attempts
      where client = v_client and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'too many comments, try again in a minute' using errcode = 'P0429';
  end if;
  insert into private.comment_attempts (client) values (v_client);

  insert into public.comments (post_id, author_name, content)
  values (v_post, v_name, v_content)
  returning id into v_id;
  return v_id;
end;
$$;

-- Lets the admin UI ask "am I an admin?" without exposing the registry.
create function public.get_my_admin_status() returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_admin()
$$;

-- Auth hook: only allowlisted emails may get an account (sign-up is also disabled).
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email <> '' and exists (select 1 from private.account_allowlist where email = v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'Tài khoản mới không được phép tạo.'));
end;
$$;

-- Default: no application function is callable through the API, then opt in.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant execute on function public.submit_comment(text, text, text) to anon, authenticated;
grant execute on function public.get_my_admin_status() to authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_admin() to authenticated;
