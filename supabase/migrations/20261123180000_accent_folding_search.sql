-- Search matches title, excerpt and content, ignoring case and Vietnamese accents (D40):
-- "lap trinh" finds "Lập trình". posts.search_text holds the folded text; the client folds the
-- query the same way (frontend/src/lib/fold.ts) and filters with ilike. translate() keeps this
-- free of the unaccent extension, so the PGlite test runner can apply it too.

create function private.fold_vi(value text) returns text
language sql immutable strict parallel safe set search_path = ''
as $$
  select translate(lower(normalize(value, nfc)),
    'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
$$;
revoke execute on function private.fold_vi(text) from public, anon;
grant execute on function private.fold_vi(text) to authenticated;

alter table public.posts add column search_text text not null default '';

-- Security definer like set_slug(): runs with the owner's rights, whoever writes the post.
create function private.set_search_text() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.search_text := private.fold_vi(concat_ws(' ', new.title, new.excerpt, new.content));
  return new;
end;
$$;
create trigger posts_search_text before insert or update of title, excerpt, content on public.posts
  for each row execute function private.set_search_text();

-- Backfill without bumping updated_at.
alter table public.posts disable trigger posts_touch;
update public.posts set search_text = private.fold_vi(concat_ws(' ', title, excerpt, content));
alter table public.posts enable trigger posts_touch;
