-- Row-level security: what signed-out visitors, authors and admins can do (revision R3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Start from an empty content set (seed data is removed inside this rolled-back transaction).
delete from public.comments; delete from public.post_tags; delete from public.posts;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'admin@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'other@test.local');
insert into private.site_admins (user_id) values ('11111111-1111-4111-8111-111111111111');

insert into public.posts (id, title, content, status, author_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'Published post', 'Hello', 'published', '33333333-3333-4333-8333-333333333333'),
  ('aaaaaaaa-2222-4222-8222-222222222222', 'Draft post', 'Secret draft', 'draft', '33333333-3333-4333-8333-333333333333');
insert into public.comments (id, post_id, author_name, content, status) values
  ('cccccccc-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111', 'Ann', 'Nice', 'approved'),
  ('cccccccc-2222-4222-8222-222222222222', 'aaaaaaaa-1111-4111-8111-111111111111', 'Bob', 'Spam?', 'rejected');

create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Profiles are created on sign-up
select is((select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'writer', 'sign-up creates a profile named after the email');

-- Signed-out visitor
select pg_temp.as_anon();
select is((select count(*) from public.posts), 1::bigint, 'anon sees only published posts');
select is((select count(*) from public.posts where slug = 'draft-post'), 0::bigint, 'anon cannot read a draft by slug');
select throws_ok($$insert into public.posts (title, content) values ('Hack', 'x')$$, '42501', null,
  'anon cannot create posts');
select is((select count(*) from public.comments), 1::bigint, 'anon does not see hidden comments');
select throws_ok($$insert into public.comments (post_id, author_name, content)
  values ('aaaaaaaa-1111-4111-8111-111111111111', 'X', 'direct')$$, '42501', null,
  'anon cannot insert comments directly');
select throws_ok($$select * from private.site_admins$$, '42501', null, 'anon cannot read the admin registry');
select is((select count(*) from public.profiles), 3::bigint, 'anon can read author profiles');

-- Signed-in writer (not an admin, not the author of the seeded posts)
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*) from public.posts), 1::bigint, 'writer sees published posts but not others'' drafts');
select lives_ok($$insert into public.posts (id, title, content, status, author_id)
  values ('aaaaaaaa-3333-4333-8333-333333333333', 'My post', 'x', 'published', '33333333-3333-4333-8333-333333333333')$$,
  'writer publishes a post');
select is((select author_id::text from public.posts where id = 'aaaaaaaa-3333-4333-8333-333333333333'),
  '22222222-2222-4222-8222-222222222222', 'the author is forced to the caller');
select lives_ok($$insert into public.tags (id, name) values ('dddddddd-1111-4111-8111-111111111111', 'Mới')$$,
  'writer adds a tag');
select lives_ok($$insert into public.post_tags (post_id, tag_id)
  values ('aaaaaaaa-3333-4333-8333-333333333333', 'dddddddd-1111-4111-8111-111111111111')$$, 'writer tags own post');
select throws_ok($$insert into public.post_tags (post_id, tag_id)
  values ('aaaaaaaa-1111-4111-8111-111111111111', 'dddddddd-1111-4111-8111-111111111111')$$, '42501', null,
  'writer cannot tag someone else''s post');
update public.posts set title = 'Hijacked' where id = 'aaaaaaaa-1111-4111-8111-111111111111';
update public.comments set status = 'approved' where id = 'cccccccc-2222-4222-8222-222222222222';
select is(public.get_my_admin_status(), false, 'writer is not reported as admin');
select throws_ok($$insert into public.categories (name) values ('Nope')$$, '42501', null,
  'writer cannot create categories');

-- The author of the seeded posts
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is((select count(*) from public.posts), 3::bigint, 'author sees own draft and all published posts');
select lives_ok($$update public.comments set status = 'approved'
  where id = 'cccccccc-2222-4222-8222-222222222222'$$, 'author shows a hidden comment on own post again');
select is((select count(*) from public.comments where post_id = 'aaaaaaaa-3333-4333-8333-333333333333'), 0::bigint,
  'author sees no comments on posts of others');

-- Admin
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select count(*) from public.posts), 3::bigint, 'admin sees drafts too');
update public.posts set title = 'Edited by admin' where id = 'aaaaaaaa-3333-4333-8333-333333333333';
select throws_ok($$insert into public.post_tags (post_id, tag_id)
  values ('aaaaaaaa-1111-4111-8111-111111111111', 'dddddddd-1111-4111-8111-111111111111')$$, '42501', null,
  'admin cannot tag someone else''s post');
select lives_ok($$delete from public.posts where id = 'aaaaaaaa-2222-4222-8222-222222222222'$$,
  'admin deletes someone else''s post');
select is(public.get_my_admin_status(), true, 'admin is reported as admin');

reset role;
select is((select title from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'), 'Published post',
  'writer could not edit someone else''s post');
select is((select title from public.posts where id = 'aaaaaaaa-3333-4333-8333-333333333333'), 'My post',
  'admin could not edit someone else''s post');
select is((select count(*) from public.posts where id = 'aaaaaaaa-2222-4222-8222-222222222222'), 0::bigint,
  'the admin''s delete went through');
select is((select count(*) from public.post_tags where post_id = 'aaaaaaaa-3333-4333-8333-333333333333'), 1::bigint,
  'the author''s tag is untouched');

select * from finish();
rollback;
