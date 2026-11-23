// Runs supabase/migrations + supabase/tests/database (pgTAP) on an in-process PostgreSQL
// (PGlite), so CI can check schema, RLS and functions without Docker.
// It stubs only what the migrations touch from Supabase (roles, auth.users/uid/jwt,
// storage buckets/objects). Auth hooks, the Data API and Storage itself are not exercised:
// run `npm run db:test` against `supabase start` for that.
import { PGlite } from '@electric-sql/pglite'
import { pgtap } from '@electric-sql/pglite-pgtap'
import { readdir, readFile } from 'node:fs/promises'

const root = new URL('../supabase/', import.meta.url)

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create role supabase_auth_admin nologin;

  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
  create extension pgtap with schema extensions;
  alter database postgres set search_path = public, extensions;
  set search_path = public, extensions;

  -- Supabase grants table and function access by default; RLS and the migrations restrict it.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key,
    email text,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid,
    created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.buckets, storage.objects to anon, authenticated, service_role;
`

const sqlFiles = async (dir) =>
  (await readdir(new URL(dir, root))).filter((name) => name.endsWith('.sql')).sort()

// pgTAP prints TAP lines as rows; collect every text value.
const tapLines = (results) =>
  results.flatMap((result) =>
    result.rows.flatMap((row) =>
      Object.values(row)
        .filter((value) => typeof value === 'string')
        .flatMap((value) => value.split('\n')),
    ),
  )

const db = new PGlite({ extensions: { pgtap } })
let failed = false
try {
  await db.exec(SUPABASE_STUBS)

  const migrations = await sqlFiles('migrations/')
  for (const name of migrations) {
    await db.exec(await readFile(new URL(`migrations/${name}`, root), 'utf8'))
  }
  console.log(`applied ${migrations.length} migrations`)

  const suites = await sqlFiles('tests/database/')
  if (suites.length === 0) throw new Error('no database tests found')
  let total = 0
  for (const name of suites) {
    const lines = tapLines(await db.exec(await readFile(new URL(`tests/database/${name}`, root), 'utf8')))
    const planned = Number(lines.find((line) => /^1\.\.\d+$/.test(line))?.slice(3) ?? 0)
    const ran = lines.filter((line) => /^(not )?ok \d+/.test(line))
    const problems = lines.filter((line) => /^(not ok|Bail out!)|^# Looks like/.test(line))
    if (!planned || ran.length !== planned || problems.length > 0) {
      console.error(lines.filter((line) => /^(1\.\.|(not )?ok|#|Bail)/.test(line)).join('\n'))
      console.error(`FAIL ${name}: ${ran.length}/${planned} assertions ran, ${problems.length} problems`)
      failed = true
      continue
    }
    total += ran.length
    console.log(`ok   ${name}: ${ran.length} assertions`)
  }
  if (!failed) console.log(`all ${total} assertions passed in ${suites.length} suites`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  failed = true
} finally {
  await db.close()
}
process.exitCode = failed ? 1 : 0
