-- Bookmarks (D42): private to the reader, only live posts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

delete from public.comments; delete from public.post_tags; delete from public.posts;

insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'reader@test.local'),
  ('44444444-4444-4444-8444-444444444444', 'other@test.local');

insert into public.posts (id, title, content, status, published_at, author_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'Live post', 'x', 'published', now() - interval '1 day',
   '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-2222-4222-8222-222222222222', 'Later post', 'x', 'published', now() + interval '1 day',
   '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-3333-4333-8333-333333333333', 'Draft post', 'x', 'draft', null,
   '22222222-2222-4222-8222-222222222222');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$insert into public.bookmarks (post_id, user_id)
  values ('aaaaaaaa-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333')$$, '42501', null,
  'anon cannot bookmark');
select throws_ok($$select * from public.bookmarks$$, '42501', null, 'anon cannot read bookmarks');
reset role;

select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select lives_ok($$insert into public.bookmarks (post_id) values ('aaaaaaaa-1111-4111-8111-111111111111')$$,
  'reader bookmarks a live post');
select is((select user_id::text from public.bookmarks), '33333333-3333-4333-8333-333333333333',
  'the bookmark belongs to the caller');
select throws_ok($$insert into public.bookmarks (post_id) values ('aaaaaaaa-2222-4222-8222-222222222222')$$,
  '42501', null, 'cannot bookmark a post scheduled for later');
select throws_ok($$insert into public.bookmarks (post_id) values ('aaaaaaaa-3333-4333-8333-333333333333')$$,
  '42501', null, 'cannot bookmark a draft');

select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is((select count(*) from public.bookmarks), 0::bigint, 'another user sees no bookmarks of the reader');
select throws_ok($$update public.bookmarks set created_at = now()$$, '42501', null,
  'bookmarks cannot be updated through the API');
delete from public.bookmarks where post_id = 'aaaaaaaa-1111-4111-8111-111111111111';
reset role;
select is((select count(*) from public.bookmarks), 1::bigint, 'another user could not delete it');

delete from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111';
select is((select count(*) from public.bookmarks), 0::bigint, 'deleting the post removes the bookmark');

select * from finish();
rollback;
