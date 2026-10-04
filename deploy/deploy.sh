#!/usr/bin/env sh
# IF-01 deploy from your laptop: build, copy, restart, health check.
#   HOST=root@203.0.113.10 DOMAIN=heisthavoc.example ./deploy/deploy.sh
set -e
: "${HOST:?set HOST=user@vm-ip}"
cd "$(dirname "$0")/.."
(cd server && ./mvnw -q -B -DskipTests package)
rsync -az --delete --exclude data --exclude .env \
  server/target/heist-server.jar server/db client shared content dev deploy "$HOST:/opt/heist-havoc/stage/"
ssh "$HOST" 'set -e
  cd /opt/heist-havoc
  mkdir -p server/target server
  mv stage/heist-server.jar server/target/heist-server.jar
  rm -rf client shared content dev server/db deploy
  mv stage/client stage/shared stage/content stage/dev stage/deploy . && mv stage/db server/db
  chown -R heist:heist /opt/heist-havoc
  cp deploy/heist-havoc.service /etc/systemd/system/heist-havoc.service
  if [ -n "'"${DOMAIN:-}"'" ]; then sed "s/heisthavoc.example/'"${DOMAIN:-}"'/" deploy/Caddyfile > /etc/caddy/Caddyfile && systemctl reload caddy; fi
  systemctl daemon-reload && systemctl enable --now heist-havoc && systemctl restart heist-havoc
  sleep 3 && curl -fsS http://127.0.0.1:7070/health'
echo
echo "Deployed. Check https://${DOMAIN:-<your-domain>}/health"
