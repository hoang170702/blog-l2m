#!/usr/bin/env node
// Deletes images in the post-images bucket that no post cover and no profile avatar uses:
// covers replaced before saving, editors closed without saving, failed best-effort deletes.
//
// Dry run by default: it only lists what it would delete. Add --apply to delete.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/cleanup-unused-images.mjs [--apply] [--min-age-hours=24]
//
// The service role key (Dashboard → Project Settings → API keys; or the new "secret" key) reads
// drafts and every folder; keep it out of the repository and shell history. Files younger than
// --min-age-hours are skipped so an upload whose post or profile is still being edited survives.

const BUCKET = 'post-images'
const PAGE = 1000

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')
    return [key, value ?? 'true']
  }),
)
const apply = args.get('apply') === 'true'
const minAgeHours = Number(args.get('min-age-hours') ?? 24)
const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? ''

if (!url || !key || !Number.isFinite(minAgeHours) || minAgeHours < 0) {
  console.error(
    'Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-unused-images.mjs [--apply] [--min-age-hours=24]',
  )
  process.exit(2)
}

const headers = { apikey: key, Authorization: `Bearer ${key}` }

async function request(path, init = {}) {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { ...headers, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} answered ${response.status}: ${await response.text()}`)
  }
  return response.status === 204 ? null : response.json()
}

/** Every value of one column, page by page (the service role bypasses row-level security). */
async function column(table, name) {
  const values = []
  for (let offset = 0; ; offset += PAGE) {
    const rows = await request(
      `/rest/v1/${table}?select=${name}&${name}=not.is.null&order=${name}&limit=${PAGE}&offset=${offset}`,
    )
    values.push(...rows.map((row) => row[name]))
    if (rows.length < PAGE) return values
  }
}

/** Entries of one folder: files have an id, sub-folders do not. */
async function list(prefix) {
  const entries = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await request(`/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    entries.push(...page)
    if (page.length < PAGE) return entries
  }
}

/** All files: <user id>/<uuid>.<ext>, plus older covers stored at the bucket root. */
async function allFiles() {
  const files = []
  for (const entry of await list('')) {
    if (entry.id) files.push({ path: entry.name, createdAt: entry.created_at, size: entry.metadata?.size })
    else
      for (const file of await list(entry.name))
        if (file.id)
          files.push({
            path: `${entry.name}/${file.name}`,
            createdAt: file.created_at,
            size: file.metadata?.size,
          })
  }
  return files
}

const [covers, avatars, files] = await Promise.all([
  column('posts', 'cover_image_path'),
  column('profiles', 'avatar_path'),
  allFiles(),
])
const used = new Set([...covers, ...avatars])
const cutoff = Date.now() - minAgeHours * 3_600_000
const unused = files.filter(
  (file) => !used.has(file.path) && new Date(file.createdAt).getTime() < cutoff,
)
const tooNew = files.filter(
  (file) => !used.has(file.path) && new Date(file.createdAt).getTime() >= cutoff,
).length
const bytes = unused.reduce((sum, file) => sum + (file.size ?? 0), 0)

console.log(
  `${files.length} files, ${used.size} in use, ${unused.length} unused and older than ${minAgeHours} h (${(bytes / 1048576).toFixed(1)} MiB)${tooNew ? `, ${tooNew} unused but newer (kept)` : ''}`,
)
for (const file of unused) console.log(`  ${apply ? 'delete' : 'would delete'} ${file.path}`)

if (!apply) {
  if (unused.length) console.log('Dry run: nothing deleted. Run again with --apply to delete.')
  process.exit(0)
}
for (let index = 0; index < unused.length; index += 100) {
  const batch = unused.slice(index, index + 100).map((file) => file.path)
  await request(`/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    body: JSON.stringify({ prefixes: batch }),
  })
}
console.log(`Deleted ${unused.length} files.`)
