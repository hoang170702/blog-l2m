#!/usr/bin/env bash
# Deploys (or rolls back to) an image tag of this environment's stack.
# Runs on the server from the environment directory (e.g. /opt/blog-uat), next to
# docker-compose.yml and the .env written by the CI deploy job.
#
#   ./deploy.sh <image-tag>      e.g. ./deploy.sh 1a2b3c4d
#   SKIP_LOGIN=1 ./deploy.sh ... use images already present locally (no registry login)
set -euo pipefail

TAG=${1:?usage: deploy.sh <image-tag>}
cd "$(dirname "$0")"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f .env ]] || die ".env not found in $(pwd)"
[[ "$(stat -c %a .env)" == 600 ]] || die ".env must have mode 600 (chmod 600 .env)"
[[ "$TAG" =~ ^[A-Za-z0-9._-]+$ ]] || die "invalid image tag: $TAG"

# Keep the deployed tag in .env so later `docker compose` commands use the same images.
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG='$TAG'/" .env
else
  printf "IMAGE_TAG='%s'\n" "$TAG" >> .env
fi

set -a
# shellcheck disable=SC1091 # written by the deploy job; values are single-quoted
. ./.env
set +a

registry=${REGISTRY_IMAGE%%/*}
if [[ -z "${SKIP_LOGIN:-}" ]]; then
  log "logging in to $registry"
  printf '%s' "$DEPLOY_REGISTRY_PASSWORD" |
    docker login -u "$DEPLOY_REGISTRY_USER" --password-stdin "$registry" >/dev/null
  trap 'docker logout "$registry" >/dev/null 2>&1 || true' EXIT
  log "pulling images $TAG"
  docker compose pull --quiet backend web redis
fi

if [[ ",${COMPOSE_PROFILES:-}," == *,selfhost-db,* ]]; then
  log "starting self-hosted database"
  docker compose up -d --wait postgres
fi

# Migrations run before any running container is replaced: if they fail, the
# previous version keeps serving traffic.
log "applying database migrations"
docker compose run --rm --no-deps -T backend ./node_modules/.bin/prisma migrate deploy

log "ensuring admin account"
docker compose run --rm --no-deps -T backend node dist/seed.js

log "starting containers"
if ! docker compose up -d --remove-orphans --wait --wait-timeout 120; then
  docker compose ps
  docker compose logs --tail 80 backend web
  die "containers did not become healthy"
fi

printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TAG" >> .deployed-tags
docker image prune -f >/dev/null
log "deployed $TAG ($COMPOSE_PROJECT_NAME)"
