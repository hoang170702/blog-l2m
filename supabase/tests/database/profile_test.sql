-- Editable profiles: name, bio and an uploaded avatar inside the owner's folder.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'other@test.local');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select lives_ok($$update public.profiles set display_name = 'Lan', bio = 'Viết về Đà Lạt',
  avatar_path = '22222222-2222-4222-8222-222222222222/0b8c1a8e-1b8f-4c1a-9d1e-7a2b3c4d5e6f.webp'
  where id = '22222222-2222-4222-8222-222222222222'$$, 'a member updates name, bio and avatar');
select throws_ok($$update public.profiles set bio = repeat('x', 501)
  where id = '22222222-2222-4222-8222-222222222222'$$, '23514', null, 'the bio is at most 500 characters');
select throws_ok($$update public.profiles
  set avatar_path = '33333333-3333-4333-8333-333333333333/0b8c1a8e-1b8f-4c1a-9d1e-7a2b3c4d5e6f.webp'
  where id = '22222222-2222-4222-8222-222222222222'$$, '23514', null,
  'the avatar must be in the member''s own folder');
select throws_ok($$update public.profiles set avatar_path = 'https://evil.example/x.png'
  where id = '22222222-2222-4222-8222-222222222222'$$, '23514', null, 'the avatar is a storage path, not a URL');
update public.profiles set bio = 'hijacked' where id = '33333333-3333-4333-8333-333333333333';
select throws_ok($$update public.profiles set provider = 'x'
  where id = '22222222-2222-4222-8222-222222222222'$$, '42501', null, 'other profile columns stay read-only');

select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select bio from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'Viết về Đà Lạt',
  'visitors read the bio');
reset role;
select is((select bio from public.profiles where id = '33333333-3333-4333-8333-333333333333'), null,
  'nobody edits someone else''s profile');

select * from finish();
rollback;
