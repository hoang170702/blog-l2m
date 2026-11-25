-- Function exposure, guest comments, slugs and publishing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Start from an empty content set (seed data is removed inside this rolled-back transaction).
delete from public.comments; delete from public.post_tags; delete from public.posts;

-- Only intended RPCs are callable through the API.
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('anon', p.oid, 'execute')),
  array['follower_count', 'record_post_view', 'report_content', 'submit_comment'],
  'signed-out callers can execute only the public RPCs'
);
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('authenticated', p.oid, 'execute')),
  array['admin_block_client', 'admin_list_blocked_clients', 'admin_list_users', 'admin_set_hidden',
        'admin_set_suspended', 'admin_unblock_client', 'comment_client', 'dm_inbox', 'follower_count',
        'get_my_admin_status', 'get_my_suspension_status', 'mark_notifications_read', 'mark_thread_read', 'open_dm',
        'record_post_view', 'report_content', 'submit_comment'],
  'signed-in callers can execute only the app RPCs'
);

insert into public.posts (title, content, status) values ('Open post', 'x', 'published');
insert into public.posts (title, content, status) values ('Hidden draft', 'x', 'draft');

select set_config('role', 'anon', true);
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1"}', true);

select isnt(public.submit_comment('open-post', '  Lan  ', '  Hay quá  '), null, 'guest comment accepted');
reset role;
select results_eq($$select author_name, content, status::text from public.comments$$,
  $$values ('Lan', 'Hay quá', 'approved')$$, 'comment is trimmed and shown immediately');
select set_config('role', 'anon', true);

select throws_ok($$select public.submit_comment('open-post', '   ', 'x')$$, '22023', null, 'empty name rejected');
select throws_ok($$select public.submit_comment('open-post', 'A', repeat('x', 2001))$$, '22023', null,
  'overlong comment rejected');
select throws_ok($$select public.submit_comment('hidden-draft', 'A', 'x')$$, 'P0002', null,
  'comments on drafts rejected');

select lives_ok($$select public.submit_comment('open-post', 'A', 'two')$$, 'second comment from the same client');
select lives_ok($$select public.submit_comment('open-post', 'A', 'three')$$, 'third comment from the same client');
select throws_ok($$select public.submit_comment('open-post', 'A', 'four')$$, 'P0429', null,
  'fourth comment within a minute is rate limited');
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.9"}', true);
select lives_ok($$select public.submit_comment('open-post', 'B', 'other client')$$,
  'another client is not affected');
reset role;

-- Slugs and publishing
insert into public.posts (title, content) values ('Công nghệ Đà Lạt', 'x');
select is((select slug from public.posts where title = 'Công nghệ Đà Lạt'), 'cong-nghe-da-lat',
  'Vietnamese titles become ASCII slugs');
insert into public.posts (title, content) values ('Công nghệ Đà Lạt', 'y');
select is((select count(*) from public.posts where slug = 'cong-nghe-da-lat-2'), 1::bigint,
  'duplicate titles get a numeric suffix');
insert into public.tags (name) values ('🚀');
select is((select slug from public.tags where name = '🚀'), 'item', 'names without letters fall back to item');

update public.posts set status = 'published' where slug = 'cong-nghe-da-lat';
select set_config('test.first_published', (select published_at::text from public.posts where slug = 'cong-nghe-da-lat'), true);
update public.posts set status = 'draft' where slug = 'cong-nghe-da-lat';
update public.posts set status = 'published' where slug = 'cong-nghe-da-lat';
select is((select published_at::text from public.posts where slug = 'cong-nghe-da-lat'),
  current_setting('test.first_published'), 'published_at keeps the first publish time');

-- Accent-folding search (D40)
insert into public.posts (title, excerpt, content, status)
  values ('Học LẬP TRÌNH', 'Đà Nẵng', 'Nội dung về Ưu tiên', 'published');
select is((select search_text from public.posts where title = 'Học LẬP TRÌNH'),
  'hoc lap trinh da nang noi dung ve uu tien', 'search text folds case and Vietnamese accents');
update public.posts set content = 'Phở bò' where title = 'Học LẬP TRÌNH';
select ok((select search_text like '%pho bo%' from public.posts where title = 'Học LẬP TRÌNH'),
  'search text follows content edits');
select set_config('role', 'anon', true);
select is((select count(*) from public.posts where search_text ilike '%lap trinh%'), 1::bigint,
  'anon finds a post by its unaccented title');
select is((select count(*) from public.posts where search_text ilike '%pho bo%'), 1::bigint,
  'anon finds a post by its unaccented content');
reset role;

-- frontend/src/lib/fold.test.ts checks foldVi() on the same string.
select is(private.fold_vi('àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ'),
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd', 'fold_vi maps every Vietnamese letter like the client');

-- Open sign-up: the allowlist hook is gone
select is((select count(*) from pg_proc where proname = 'hook_before_user_created'), 0::bigint,
  'no sign-up hook remains');

select * from finish();
rollback;
