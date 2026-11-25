-- Profanity filter, commenter address and IP blocks (D50).
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

delete from public.comments; delete from public.post_tags; delete from public.posts;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'admin@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'writer@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'reader@test.local');
insert into private.site_admins (user_id) values ('11111111-1111-4111-8111-111111111111');
insert into public.posts (id, title, slug, content, status, published_at, author_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'Open post', 'open-post', 'x', 'published', now() - interval '1 day',
   '22222222-2222-4222-8222-222222222222');

create function pg_temp.as_anon(ip text, ua text default 'Mozilla/5.0 (Linux; Android 14; SM-A155F) Chrome/131') returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true),
         set_config('request.headers', json_build_object('x-forwarded-for', ip, 'user-agent', ua)::text, true);
$$;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Masking
select is((private.mask_profanity('Bài này VCL quá')).o_text, 'Bài này *** quá', 'a banned word becomes stars of the same length');
select is((private.mask_profanity('Đồ ngu và ĐỊT mẹ')).o_text, '****** và ******', 'matching ignores case and accents');
select is((private.mask_profanity('Đụ mẹ nó')).o_text, '***** nó', 'multi-word entries are masked as a whole');
select is((private.mask_profanity('Trình editor và quả melon')).o_masked, false, 'a banned string inside another word is left alone');
select is((private.mask_profanity('Bài hay quá')).o_masked, false, 'a clean text is not flagged');
select is((private.mask_profanity('shit happens, SHIT!')).o_text, '**** happens, ****!', 'every occurrence is masked');

-- Masked client hints
select is(private.mask_client('113.161.42.7'), '113.161.*.*', 'IPv4 keeps two octets');
select is(private.mask_client('2401:d800:abcd::1'), '2401:d800:*', 'IPv6 keeps two groups');
select is(private.mask_client('unknown'), null, 'unknown clients have no hint');

-- Guest comments
select pg_temp.as_anon('203.0.113.7');
select set_config('test.c1', public.submit_comment('open-post', 'Lan', 'Bài hay quá')::text, true);
select set_config('test.c2', public.submit_comment('open-post', 'Bob', 'Bài này vcl quá')::text, true);
reset role;
select results_eq($$select content, masked, client_hint from public.comments where id = current_setting('test.c1')::uuid$$,
  $$values ('Bài hay quá', false, null::text)$$, 'a clean comment is stored as-is without a client hint');
select results_eq($$select content, masked, client_hint from public.comments where id = current_setting('test.c2')::uuid$$,
  $$values ('Bài này *** quá', true, '203.0.*.*'::text)$$, 'a profane comment is masked and shows a partial IP');
select results_eq($$select client, user_agent from private.comment_clients where comment_id = current_setting('test.c2')::uuid$$,
  $$values ('203.0.113.7', 'Mozilla/5.0 (Linux; Android 14; SM-A155F) Chrome/131')$$,
  'the full address and user agent are kept privately');

-- Who may read the full address
select pg_temp.as_anon('203.0.113.7');
select throws_ok($$select * from public.banned_words$$, '42501', null, 'anon cannot read the banned words');
select throws_ok($$select * from public.comment_client(current_setting('test.c2')::uuid)$$, '42501', null,
  'anon cannot call comment_client');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is((select count(*) from public.comment_client(current_setting('test.c2')::uuid)), 0::bigint,
  'a stranger gets nothing from comment_client');
select throws_ok($$insert into public.banned_words (word) values ('xyz')$$, '42501', null,
  'a member cannot add banned words');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select client from public.comment_client(current_setting('test.c2')::uuid)), '203.0.113.7',
  'the post author reads the full address');
select throws_ok($$select public.admin_block_client(current_setting('test.c2')::uuid, true, 'spam')$$, '42501', null,
  'the post author cannot block an address');
select throws_ok($$update public.comments set masked = false, client_hint = null
  where id = current_setting('test.c2')::uuid$$, '42501', null,
  'the post author cannot clear the mask flag (security audit: update limited to status)');
select throws_ok($$update public.comments set content = 'rewritten' where id = current_setting('test.c2')::uuid$$,
  '42501', null, 'the post author cannot rewrite a comment');
select lives_ok($$update public.comments set status = 'rejected' where id = current_setting('test.c2')::uuid$$,
  'the post author still moderates the status');

-- Blocking
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok($$select public.admin_block_client(current_setting('test.c2')::uuid, true, 'spam')$$, 'admin blocks the address');
select is((select comment_count from public.admin_list_blocked_clients()), 2::bigint,
  'the block list counts comments from that address');
select pg_temp.as_anon('203.0.113.7');
select throws_ok($$select public.submit_comment('open-post', 'Bob', 'again')$$, 'P0403', null,
  'a blocked address cannot comment');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select public.admin_unblock_client('203.0.113.7');
select pg_temp.as_anon('203.0.113.7');
select lives_ok($$select public.submit_comment('open-post', 'Bob', 'back')$$, 'after unblocking the address comments again');

-- Admin-added words apply to new comments
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
insert into public.banned_words (word) values ('xau xi');
select pg_temp.as_anon('198.51.100.2');
select set_config('test.c3', public.submit_comment('open-post', 'Cy', 'Thật xấu xí')::text, true);
reset role;
select is((select content from public.comments where id = current_setting('test.c3')::uuid), 'Thật ******',
  'a word added by an admin is masked in later comments');

select * from finish();
rollback;
