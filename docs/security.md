# Security and secrets

## What is committed

Only example files with placeholder values: `.env.example`, `deploy/.env.example`, `deploy/vars.example.env`. Real `.env` files and `deploy/vars/` are git-ignored. gitleaks runs in a pre-commit hook (`pre-commit install`) and as the first pipeline job; a finding fails the pipeline.

The frontend has no secrets: anything in `VITE_*` variables ends up in public JavaScript.

## Where secrets live

- **GitLab CI/CD variables**, all **protected** (only the protected `uat`/`prod`/`master` branches can read them, so feature branches and merge requests from them cannot), scoped to the `uat` or `production` environment, and **masked + hidden** when single-line. `SSH_PRIVATE_KEY` is a File variable; it cannot be masked and is never printed.
- **On the server**, the deploy job writes `/opt/blog-<env>/.env` with mode 600 inside a mode-700 directory owned by `deploy`. `deploy.sh` refuses to run if the file is readable by others. Values are written single-quoted, never echoed, and the job has no `set -x`.

## Application safeguards

- Passwords hashed with Argon2id; login timing equalized for unknown users.
- Access tokens (15 min) live only in browser memory; refresh tokens are httpOnly `SameSite=Strict` cookies limited to `/api/auth`, rotated on each use, revoked on logout, and reuse of an old token revokes every session.
- Admin routes require the `ADMIN` role; there is no public sign-up.
- Validation rejects unknown fields; rate limits on login (5/min), comments (3/min) and globally (100/min), keyed on the real client IP behind Traefik and Nginx.
- Markdown is rendered without raw HTML and sanitized; Nginx sends a strict Content-Security-Policy.
- Uploads: type detected from file content, random file names, served with `nosniff` and `default-src 'none'`.
- Traefik reaches Docker through a read-only socket proxy; only Traefik publishes ports.

## Rotating secrets

| Secret | How | Effect |
| --- | --- | --- |
| `JWT_*`, `REDIS_PASSWORD` | `set-gitlab-vars.sh <env> --generate-secrets`, then redeploy | Admins log in again |
| `ADMIN_PASSWORD` | Update the variable, redeploy | Password changes on deploy |
| Database password | Reset in Supabase, update `DATABASE_URL`/`DIRECT_URL`, redeploy | |
| Deploy token | Revoke in GitLab, create a new one, update `DEPLOY_REGISTRY_*` | |
| SSH key | New key pair, add the public key to `~deploy/.ssh/authorized_keys`, update `SSH_PRIVATE_KEY`, remove the old key | |
| GitLab personal token used by `glab` | Revoke in GitLab user settings | |

## If a secret leaks

1. Rotate it first (table above): a secret pushed to a remote must be treated as compromised even after removal.
2. Then remove it from history if needed (`git filter-repo`) and force-push with the team's agreement.
3. Check access logs (Supabase, server `auth.log`, GitLab audit events).
