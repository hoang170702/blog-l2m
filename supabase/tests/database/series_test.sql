-- Series (D47): owned by an author; posts only join their own author's series.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

delete from public.comments; delete from public.post_tags; delete from public.posts;

insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('44444444-4444-4444-8444-444444444444', 'other@test.local');
insert into public.posts (id, title, slug, content, status, published_at, author_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'Part one', 'part-one', 'x', 'published', now() - interval '1 day',
   '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-4444-4444-8444-444444444444', 'Other post', 'other-post', 'x', 'published', now() - interval '1 day',
   '44444444-4444-4444-8444-444444444444');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select lives_ok($$insert into public.series (id, title, description)
  values ('55555555-1111-4111-8111-111111111111', 'Học Postgres', 'Từ đầu')$$, 'writer creates a series');
select is((select slug from public.series where id = '55555555-1111-4111-8111-111111111111'), 'hoc-postgres',
  'the slug is generated from the title');
select is((select author_id::text from public.series where id = '55555555-1111-4111-8111-111111111111'),
  '22222222-2222-4222-8222-222222222222', 'the series belongs to the caller');
select lives_ok($$update public.posts set series_id = '55555555-1111-4111-8111-111111111111', series_order = 1
  where id = 'aaaaaaaa-1111-4111-8111-111111111111'$$, 'writer puts a post into the series');
select throws_ok($$insert into public.series (title, author_id) values ('Fake', '44444444-4444-4444-8444-444444444444')$$,
  '42501', null, 'cannot create a series for someone else');

select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select throws_ok($$update public.posts set series_id = '55555555-1111-4111-8111-111111111111', series_order = 2
  where id = 'aaaaaaaa-4444-4444-8444-444444444444'$$, '42501', null, 'a post cannot join another author''s series');
update public.series set title = 'Hijacked' where id = '55555555-1111-4111-8111-111111111111';
delete from public.series where id = '55555555-1111-4111-8111-111111111111';
select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select title from public.series where id = '55555555-1111-4111-8111-111111111111'), 'Học Postgres',
  'another user could neither rename nor delete the series; anon reads it');
reset role;

select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
update public.posts set series_id = null where id = 'aaaaaaaa-1111-4111-8111-111111111111';
reset role;
select is((select series_order from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'), null,
  'leaving a series clears the order');
update public.posts set series_id = '55555555-1111-4111-8111-111111111111', series_order = 1
  where id = 'aaaaaaaa-1111-4111-8111-111111111111';
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select lives_ok($$delete from public.series where id = '55555555-1111-4111-8111-111111111111'$$, 'owner deletes the series');
reset role;
select is((select series_id from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'), null,
  'deleting a series detaches its posts');

select * from finish();
rollback;
