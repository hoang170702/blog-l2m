-- Member chat (PLAN-20261125-chat): shared room, private threads, blocks, limits.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'admin@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'reader@test.local'),
  ('44444444-4444-4444-8444-444444444444', 'other@test.local'),
  ('55555555-5555-4555-8555-555555555555', 'banned@test.local');
insert into private.site_admins (user_id) values ('11111111-1111-4111-8111-111111111111');
insert into private.suspended_users (user_id) values ('55555555-5555-4555-8555-555555555555');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Guests and suspended members have no chat
select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.messages$$, '42501', null, 'anon cannot read the room');
select throws_ok($$select public.open_dm('22222222-2222-4222-8222-222222222222')$$, '42501', null,
  'anon cannot open a thread');
select pg_temp.as_user('55555555-5555-4555-8555-555555555555');
select throws_ok($$insert into public.messages (content) values ('hello')$$, '42501', null,
  'a suspended member cannot post in the room');
select throws_ok($$select public.open_dm('22222222-2222-4222-8222-222222222222')$$, '42501', null,
  'a suspended member cannot open a thread');

-- The shared room
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select lives_ok($$insert into public.messages (content) values ('  Chào anh em  ')$$, 'a member posts in the room');
select throws_ok($$insert into public.messages (user_id, content)
  values ('33333333-3333-4333-8333-333333333333', 'x')$$, '42501', null, 'cannot post as someone else');
insert into public.messages (content) values ('đồ ngu quá');
reset role;
select results_eq($$select content, masked from public.messages order by created_at$$,
  $$values ('Chào anh em', false), ('****** quá', true)$$, 'room messages are trimmed and masked');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is((select count(*) from public.messages where thread_id is null), 2::bigint, 'every member reads the room');
delete from public.messages where content = 'Chào anh em';  -- RLS filters it out silently
reset role;
select is((select count(*) from public.messages where content = 'Chào anh em'), 1::bigint,
  'the room message survived another member''s delete');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
delete from public.messages where content = 'Chào anh em';
reset role;
select is((select count(*) from public.messages where content = 'Chào anh em'), 0::bigint, 'an admin deletes a room message');

-- Rate limit: the 21st message in a minute is refused
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
insert into public.messages (content) select 'spam ' || g from generate_series(1, 20) g;
select throws_ok($$insert into public.messages (content) values ('spam 21')$$, 'P0429', null,
  'the 21st message within a minute is refused');

-- Private threads: same row from either side, invisible to others and to admins
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select set_config('test.t1', public.open_dm('33333333-3333-4333-8333-333333333333')::text, true);
select throws_ok($$select public.open_dm('22222222-2222-4222-8222-222222222222')$$, '22023', null, 'no thread with oneself');
insert into public.messages (thread_id, content) values (current_setting('test.t1')::uuid, 'Rảnh không?');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is(public.open_dm('22222222-2222-4222-8222-222222222222')::text, current_setting('test.t1'),
  'opening from the other side returns the same thread');
select is((select count(*) from public.messages where thread_id = current_setting('test.t1')::uuid), 1::bigint,
  'the peer reads the thread');
select is((select unread from public.dm_inbox()), 1::bigint, 'the inbox counts one unread message');
select public.mark_thread_read(current_setting('test.t1')::uuid);
select is((select unread from public.dm_inbox()), 0::bigint, 'marking read clears the count');
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is((select count(*) from public.messages where thread_id is not null), 0::bigint, 'a third member sees no private messages');
select is((select count(*) from public.dm_threads), 0::bigint, 'a third member sees no threads');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select throws_ok($$insert into public.messages (thread_id, content) values (current_setting('test.t1')::uuid, 'x')$$,
  '42501', null, 'a third member (even an admin) cannot post into the thread');
select is((select count(*) from public.messages where thread_id is not null), 0::bigint, 'admins cannot read private threads');

-- Blocks: the blocked member can neither open nor send
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
insert into public.user_blocks (blocked) values ('22222222-2222-4222-8222-222222222222');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok($$insert into public.messages (thread_id, content) values (current_setting('test.t1')::uuid, 'alo')$$,
  '42501', null, 'a blocked member cannot send into the existing thread');
select throws_ok($$select public.open_dm('33333333-3333-4333-8333-333333333333')$$, 'P0403', null,
  'a blocked member cannot open a thread with the blocker');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is((select blocked from public.dm_inbox()), true, 'the inbox shows the block');

-- Retention: a room message older than 90 days disappears on the next insert
reset role;
insert into public.messages (user_id, content, created_at)
values ('22222222-2222-4222-8222-222222222222', 'old', now() - interval '91 days');
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
reset role;
insert into public.messages (user_id, content) values ('33333333-3333-4333-8333-333333333333', 'new');
select is((select count(*) from public.messages where content = 'old'), 0::bigint, 'room messages older than 90 days are purged');

-- The client embeds the author through this key (author:profiles!messages_user_id_fkey)
select fk_ok('public', 'messages', ARRAY['user_id'], 'public', 'profiles', ARRAY['id'],
  'message authors reference profiles so the API can embed them');

select * from finish();
rollback;
