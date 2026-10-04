#!/usr/bin/env sh
# IF-01 one-time VM setup (Ubuntu 24.04 on Vultr). Run as root on the new VM.
set -e
apt-get update
apt-get install -y openjdk-21-jre-headless git debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
id heist >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin heist
mkdir -p /opt/heist-havoc && chown heist:heist /opt/heist-havoc
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
echo "Now: put .env in /opt/heist-havoc (chmod 600), edit deploy/Caddyfile with your domain, then run deploy/deploy.sh from your laptop."
