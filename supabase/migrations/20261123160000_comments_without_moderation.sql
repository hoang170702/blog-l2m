-- Comments show as soon as they are posted (D34). The post's author and admins can still hide
-- a comment ('rejected'), show it again ('approved') or delete it. 'pending' stays in the enum
-- but is no longer written.

alter table public.comments alter column status set default 'approved';

-- Guest comment: validated, shown immediately, max 3 per minute per client address.
create or replace function public.submit_comment(p_post_slug text, p_author_name text, p_content text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_post uuid;
  v_name text := btrim(coalesce(p_author_name, ''));
  v_content text := btrim(coalesce(p_content, ''));
  v_client text := coalesce(
    nullif(btrim(split_part(
      coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown');
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'author name must be 1-60 characters' using errcode = '22023';
  end if;
  if char_length(v_content) not between 1 and 2000 then
    raise exception 'comment must be 1-2000 characters' using errcode = '22023';
  end if;

  select id into v_post from public.posts where slug = p_post_slug and status = 'published';
  if v_post is null then
    raise exception 'post not found' using errcode = 'P0002';
  end if;

  delete from private.comment_attempts where created_at < now() - interval '1 hour';
  if (select count(*) from private.comment_attempts
      where client = v_client and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'too many comments, try again in a minute' using errcode = 'P0429';
  end if;
  insert into private.comment_attempts (client) values (v_client);

  insert into public.comments (post_id, author_name, content, status)
  values (v_post, v_name, v_content, 'approved')
  returning id into v_id;
  return v_id;
end;
$$;
