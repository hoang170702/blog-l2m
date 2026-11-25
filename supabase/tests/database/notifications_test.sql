-- In-app notifications (D44).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

delete from public.comments; delete from public.post_tags; delete from public.posts;

insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'reader@test.local'),
  ('44444444-4444-4444-8444-444444444444', 'other@test.local');
insert into public.posts (id, title, slug, content, status, published_at, author_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'Live post', 'live-post', 'x', 'published', now() - interval '1 day',
   '22222222-2222-4222-8222-222222222222');
insert into public.follows (follower_id, author_id) values
  ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222');

create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true),
         set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', true);
$$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- A guest comment notifies the post author
select pg_temp.as_anon();
select public.submit_comment('live-post', 'Lan', 'Hay quá');
reset role;
select results_eq($$select user_id::text, kind::text, actor_name from public.notifications$$,
  $$values ('22222222-2222-4222-8222-222222222222', 'comment', 'Lan')$$, 'a comment notifies the post author');

-- Likes: another member yes, the author themselves no
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
insert into public.post_likes (post_id) values ('aaaaaaaa-1111-4111-8111-111111111111');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
insert into public.post_likes (post_id) values ('aaaaaaaa-1111-4111-8111-111111111111');
reset role;
select is((select count(*) from public.notifications where kind = 'like'), 1::bigint, 'one like notification');
select is((select actor_name from public.notifications where kind = 'like'), 'reader', 'the liker is named');

-- Publishing notifies followers (draft -> published), not an edit of a published post
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
insert into public.posts (id, title, content, status) values
  ('aaaaaaaa-2222-4222-8222-222222222222', 'Draft', 'x', 'draft');
update public.posts set status = 'published' where id = 'aaaaaaaa-2222-4222-8222-222222222222';
update public.posts set title = 'Draft edited' where id = 'aaaaaaaa-2222-4222-8222-222222222222';
reset role;
select results_eq($$select user_id::text, post_id::text from public.notifications where kind = 'new_post'$$,
  $$values ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-2222-4222-8222-222222222222')$$,
  'the follower is notified once when the post is published');

-- Privacy
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is((select count(*) from public.notifications), 0::bigint, 'strangers see no notifications');
select throws_ok($$insert into public.notifications (user_id, kind, actor_name)
  values ('44444444-4444-4444-8444-444444444444', 'like', 'x')$$, '42501', null, 'members cannot insert notifications');
select pg_temp.as_anon();
select throws_ok($$select * from public.notifications$$, '42501', null, 'anon cannot read notifications');
select throws_ok($$select public.mark_notifications_read()$$, '42501', null, 'anon cannot call mark_notifications_read');

-- Reading
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*) from public.notifications where read_at is null), 2::bigint, 'the author has two unread');
select public.mark_notifications_read();
select is((select count(*) from public.notifications where read_at is null), 0::bigint, 'mark read clears them');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is((select count(*) from public.notifications where read_at is null), 1::bigint,
  'other users'' notifications are untouched');

select * from finish();
rollback;
