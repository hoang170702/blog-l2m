-- Editable profiles: a short bio and an uploaded avatar. The avatar lives in the post-images
-- bucket under the owner's folder (the same rules as covers); avatar_url keeps the picture from the
-- OAuth provider and is shown when no avatar is uploaded.

alter table public.profiles
  add column bio text check (char_length(bio) <= 500),
  add column avatar_path text check (
    avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png|gif)$'
    and split_part(avatar_path, '/', 1) = id::text);

grant update (bio, avatar_path) on public.profiles to authenticated;

-- New profiles (sign-up trigger) build a whole profiles row, so it gains the two new columns.
create or replace function private.profile_from_user(u auth.users) returns public.profiles
language sql stable set search_path = ''
as $$
  select row(
    u.id,
    left(coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'user_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Thành viên'
    ), 80),
    case when coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') ~ '^https://'
         then coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') end,
    u.raw_app_meta_data ->> 'provider',
    coalesce(u.created_at, now()),
    null,  -- bio
    null   -- avatar_path
  )::public.profiles
$$;

-- The member list shows uploaded avatars too; the return type changes, so recreate it.
drop function public.admin_list_users(text, integer);
create function public.admin_list_users(p_query text default null, p_page integer default 1)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  avatar_path text,
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
    select p.id, p.display_name, p.avatar_url, p.avatar_path, u.email::text, p.created_at,
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

revoke execute on function public.admin_list_users(text, integer) from public, anon, authenticated;
grant execute on function public.admin_list_users(text, integer) to authenticated;
