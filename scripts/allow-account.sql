-- Allow one email to get an account (the before_user_created hook rejects all others).
-- Usage: psql "$DIRECT_URL" -v "email=someone@example.com" -f scripts/allow-account.sql
\set ON_ERROR_STOP on
insert into private.account_allowlist (email)
values (lower(btrim(:'email')))
on conflict (email) do nothing
returning email as allowed;
