-- Profanity filter and commenter identification (D50).
-- * Banned words (admin-managed, stored accent-folded) are replaced by '*' when a comment is
--   inserted; comments.masked drives a warning line under the comment.
-- * The commenter's address and user agent go to private.comment_clients. Publicly, a masked
--   comment shows only a partial IP (comments.client_hint, e.g. 113.161.*.*). Admins and the
--   post's author read the full values through comment_client().
-- * Admins block an address (private.blocked_clients); submit_comment refuses it with P0403.

-- ---------------------------------------------------------------------------
-- Banned words
-- ---------------------------------------------------------------------------

create table public.banned_words (
  word text primary key check (word = private.fold_vi(word) and char_length(word) between 2 and 40),
  created_at timestamptz not null default now()
);
alter table public.banned_words enable row level security;
revoke all on public.banned_words from anon, authenticated;
grant select, insert, delete on public.banned_words to authenticated;
grant all on public.banned_words to service_role;
create policy "admins manage banned words" on public.banned_words for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Starter list (folded, lower case). Admins extend it at /dashboard/moderation.
insert into public.banned_words (word) values
  ('dm'), ('dmm'), ('dcm'), ('dkm'), ('vcl'), ('vkl'), ('clgt'), ('cmm'), ('ccmm'),
  ('du me'), ('du ma'), ('dit me'), ('dit con me'), ('dit cu'), ('dit'), ('cho de'), ('cho chet'),
  ('oc cho'), ('oc lon'), ('cai lon'), ('con lon'), ('lon'), ('cac'), ('con cac'), ('buoi'), ('con buoi'),
  ('ngu nhu cho'), ('do ngu'), ('do khung'), ('me may'), ('bo may'), ('con di'), ('di me'), ('thang cho'),
  ('fuck'), ('fucking'), ('fucker'), ('motherfucker'), ('shit'), ('bullshit'), ('bitch'), ('asshole'),
  ('bastard'), ('dick'), ('cunt'), ('pussy'), ('slut'), ('whore'), ('retard'), ('nigger')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Masking. fold_vi maps one character to one character, so positions found in the folded text
-- line up with the original text and overlay() can star the original letters.
-- ---------------------------------------------------------------------------

create function private.mask_profanity(p_text text, out o_text text, out o_masked boolean)
language plpgsql stable set search_path = ''
as $$
declare
  v_folded text;
  v_word text;
  v_pos integer;
  v_len integer;
begin
  -- NFC first: fold_vi normalizes too, and only then do both strings have the same length.
  o_text := normalize(coalesce(p_text, ''), nfc);
  v_folded := private.fold_vi(o_text);
  o_masked := false;
  for v_word in select word from public.banned_words order by char_length(word) desc loop
    v_len := char_length(v_word);
    v_pos := regexp_instr(v_folded, '\m' || regexp_replace(v_word, '([.^$|()\[\]{}*+?\\])', '\\\1', 'g') || '\M', 1, 1, 0, 'i');
    while v_pos > 0 loop
      o_text := overlay(o_text placing repeat('*', v_len) from v_pos for v_len);
      v_folded := overlay(v_folded placing repeat('*', v_len) from v_pos for v_len);
      o_masked := true;
      v_pos := regexp_instr(v_folded, '\m' || regexp_replace(v_word, '([.^$|()\[\]{}*+?\\])', '\\\1', 'g') || '\M', v_pos + v_len, 1, 0, 'i');
    end loop;
  end loop;
end;
$$;
revoke execute on function private.mask_profanity(text) from public, anon, authenticated;

-- 113.161.42.7 -> 113.161.*.*; 2401:d800:abcd::1 -> 2401:d800:*; anything else -> null.
create function private.mask_client(p_client text) returns text
language sql immutable strict set search_path = ''
as $$
  select case
    when p_client ~ '^\d{1,3}(\.\d{1,3}){3}$' then split_part(p_client, '.', 1) || '.' || split_part(p_client, '.', 2) || '.*.*'
    when p_client ~ '^[0-9a-fA-F:]+$' and p_client like '%:%' then split_part(p_client, ':', 1) || ':' || split_part(p_client, ':', 2) || ':*'
    else null
  end
$$;
revoke execute on function private.mask_client(text) from public, anon, authenticated;

alter table public.comments
  add column masked boolean not null default false,
  add column client_hint text;

create function private.mask_comment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_result record;
begin
  select * into v_result from private.mask_profanity(new.content);
  new.content := v_result.o_text;
  new.masked := v_result.o_masked;
  return new;
end;
$$;
create trigger comments_mask before insert on public.comments
  for each row execute function private.mask_comment();

-- ---------------------------------------------------------------------------
-- Who commented: full address and user agent stay private; blocked addresses cannot comment
-- ---------------------------------------------------------------------------

create table private.comment_clients (
  comment_id uuid primary key references public.comments (id) on delete cascade,
  client text not null,
  user_agent text
);
create index comment_clients_client on private.comment_clients (client);

create table private.blocked_clients (
  client text primary key,
  reason text check (char_length(reason) <= 500),
  blocked_at timestamptz not null default now(),
  blocked_by uuid references auth.users (id) on delete set null
);

create function private.request_user_agent() returns text
language sql stable set search_path = ''
as $$
  select left(nullif(btrim(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'user-agent'), ''), 400)
$$;
revoke execute on function private.request_user_agent() from public, anon, authenticated;

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
  v_masked boolean;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'author name must be 1-60 characters' using errcode = '22023';
  end if;
  if char_length(v_content) not between 1 and 2000 then
    raise exception 'comment must be 1-2000 characters' using errcode = '22023';
  end if;
  if exists (select 1 from private.blocked_clients where client = v_client) then
    raise exception 'your address is blocked from commenting' using errcode = 'P0403';
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
  returning id, masked into v_id, v_masked;
  insert into private.comment_clients (comment_id, client, user_agent)
  values (v_id, v_client, private.request_user_agent());
  if v_masked then
    update public.comments set client_hint = private.mask_client(v_client) where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Full address and user agent of a comment, for admins and the author of its post.
create function public.comment_client(p_comment uuid)
returns table (client text, user_agent text, blocked boolean)
language sql stable security definer set search_path = ''
as $$
  select cc.client, cc.user_agent, exists (select 1 from private.blocked_clients b where b.client = cc.client)
  from private.comment_clients cc
  join public.comments c on c.id = cc.comment_id
  where cc.comment_id = p_comment
    and (private.is_admin() or private.owns_post(c.post_id))
$$;

create function public.admin_block_client(p_comment uuid, p_blocked boolean, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_client text;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  select client into v_client from private.comment_clients where comment_id = p_comment;
  if v_client is null or v_client = 'unknown' then
    raise exception 'no address recorded for this comment' using errcode = 'P0002';
  end if;
  if p_blocked then
    insert into private.blocked_clients (client, reason, blocked_by)
    values (v_client, nullif(btrim(p_reason), ''), (select auth.uid()))
    on conflict (client) do update
      set reason = excluded.reason, blocked_at = now(), blocked_by = excluded.blocked_by;
  else
    delete from private.blocked_clients where client = v_client;
  end if;
end;
$$;

create function public.admin_unblock_client(p_client text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  delete from private.blocked_clients where client = p_client;
end;
$$;

create function public.admin_list_blocked_clients()
returns table (client text, reason text, blocked_at timestamptz, comment_count bigint)
language sql stable security definer set search_path = ''
as $$
  select b.client, b.reason, b.blocked_at,
         (select count(*) from private.comment_clients cc where cc.client = b.client)
  from private.blocked_clients b
  where private.is_admin()
  order by b.blocked_at desc
$$;

revoke execute on function public.comment_client(uuid),
  public.admin_block_client(uuid, boolean, text),
  public.admin_unblock_client(text),
  public.admin_list_blocked_clients() from public, anon, authenticated;
grant execute on function public.comment_client(uuid) to authenticated;
grant execute on function public.admin_block_client(uuid, boolean, text) to authenticated;
grant execute on function public.admin_unblock_client(text) to authenticated;
grant execute on function public.admin_list_blocked_clients() to authenticated;
