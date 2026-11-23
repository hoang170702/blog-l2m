# Deployment

One Linux server runs three Docker Compose stacks:

| Directory | Compose project | Purpose |
| --- | --- | --- |
| `/opt/edge` | `edge` | Traefik: ports 80/443, Let's Encrypt certificates, routes by host name |
| `/opt/blog-uat` | `blog-uat` | UAT: `web` (Nginx + SPA), `backend`, `redis`, uploads volume |
| `/opt/blog-prod` | `blog-prod` | Production: same services, separate data |

Each environment uses its own Supabase project. Uploaded images live in the `uploads` volume of each stack.

## 1. Server

Requirements: Ubuntu 22.04/24.04, 2 GB RAM or more, a public IP with ports 22, 80 and 443 reachable.

1. Create an SSH key pair for CI (no passphrase): `ssh-keygen -t ed25519 -f ~/.ssh/blog_deploy -C gitlab-deploy`
2. Copy `deploy/scripts/setup-server.sh` to the server and run it as root:
   ```bash
   sudo DEPLOY_PUBKEY="$(cat blog_deploy.pub)" bash setup-server.sh
   ```
   It installs Docker, creates the `deploy` user, `/opt/edge`, `/opt/blog-uat`, `/opt/blog-prod` (mode 700) and the `edge` network, disables SSH passwords and root login, and enables the firewall. **Check that your own key-based sudo login works before closing the session.**
3. DNS: point `A` records for `<domain>` and `uat.<domain>` to the server.
4. Start the edge proxy as `deploy`:
   ```bash
   scp deploy/edge/docker-compose.yml deploy@<server>:/opt/edge/
   ssh deploy@<server> 'cd /opt/edge && ACME_EMAIL=you@example.com docker compose up -d'
   ```

### Server without inbound SSH

If the server is behind NAT or a firewall that blocks SSH from the internet, install a GitLab Runner on the server itself (shell executor, tag `production`, user `deploy`) and register it to the project. Override the deploy jobs in `.gitlab-ci.yml` with `tags: [production]` and a script that copies the files locally and runs `deploy.sh`; the runner only makes outbound connections to GitLab.

## 2. Supabase

For each environment (UAT, production):

1. Create a project in the region closest to the server; note the database password.
2. **Connect → ORMs / connection string**:
   - `DATABASE_URL`: *Transaction pooler* (port `6543`) + `?uselibpqcompat=true&sslmode=require`
   - `DIRECT_URL`: *Session pooler* (port `5432`) + `?sslmode=require`
3. URL-encode special characters in the password, and do not use `'`.

`DATABASE_URL` is read by node-postgres, which treats a plain `sslmode=require` as full certificate verification against public CAs and rejects Supabase's own CA (`self-signed certificate in certificate chain`). `uselibpqcompat=true` restores the usual meaning: encrypted, certificate not checked — the same as `DIRECT_URL` for the Prisma CLI. Prisma-engine options such as `pgbouncer=true` or `connection_limit` have no effect on node-postgres. To also verify the server certificate, download the CA from **Database settings → SSL configuration**, make it available in the backend container, and use `?sslmode=verify-full&sslrootcert=/path/to/prod-ca-2021.crt`.

Migrations run on every deploy through `DIRECT_URL` before containers are replaced.

## 3. GitLab variables

Create `deploy/vars/uat.env` and `deploy/vars/production.env` from `deploy/vars.example.env` (the directory is git-ignored), `chmod 600` them, then:

```bash
deploy/scripts/set-gitlab-vars.sh uat --generate-secrets
deploy/scripts/set-gitlab-vars.sh production --generate-secrets
```

Each variable is created **protected**, scoped to the environment, and **masked + hidden** when possible. `--generate-secrets` sets random `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `REDIS_PASSWORD` without printing them.

| Variable | Example | Notes |
| --- | --- | --- |
| `DEPLOY_HOST` | `203.0.113.10` | |
| `DEPLOY_USER` | `deploy` | |
| `SSH_PRIVATE_KEY` | file | From `SSH_PRIVATE_KEY_FILE=~/.ssh/blog_deploy`; File type |
| `SSH_KNOWN_HOSTS` | `ssh-keyscan -t ed25519 <host>` output | |
| `DEPLOY_PATH` | `/opt/blog-uat`, `/opt/blog-prod` | |
| `APP_DOMAIN` | `uat.example.com`, `example.com` | Also the environment URL |
| `DATABASE_URL`, `DIRECT_URL` | Supabase URLs | |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | | Admin is created or its password updated on every deploy |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_PASSWORD` | generated | Rotating logs everyone out |
| `DEPLOY_REGISTRY_USER`, `DEPLOY_REGISTRY_PASSWORD` | deploy token | Project deploy token with `read_registry` |

Optional: `COMPOSE_PROFILES=selfhost-db` and `POSTGRES_PASSWORD` for the interim self-hosted database (below).

The pipeline adds `COMPOSE_PROJECT_NAME` (`blog-uat` / `blog-prod`), `REGISTRY_IMAGE` and `IMAGE_TAG` (commit SHA) itself. `deploy/.env.example` shows the complete `.env` the server receives.

## 4. First deploy

1. Merge a feature branch into `uat` → `deploy:uat` runs automatically. Check `https://uat.<domain>` and log in at `/admin`.
2. Merge `uat` into `prod` → press **deploy:production**.

The deploy job copies `deploy/docker-compose.yml` and `deploy/scripts/deploy.sh` to `DEPLOY_PATH`, writes `.env` (mode 600) from the variables, and runs `deploy.sh <commit-sha>`, which pulls images, applies migrations, ensures the admin account, starts the stack and waits until every container is healthy.

## Rollback

On the server: `cd /opt/blog-prod && cat .deployed-tags && ./deploy.sh <previous-tag>`, or re-run the deploy job of an older pipeline. Database migrations are not rolled back; write backward-compatible migrations.

## Backups

- Database: Supabase backups (plan dependent); optionally `pg_dump "$DIRECT_URL"` on a schedule.
- Uploads: `docker run --rm -v blog-prod_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tgz -C /data .`
- Redis holds only cache, rate limits and sessions; losing it logs admins out.

## Interim self-hosted database

Before Supabase is ready, set `COMPOSE_PROFILES=selfhost-db`, `POSTGRES_PASSWORD`, and point `DATABASE_URL`/`DIRECT_URL` at `postgresql://blog:<password>@postgres:5432/blog`. To move to Supabase later:

```bash
docker compose exec -T postgres pg_dump -U blog --no-owner --no-acl blog > blog.sql
psql "$SUPABASE_DIRECT_URL" -f blog.sql
```

Then change the variables to the Supabase URLs, remove `COMPOSE_PROFILES`, and redeploy.

## Troubleshooting

- `docker compose ps` / `docker compose logs backend web` in the environment directory.
- Certificate issues: `docker compose logs traefik` in `/opt/edge` (DNS must point to the server, port 80 open).
- `deploy.sh` refuses to run when `.env` is not mode 600.
