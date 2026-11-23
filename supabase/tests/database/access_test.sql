-- Row-level security: what signed-out visitors, signed-in non-admins and admins can do.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Start from an empty content set (seed data is removed inside this rolled-back transaction).
delete from public.comments; delete from public.post_tags; delete from public.posts;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'admin@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'reader@test.local');
insert into private.site_admins (user_id) values ('11111111-1111-4111-8111-111111111111');

insert into public.posts (id, title, content, status) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'Published post', 'Hello', 'published'),
  ('aaaaaaaa-2222-4222-8222-222222222222', 'Draft post', 'Secret draft', 'draft');
insert into public.comments (id, post_id, author_name, content, status) values
  ('cccccccc-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111', 'Ann', 'Nice', 'approved'),
  ('cccccccc-2222-4222-8222-222222222222', 'aaaaaaaa-1111-4111-8111-111111111111', 'Bob', 'Spam?', 'pending');

create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Signed-out visitor
select pg_temp.as_anon();
select is((select count(*) from public.posts), 1::bigint, 'anon sees only published posts');
select is((select count(*) from public.posts where slug = 'draft-post'), 0::bigint, 'anon cannot read a draft by slug');
select throws_ok($$insert into public.posts (title, content) values ('Hack', 'x')$$, '42501', null,
  'anon cannot create posts');
select is((select count(*) from public.comments), 1::bigint, 'anon sees only approved comments');
select throws_ok($$insert into public.comments (post_id, author_name, content)
  values ('aaaaaaaa-1111-4111-8111-111111111111', 'X', 'direct')$$, '42501', null,
  'anon cannot insert comments directly');
select throws_ok($$select * from private.site_admins$$, '42501', null, 'anon cannot read the admin registry');

-- Signed-in, not an admin
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*) from public.posts), 1::bigint, 'non-admin sees only published posts');
select throws_ok($$insert into public.posts (title, content) values ('Hack', 'x')$$, '42501', null,
  'non-admin cannot create posts');
update public.comments set status = 'approved' where id = 'cccccccc-2222-4222-8222-222222222222';
select is(public.get_my_admin_status(), false, 'non-admin is not reported as admin');

-- Admin
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select count(*) from public.posts), 2::bigint, 'admin sees drafts too');
select lives_ok($$insert into public.posts (title, content) values ('Admin post', 'x')$$, 'admin creates posts');
select lives_ok($$update public.comments set status = 'approved'
  where id = 'cccccccc-2222-4222-8222-222222222222'$$, 'admin moderates comments');
select is(public.get_my_admin_status(), true, 'admin is reported as admin');

reset role;
select is((select count(*) from public.comments where status = 'approved'), 2::bigint,
  'only the admin update changed the pending comment');

select * from finish();
rollback;
