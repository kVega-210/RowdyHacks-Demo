# HEIST HAVOC!

A party heist game for 2-8 players: one big host screen, everyone's phone, real keys on the table.
Crack minigames to pull cash out of a shrinking bank, steal from your friends by scanning their keys, freeze,
sabotage, gamble, and escape with the biggest stash. Rules: [docs/game-spec.md](docs/game-spec.md).

## Run it (one command)
Requires Java 21. Maven comes with the wrapper.
```sh
./run.sh            # macOS/Linux  (Windows: run.cmd)
```
Open **http://localhost:7070/host/** on the big screen, scan the QR with phones (same Wi-Fi), or press
**Fill with bots** to play solo. Copy `.env.example` to `.env` for optional keys (Gemini, ElevenLabs, Tiger Data,
key-signing secret). Without them everything still works with offline fallbacks.

| URL | What |
|---|---|
| `/host/` | big screen (lobby, board, narrator, admin: press `` ` ``) |
| `/phone/` or `/j/ABCD` | player app |
| `/dev/minigame-sandbox/` | test any minigame / modifier / wager at any difficulty and speed |
| `/replay/` | cash-over-time replay of finished games |
| `/health` | health check |

**v2:** a reworked copy with the terminal, the new effects and redesigned minigames lives in [`v2/`](v2/README.md)
(`cd v2` then `./run.sh` or `.\run.cmd`, port 7071).

## Tests and tools
```sh
./run.sh test                    # 52 JUnit tests incl. a full 6-bot game over real WebSockets (~25s)
./run.sh lint                    # Java -Xlint, module contract lint, node --check on every client file
scripts/smoke/run.sh             # IF-04 smoke test: full game, bank never negative, one winner, event log written
scripts/bots/run.sh --count 6    # TL-01 bots: creates a room and plays it (or --room ABCD to join yours)
scripts/keys/gen.sh              # PH-01 signed key tags -> data/keys/keys.html (set HEIST_KEY_SECRET first)
scripts/gen-voice.sh             # AU-02 ElevenLabs narrator audio (needs ELEVENLABS_API_KEY)
scripts/db-migrate.sh            # DB-01 schema to $DATABASE_URL (the server also runs it on start)
node scripts/browser-check/minigames.mjs   # optional: fuzz all 36 minigames in headless Chromium
node scripts/browser-check/e2e.mjs URL     # optional: host + phone + bots full game in Chromium
```

## Layout
`/server` Java 21 + Javalin game server (authoritative engine) · `/shared` protocol + `balance.json` (every number) ·
`/client/{host,phone,minigames,modifiers,wagers,fx,replay,presage}` plain ES modules, no build step · `/content`
cards, narrator, flavor, fail lines, print sheets · `/scripts` tools · `/docs` spec, protocol, interfaces, deploy ·
`/dev` sandbox · `/deploy` Vultr/Caddy/systemd. Ownership per issue: [OWNERS.md](OWNERS.md).

Docs: [protocol](docs/protocol.md) · [minigame interface](docs/minigame-interface.md) · [balance](docs/balance.md) ·
[deploy](docs/deploy.md) · [network](docs/network.md) · [architecture](docs/architecture.md) ·
[sponsors](docs/sponsors.md) · [playtest](docs/playtest.md) · [demo script](docs/demo-script.md)
