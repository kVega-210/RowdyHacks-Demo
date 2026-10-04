# Architecture

- **Server** (`/server`, Maven): `heist.HeistServer` wires Javalin (static files + REST + `/ws`). `RoomManager` creates
  4-letter rooms and ticks them every 20ms. Each `Room` owns a `GameEngine` and serialises all calls under its lock,
  which is what makes "first by server receive order" well defined. The engine is pure game logic driven by
  `tick(now)` with an injected `Clock` and a seeded `Rng`, so tests use a manual clock and the smoke test a sped-up one.
  Rules live in small pure classes (`Economy`, `Speed`, `RoundMachine`, `EventScheduler`, `StealArbiter`, `Targets`,
  `Endgame`, `RoundTypes`, `Sabotage`, `Wager`, `Cards`, `Teams`, `BankRaid`, `RivalHeist`, `HackerVsHacker`).
- **Event log**: `EventWriter` (bounded queue, batched daemon writer) -> `JdbcSink` (Tiger Data) or `JsonlSink`.
- **Clients** (`/client`): ES modules served as-is. `/shared/protocol.js` holds the reconnecting socket. Minigames,
  modifiers and wager wrappers are discovered from their folders (`/api/minigames` etc).
- **Config**: `/shared/balance.json` for every number; `/content/*.json` for text.

See OWNERS.md for the file-by-issue map.
