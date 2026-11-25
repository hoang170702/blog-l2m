-- Admin hide (D49): hidden posts exist only for their author and admins.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

delete from public.comments; delete from public.post_tags; delete from public.posts;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'admin@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'reader@test.local');
insert into private.site_admins (user_id) values ('11111111-1111-4111-8111-111111111111');

insert into public.posts (id, title, slug, content, status, published_at, author_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'Hidden post', 'hidden-post', 'x', 'published', now() - interval '1 day',
   '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-2222-4222-8222-222222222222', 'Live post', 'live-post', 'x', 'published', now() - interval '1 day',
   '22222222-2222-4222-8222-222222222222');
insert into public.tags (id, name) values ('dddddddd-1111-4111-8111-111111111111', 'T');
insert into public.post_tags (post_id, tag_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'dddddddd-1111-4111-8111-111111111111');
insert into public.comments (id, post_id, author_name, content) values
  ('cccccccc-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111', 'Ann', 'On hidden');

create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true),
         set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', true);
$$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Author cannot hide or unhide; admin hides
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok($$select public.admin_set_hidden('aaaaaaaa-1111-4111-8111-111111111111', true)$$, '42501', null,
  'author cannot call admin_set_hidden');
update public.posts set hidden_at = now() where id = 'aaaaaaaa-1111-4111-8111-111111111111';
reset role;
select is((select hidden_at from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'), null,
  'a plain update by the author does not set hidden_at');

select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok($$select public.admin_set_hidden('aaaaaaaa-1111-4111-8111-111111111111', true)$$, 'admin hides the post');
select throws_ok($$select public.admin_set_hidden('aaaaaaaa-9999-4999-8999-999999999999', true)$$, 'P0002', null,
  'hiding an unknown post fails');
reset role;
select is((select hidden_by::text from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'),
  '11111111-1111-4111-8111-111111111111', 'hidden_by records the admin');

-- Anonymous visitors
select pg_temp.as_anon();
select is((select count(*) from public.posts), 1::bigint, 'anon sees only the live post');
select is((select count(*) from public.post_tags), 0::bigint, 'anon sees no tags of the hidden post');
select is((select count(*) from public.comments), 0::bigint, 'anon sees no comments of the hidden post');
select throws_ok($$select public.submit_comment('hidden-post', 'Z', 'hi')$$, 'P0002', null,
  'anon cannot comment on a hidden post');
select throws_ok($$select public.report_content('aaaaaaaa-1111-4111-8111-111111111111', null, 'spam')$$, 'P0002', null,
  'anon cannot report a hidden post');
select lives_ok($$select public.record_post_view('hidden-post')$$, 'recording a view on a hidden post is a no-op');
reset role;
select is((select count(*) from public.post_stats where post_id = 'aaaaaaaa-1111-4111-8111-111111111111'), 0::bigint,
  'no view was counted for the hidden post');

-- Another member
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is((select count(*) from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'), 0::bigint,
  'another member cannot read the hidden post');
select throws_ok($$insert into public.post_likes (post_id) values ('aaaaaaaa-1111-4111-8111-111111111111')$$,
  '42501', null, 'another member cannot like the hidden post');
select throws_ok($$insert into public.bookmarks (post_id) values ('aaaaaaaa-1111-4111-8111-111111111111')$$,
  '42501', null, 'another member cannot bookmark the hidden post');

-- The author
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*) from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'), 1::bigint,
  'the author still reads the hidden post');
update public.posts set hidden_at = null, title = 'Edited while hidden' where id = 'aaaaaaaa-1111-4111-8111-111111111111';
reset role;
select is((select title from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'), 'Edited while hidden',
  'the author can still edit the hidden post');
select isnt((select hidden_at from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'), null,
  'the author cannot clear hidden_at');

-- Admin un-hides
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select public.admin_set_hidden('aaaaaaaa-1111-4111-8111-111111111111', false);
select pg_temp.as_anon();
select is((select count(*) from public.posts), 2::bigint, 'after un-hiding anon sees both posts');
reset role;

select * from finish();
rollback;
