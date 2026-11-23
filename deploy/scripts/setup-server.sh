#!/usr/bin/env bash
# One-time server preparation (Ubuntu 22.04/24.04), run as root:
#   sudo DEPLOY_PUBKEY="ssh-ed25519 AAAA... gitlab-deploy" bash setup-server.sh
#
# Installs Docker Engine + Compose plugin, creates the `deploy` user that CI logs in as,
# creates /opt/edge, /opt/blog-uat and /opt/blog-prod, the shared `edge` network,
# hardens SSH (keys only, no root login) and enables the firewall (22, 80, 443).
set -euo pipefail

DEPLOY_USER=${DEPLOY_USER:-deploy}
DEPLOY_PUBKEY=${DEPLOY_PUBKEY:?set DEPLOY_PUBKEY to the public key matching the SSH_PRIVATE_KEY CI variable}
ENV_DIRS=(/opt/edge /opt/blog-uat /opt/blog-prod)

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }

echo "==> Docker Engine"
if ! command -v docker >/dev/null; then
  apt-get update -q
  apt-get install -yq ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> deploy user"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
auth_keys="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$auth_keys"
grep -qxF "$DEPLOY_PUBKEY" "$auth_keys" || echo "$DEPLOY_PUBKEY" >> "$auth_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$auth_keys"
chmod 600 "$auth_keys"

echo "==> directories"
for dir in "${ENV_DIRS[@]}"; do
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$dir"
done

echo "==> shared edge network"
docker network inspect edge >/dev/null 2>&1 || docker network create edge >/dev/null

echo "==> SSH hardening"
cat > /etc/ssh/sshd_config.d/90-hardening.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
CONF
sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd

echo "==> firewall"
apt-get install -yq ufw unattended-upgrades >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
dpkg-reconfigure -f noninteractive unattended-upgrades

cat <<NEXT

Done. Next steps:
  1. Make sure your own login key works for a sudo user before closing this session
     (root login and passwords are now disabled).
  2. Copy deploy/edge/docker-compose.yml to /opt/edge and start it as $DEPLOY_USER:
       cd /opt/edge && ACME_EMAIL=you@example.com docker compose up -d
  3. Point DNS (A records) for your domain and uat.<domain> to this server.
  4. Add SSH_KNOWN_HOSTS to GitLab:  ssh-keyscan -t ed25519 <this-server>
NEXT
