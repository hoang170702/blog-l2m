-- Public bucket for post images. Anyone can read through the public URL; only admins write.
-- The browser compresses images before upload, so a small size cap is enough.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 2097152,
        array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "admin uploads post images" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and private.is_admin()
              and name ~ '^[0-9a-f-]{36}\.(webp|jpg|png|gif)$');
create policy "admin updates post images" on storage.objects for update to authenticated
  using (bucket_id = 'post-images' and private.is_admin())
  with check (bucket_id = 'post-images' and private.is_admin());
create policy "admin deletes post images" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and private.is_admin());
-- Needed by the admin UI to list/replace objects; public reads use the public URL instead.
create policy "admin lists post images" on storage.objects for select to authenticated
  using (bucket_id = 'post-images' and private.is_admin());
