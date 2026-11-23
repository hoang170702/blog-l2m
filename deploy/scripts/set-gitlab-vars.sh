#!/usr/bin/env bash
# Creates or updates the GitLab CI/CD variables of one environment with glab.
#
#   deploy/scripts/set-gitlab-vars.sh uat                       # from deploy/vars/uat.env
#   deploy/scripts/set-gitlab-vars.sh production --generate-secrets
#
# deploy/vars/<env>.env is git-ignored (chmod 600): one KEY=value per line, no quotes.
# A key ending in _FILE names a file whose content becomes a File-type variable without
# the suffix, e.g. SSH_PRIVATE_KEY_FILE=~/.ssh/blog_deploy -> SSH_PRIVATE_KEY.
#
# --generate-secrets sets JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and REDIS_PASSWORD to
# random values that are never printed. Rotating them takes effect on the next deploy
# (admins are logged out). Set ADMIN_PASSWORD yourself in the vars file.
#
# Every variable is protected (only protected branches can read it) and masked + hidden
# when GitLab allows it. Values are passed on stdin, never on the command line.
set -euo pipefail

ENVIRONMENT=${1:?usage: set-gitlab-vars.sh <uat|production> [--generate-secrets]}
GENERATE=${2:-}
REPO=${GITLAB_REPO:-NguyenHuyHoang170702/blog-l2m}
VARS_FILE="$(dirname "$0")/../vars/$ENVIRONMENT.env"

case "$ENVIRONMENT" in uat | production) ;; *)
  echo "environment must be uat or production" >&2
  exit 1
  ;;
esac

# set_var <key> <type> < value-on-stdin
set_var() {
  local key=$1 type=$2 value flags
  value=$(cat)
  flags=(--protected --raw --scope "$ENVIRONMENT" --type "$type")
  # GitLab masks only single-line values of at least 8 characters.
  if [[ $type == env_var && ${#value} -ge 8 && $value != *$'\n'* ]]; then
    flags+=(--masked --hidden)
  fi
  # Hidden variables cannot be updated in place: delete, then create.
  glab variable delete "$key" --scope "$ENVIRONMENT" -R "$REPO" >/dev/null 2>&1 || true
  printf '%s' "$value" | glab variable set "$key" "${flags[@]}" -R "$REPO" >/dev/null
  echo "set $key ($type, scope: $ENVIRONMENT)"
}

if [[ "$GENERATE" == --generate-secrets ]]; then
  openssl rand -hex 32 | tr -d '\n' | set_var JWT_ACCESS_SECRET env_var
  openssl rand -hex 32 | tr -d '\n' | set_var JWT_REFRESH_SECRET env_var
  openssl rand -hex 24 | tr -d '\n' | set_var REDIS_PASSWORD env_var
fi

if [[ -f "$VARS_FILE" ]]; then
  [[ "$(stat -c %a "$VARS_FILE")" == 600 ]] || {
    echo "chmod 600 $VARS_FILE first" >&2
    exit 1
  }
  while IFS= read -r line || [[ -n $line ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    key=${line%%=*}
    value=${line#*=}
    if [[ $key == *_FILE ]]; then
      file=${value/#\~/$HOME}
      [[ -r "$file" ]] || {
        echo "cannot read $file for ${key%_FILE}" >&2
        exit 1
      }
      set_var "${key%_FILE}" file < "$file"
    else
      printf '%s' "$value" | set_var "$key" env_var
    fi
  done < "$VARS_FILE"
elif [[ "$GENERATE" != --generate-secrets ]]; then
  echo "nothing to do: $VARS_FILE not found" >&2
  exit 1
fi
