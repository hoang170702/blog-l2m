-- Post image bucket: every signed-in user writes only inside their own folder (revision R3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'admin@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local');
insert into private.site_admins (user_id) values ('11111111-1111-4111-8111-111111111111');

select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'post-images'$$,
  $$values (true, 2097152::bigint, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])$$,
  'post-images is public, 2 MiB, images only'
);

select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('post-images', '22222222-2222-4222-8222-222222222222/0b8c1a8e-1b8f-4c1a-9d1e-7a2b3c4d5e6f.webp')$$,
  '42501', null, 'signed-out visitors cannot upload');

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name)
  values ('post-images', '22222222-2222-4222-8222-222222222222/0b8c1a8e-1b8f-4c1a-9d1e-7a2b3c4d5e6f.webp')$$,
  'writer uploads into own folder');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('post-images', '11111111-1111-4111-8111-111111111111/0b8c1a8e-1b8f-4c1a-9d1e-7a2b3c4d5e6f.webp')$$,
  '42501', null, 'writer cannot upload into another user''s folder');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('post-images', '22222222-2222-4222-8222-222222222222/../evil.html')$$, '42501', null,
  'arbitrary object names are rejected');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('other-bucket', '22222222-2222-4222-8222-222222222222/0b8c1a8e-1b8f-4c1a-9d1e-7a2b3c4d5e6f.webp')$$,
  '42501', null, 'the policy does not cover other buckets');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((select count(*) from storage.objects where bucket_id = 'post-images'), 1::bigint,
  'admin lists every user''s images');

select * from finish();
rollback;
