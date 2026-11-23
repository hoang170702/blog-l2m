-- Local development only (`supabase db reset`); `supabase db push` never runs this file.
-- Admin login: admin@example.com / local-dev-admin-password

insert into private.account_allowlist (email) values ('admin@example.com');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admin@example.com',
  extensions.crypt('local-dev-admin-password', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","email":"admin@example.com","email_verified":true}',
  'email', now(), now(), now()
);

insert into private.site_admins (user_id) values ('aaaaaaaa-0000-4000-8000-000000000001');

insert into public.categories (name) values ('Chung');
insert into public.tags (name) values ('Chào mừng');

insert into public.posts (title, excerpt, content, status, author_id, category_id)
select 'Xin chào L2M Blog',
       'Bài viết đầu tiên trên blog.',
       E'# Xin chào\n\nĐây là bài viết mẫu viết bằng **Markdown**.',
       'published', 'aaaaaaaa-0000-4000-8000-000000000001', c.id
from public.categories c where c.slug = 'chung';

insert into public.post_tags (post_id, tag_id)
select p.id, t.id from public.posts p, public.tags t
where p.slug = 'xin-chao-l2m-blog' and t.slug = 'chao-mung';
