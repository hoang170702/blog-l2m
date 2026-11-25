-- Follows (D43): private to the follower; the count is public.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'reader@test.local'),
  ('44444444-4444-4444-8444-444444444444', 'other@test.local');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$insert into public.follows (follower_id, author_id)
  values ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222')$$, '42501', null,
  'anon cannot follow');
select is(public.follower_count('22222222-2222-4222-8222-222222222222'), 0::bigint, 'anon reads a zero follower count');
reset role;

select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select lives_ok($$insert into public.follows (author_id) values ('22222222-2222-4222-8222-222222222222')$$,
  'reader follows the writer');
select throws_ok($$insert into public.follows (author_id) values ('33333333-3333-4333-8333-333333333333')$$,
  '23514', null, 'nobody follows themselves');
select throws_ok($$insert into public.follows (follower_id, author_id)
  values ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222')$$, '42501', null,
  'cannot follow on behalf of someone else');
select is(public.follower_count('22222222-2222-4222-8222-222222222222'), 1::bigint, 'the follower count is public');

select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is((select count(*) from public.follows), 0::bigint, 'another user sees no follows of the reader');
delete from public.follows where author_id = '22222222-2222-4222-8222-222222222222';
reset role;
select is((select count(*) from public.follows), 1::bigint, 'another user could not remove it');

select * from finish();
rollback;
