# Deploying (IF-01)

Target: one small Vultr VM (1 vCPU / 1-2 GB is plenty for several rooms), Java 21, systemd, Caddy for TLS and
WebSocket upgrade.

1. Create an Ubuntu 24.04 VM, add your SSH key. On the VM: `sh provision.sh` (copy `deploy/provision.sh` over).
2. Put secrets in `/opt/heist-havoc/.env` (`chmod 600`): `PUBLIC_URL`, `HEIST_KEY_SECRET`, optional `DATABASE_URL`,
   `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`. Never commit them.
3. From your laptop: `HOST=root@<ip> DOMAIN=<domain> ./deploy/deploy.sh`. It builds the jar, rsyncs the server and
   static clients, installs the systemd unit, writes the Caddyfile and checks `/health`.
4. Verify: `curl https://<domain>/health` and join a room from 4 phones on cellular (done-when for IF-01).

Container alternative: `docker build -t heist . && docker run -p 7070:7070 --env-file .env heist`.
Health: `GET /health` returns `{ok, rooms, uptimeSec, events}`.
