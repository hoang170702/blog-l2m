-- Grant website-admin rights to one existing, email-verified account.
-- Fails (and changes nothing) unless exactly one confirmed account has this email; safe to rerun.
-- Usage: psql "$DIRECT_URL" -v "email=admin@example.com" -f scripts/bootstrap-site-admin.sql
\set ON_ERROR_STOP on
begin;
select set_config('app.bootstrap_admin_email', :'email', true) as bootstrap_email \gset
do $$
declare
  target uuid;
begin
  select id into strict target from auth.users
  where lower(email) = lower(btrim(current_setting('app.bootstrap_admin_email')))
    and email_confirmed_at is not null;
  insert into private.site_admins (user_id) values (target) on conflict (user_id) do nothing;
exception
  when no_data_found then raise exception 'No single verified account with this email; nothing granted.';
  when too_many_rows then raise exception 'Email matches more than one account; nothing granted.';
end;
$$;
commit;
