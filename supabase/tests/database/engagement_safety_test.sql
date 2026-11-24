-- Scheduled publishing, views, likes, replies, reports, suspensions and rate limits.
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

delete from public.comments; delete from public.post_tags; delete from public.posts;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'admin@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'reader@test.local');
insert into private.site_admins (user_id) values ('11111111-1111-4111-8111-111111111111');

insert into public.posts (id, title, content, status, published_at, author_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'Live post', 'x', 'published', now() - interval '1 day',
   '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-2222-4222-8222-222222222222', 'Later post', 'x', 'published', now() + interval '1 day',
   '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-3333-4333-8333-333333333333', 'Draft post', 'x', 'draft', null,
   '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-4444-4444-8444-444444444444', 'Other live post', 'x', 'published', now() - interval '1 day',
   '22222222-2222-4222-8222-222222222222');
insert into public.tags (id, name) values ('dddddddd-1111-4111-8111-111111111111', 'Soon');
insert into public.post_tags (post_id, tag_id) values
  ('aaaaaaaa-2222-4222-8222-222222222222', 'dddddddd-1111-4111-8111-111111111111');
insert into public.comments (id, post_id, author_name, content) values
  ('cccccccc-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111', 'Ann', 'Top level'),
  ('cccccccc-2222-4222-8222-222222222222', 'aaaaaaaa-4444-4444-8444-444444444444', 'Bob', 'Elsewhere');

create function pg_temp.as_anon(ip text) returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true),
         set_config('request.headers', json_build_object('x-forwarded-for', ip)::text, true);
$$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true),
         set_config('request.headers', '{"x-forwarded-for":"192.0.2.50"}', true);
$$;

-- Client address used by the rate limits ignores what the client puts first in X-Forwarded-For
select set_config('request.headers', '{"x-forwarded-for":"1.2.3.4, 198.51.100.77"}', true);
select is(private.request_client(), '198.51.100.77', 'the proxy-appended (rightmost) address is used');
select set_config('request.headers', '{"x-forwarded-for":"5.6.7.8, 198.51.100.77"}', true);
select is(private.request_client(), '198.51.100.77', 'a spoofed leftmost address does not change the client');
select set_config('request.headers',
  '{"x-forwarded-for":"1.2.3.4, 104.16.0.1", "cf-connecting-ip":"198.51.100.88"}', true);
select is(private.request_client(), '198.51.100.88', 'Cloudflare''s connecting IP wins when present');

-- Scheduled publishing
select pg_temp.as_anon('198.51.100.1');
select is((select count(*) from public.posts where slug = 'later-post'), 0::bigint,
  'anon does not see a post scheduled for later');
select is((select count(*) from public.post_tags where tag_id = 'dddddddd-1111-4111-8111-111111111111'), 0::bigint,
  'anon does not see the tags of a scheduled post');
select throws_ok($$select public.submit_comment('later-post', 'A', 'x')$$, 'P0002', null,
  'comments on a scheduled post are rejected');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is((select count(*) from public.posts where slug = 'later-post'), 0::bigint,
  'another member does not see the scheduled post');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*) from public.posts where slug = 'later-post'), 1::bigint,
  'the author sees the scheduled post');
reset role;

-- Replies
select pg_temp.as_anon('198.51.100.2');
select isnt(public.submit_comment('live-post', 'Cam', 'Reply', 'cccccccc-1111-4111-8111-111111111111'), null,
  'a reply to a top-level comment is accepted');
select throws_ok($$select public.submit_comment('live-post', 'Cam', 'Deeper',
  (select id from public.comments where content = 'Reply'))$$, '22023', null, 'replies are one level deep');
select throws_ok($$select public.submit_comment('live-post', 'Cam', 'Cross',
  'cccccccc-2222-4222-8222-222222222222')$$, '22023', null, 'a reply must stay on the same post');
reset role;
select is((select parent_id from public.comments where content = 'Reply'),
  'cccccccc-1111-4111-8111-111111111111'::uuid, 'the reply points at its parent');

-- Views
select pg_temp.as_anon('198.51.100.3');
select public.record_post_view('live-post');
select public.record_post_view('live-post');
select pg_temp.as_anon('198.51.100.4');
select public.record_post_view('live-post');
select public.record_post_view('later-post');
select public.record_post_view('draft-post');
select is((select view_count from public.post_stats where post_id = 'aaaaaaaa-1111-4111-8111-111111111111'), 2::bigint,
  'one view per client and hour');
select is((select count(*) from public.post_stats), 1::bigint, 'anon reads stats only of readable posts');
reset role;
select is((select count(*) from public.post_stats where post_id in
  ('aaaaaaaa-2222-4222-8222-222222222222', 'aaaaaaaa-3333-4333-8333-333333333333')), 0::bigint,
  'scheduled posts and drafts collect no views');
select pg_temp.as_anon('198.51.100.3');
select throws_ok($$update public.post_stats set view_count = 1000$$, '42501', null, 'anon cannot edit counters');
reset role;

-- Likes
select pg_temp.as_anon('198.51.100.5');
select throws_ok($$insert into public.post_likes (post_id, user_id)
  values ('aaaaaaaa-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333')$$, '42501', null,
  'anon cannot like');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select lives_ok($$insert into public.post_likes (post_id) values ('aaaaaaaa-1111-4111-8111-111111111111')$$,
  'a member likes a live post');
select throws_ok($$insert into public.post_likes (post_id) values ('aaaaaaaa-1111-4111-8111-111111111111')$$,
  '23505', null, 'a post is liked once per member');
select throws_ok($$insert into public.post_likes (post_id) values ('aaaaaaaa-2222-4222-8222-222222222222')$$,
  '42501', null, 'a scheduled post cannot be liked');
select throws_ok($$insert into public.post_likes (post_id, user_id)
  values ('aaaaaaaa-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222')$$, '42501', null,
  'nobody likes on behalf of someone else');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
insert into public.post_likes (post_id) values ('aaaaaaaa-1111-4111-8111-111111111111');
select is((select count(*) from public.post_likes), 1::bigint, 'members see only their own likes');
select is((select like_count from public.post_stats where post_id = 'aaaaaaaa-1111-4111-8111-111111111111'), 2::bigint,
  'likes are counted');
delete from public.post_likes where post_id = 'aaaaaaaa-1111-4111-8111-111111111111';
select is((select like_count from public.post_stats where post_id = 'aaaaaaaa-1111-4111-8111-111111111111'), 1::bigint,
  'unliking lowers the count');
reset role;

-- Reports
select pg_temp.as_anon('198.51.100.6');
select isnt(public.report_content('aaaaaaaa-1111-4111-8111-111111111111', null, ' Spam '), null,
  'anon reports a post');
select isnt(public.report_content(null, 'cccccccc-1111-4111-8111-111111111111', 'Rude'), null,
  'anon reports a comment');
select throws_ok($$select public.report_content(null, null, 'x')$$, '22023', null, 'a report needs a target');
select throws_ok($$select public.report_content('aaaaaaaa-1111-4111-8111-111111111111',
  'cccccccc-1111-4111-8111-111111111111', 'x')$$, '22023', null, 'a report has only one target');
select throws_ok($$select public.report_content('aaaaaaaa-3333-4333-8333-333333333333', null, 'x')$$, 'P0002', null,
  'drafts cannot be reported');
select throws_ok($$select public.report_content('aaaaaaaa-1111-4111-8111-111111111111', null, '  ')$$, '22023', null,
  'a report needs a reason');
select public.report_content('aaaaaaaa-1111-4111-8111-111111111111', null, 'three');
select public.report_content('aaaaaaaa-1111-4111-8111-111111111111', null, 'four');
select public.report_content('aaaaaaaa-1111-4111-8111-111111111111', null, 'five');
select throws_ok($$select public.report_content('aaaaaaaa-1111-4111-8111-111111111111', null, 'six')$$,
  'P0429', null, 'reports are rate limited per client');
select throws_ok($$select * from public.reports$$, '42501', null, 'anon cannot read reports');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*) from public.reports), 0::bigint, 'members do not see reports');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select reason from public.reports where comment_id is not null), 'Rude', 'admins see reports');
select lives_ok($$update public.reports set status = 'resolved', resolved_at = now()
  where comment_id is not null$$, 'admins resolve reports');

-- Suspensions
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok($$select * from public.admin_list_users()$$, '42501', null, 'members cannot list users');
select throws_ok($$select public.admin_set_suspended('33333333-3333-4333-8333-333333333333', true)$$, '42501', null,
  'members cannot suspend anyone');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select count(*) from public.admin_list_users(null, 1) where email like '%@test.local'), 3::bigint,
  'admins list every member');
select is((select email from public.admin_list_users('WRITER', 1)), 'writer@test.local',
  'the list searches names and emails, ignoring case');
select throws_ok($$select public.admin_set_suspended('11111111-1111-4111-8111-111111111111', true)$$, '22023', null,
  'admins cannot be suspended');
select public.admin_set_suspended('22222222-2222-4222-8222-222222222222', true, 'spam');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(public.get_my_suspension_status(), true, 'a suspended member is told so');
select throws_ok($$insert into public.posts (title, content) values ('More spam', 'x')$$, '42501', null,
  'a suspended member cannot post');
select throws_ok($$update public.posts set title = 'Changed' where id = 'aaaaaaaa-1111-4111-8111-111111111111'$$,
  '42501', null, 'a suspended member cannot edit own posts');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('post-images',
  '22222222-2222-4222-8222-222222222222/0b8c1a8e-1b8f-4c1a-9d1e-7a2b3c4d5e6f.webp')$$, '42501', null,
  'a suspended member cannot upload');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select public.admin_set_suspended('22222222-2222-4222-8222-222222222222', false);
reset role;
select is((select title from public.posts where id = 'aaaaaaaa-1111-4111-8111-111111111111'), 'Live post',
  'a suspended member could not edit');

-- Rate limits on new posts and uploads
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
insert into public.posts (title, content) select 'Post ' || n, 'x' from generate_series(1, 10) n;
select throws_ok($$insert into public.posts (title, content) values ('Post 11', 'x')$$, 'P0429', null,
  'the eleventh post within an hour is refused');
insert into storage.objects (bucket_id, name)
  select 'post-images', '33333333-3333-4333-8333-333333333333/' || gen_random_uuid() || '.webp'
  from generate_series(1, 30);
select throws_ok($$insert into storage.objects (bucket_id, name) values ('post-images',
  '33333333-3333-4333-8333-333333333333/' || gen_random_uuid() || '.webp')$$, '42501', null,
  'the 31st upload within an hour is refused');

select * from finish();
rollback;
