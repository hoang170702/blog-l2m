-- Security-audit fixes (2026-11-25).
--
-- 1. Notification flooding: a member could fill another member's inbox by liking and unliking a
--    post in a loop, and an author could do the same to every follower by flipping a post between
--    draft and published. One like notification per (reader, post, liker) and one new-post
--    notification per (follower, post, author) is enough; later inserts are ignored. Guest
--    comments stay as they are: submit_comment() already limits them to 3 per minute per client.
-- 2. The follower notification skipped neither hidden posts (hidden_at set by an admin) nor
--    posts without a readable status; it now requires the post to be visible to the public.
-- 3. Post authors held a table-level UPDATE on comments, so they could rewrite `masked` and
--    `client_hint` (D50) or `content` on comments of their own posts. The dashboard only
--    changes `status`, and that is now the only column the API role may update.

-- ---------------------------------------------------------------------------
-- 1. One notification per actor and post for likes and new posts
-- ---------------------------------------------------------------------------

delete from public.notifications n
using public.notifications older
where n.kind in ('like', 'new_post')
  and older.kind = n.kind and older.user_id = n.user_id
  and older.post_id is not distinct from n.post_id
  and older.actor_id is not distinct from n.actor_id
  and (older.created_at, older.id) < (n.created_at, n.id);

create unique index notifications_once_per_actor
  on public.notifications (user_id, kind, post_id, actor_id)
  where kind in ('like', 'new_post');

create or replace function private.notify_like() returns trigger
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
    values (v_author, 'like', new.post_id, new.user_id, coalesce(left(v_name, 60), 'Ai đó'))
    on conflict do nothing;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Followers are told about a post once, and only when it is not hidden
-- ---------------------------------------------------------------------------

create or replace function private.notify_followers() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if new.status = 'published' and new.author_id is not null and new.hidden_at is null
     and (tg_op = 'INSERT' or old.status <> 'published') then
    select display_name into v_name from public.profiles where id = new.author_id;
    insert into public.notifications (user_id, kind, post_id, actor_id, actor_name)
    select f.follower_id, 'new_post', new.id, new.author_id, coalesce(left(v_name, 60), 'Tác giả')
    from public.follows f where f.author_id = new.author_id
    on conflict do nothing;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Authors and admins may only change a comment's status through the API
-- ---------------------------------------------------------------------------

revoke update on public.comments from authenticated;
grant update (status) on public.comments to authenticated;
