-- Two more starter categories (slugs from the categories_slug trigger: thuc-tap, thu-viec).

insert into public.categories (name) values
  ('Thực tập'),
  ('Thử việc')
on conflict (name) do nothing;
