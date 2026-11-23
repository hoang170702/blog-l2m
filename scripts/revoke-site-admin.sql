-- Remove website-admin rights from one account (business data is untouched).
-- Usage: psql "$DIRECT_URL" -v "email=admin@example.com" -f scripts/revoke-site-admin.sql
\set ON_ERROR_STOP on
delete from private.site_admins
where user_id in (select id from auth.users where lower(email) = lower(btrim(:'email')))
returning user_id as revoked;
