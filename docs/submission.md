# Devpost submission draft (DEMO-02)

> Draft for the team to edit; add screenshots and links before submitting.

## Inspiration
Jackbox meets a heist movie, with a physical twist: the thing you protect is a real key on the table.

## What it does
2-8 players join on their phones; a big screen runs the heist. Timed rounds of minigames pull cash from a shrinking
bank into your at-risk wallet. Steal windows make you grab and scan rivals' keys, Freeze makes everyone stop
touching their phones, bank raids, sabotage, wagers, cards and a final Escape decide who stashes the most.

## How we built it
Java 21 + Javalin WebSocket server (authoritative game engine with an injected clock and seeded RNG), plain
HTML/ES-module clients with no build step, 36 auto-discovered minigames on a shared kit, Jackson, ZXing QR codes,
HMAC-signed key IDs, JUnit tests including a full-game bot smoke test.

## Architecture
```
phones (ES modules) ──ws──┐                     ┌── Tiger Data hypertable (events)
host screen ─────────ws───┤  Javalin server ────┤── Gemini (dares, roast)
bots / smoke test ───ws───┘  GameEngine/room    └── ElevenLabs (narrator, named lines)
                               (Vultr VM, Caddy TLS, GoDaddy domain)
```

## Sponsor integrations
- **ElevenLabs**: the Mastermind narrator (65 pre-generated lines + live personalised lines).
- **Gemini**: post-game roast per player + awards, dare variants.
- **Tiger Data**: every game event in a hypertable; replay page and stats queries.
- **Vultr / GoDaddy Registry**: hosting and domain.
- **Presage**: optional heart-rate "Nerves of Steel" bonus (feature-flagged).

## Challenges, accomplishments, what's next
_Fill in after the event._

## Links
Repo: https://github.com/kVega-210/RowdyHacks-Demo · Live: _domain_ · Video: _link_
