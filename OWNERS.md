# Directory ownership map (OPS-01)

One owner label per path so parallel agents never edit the same files. If your issue's label is not on a path,
do not edit it; open a follow-up instead. Minigames, modifiers and wagers are auto-discovered, so **nobody edits a
shared index file** to add one.

| Path | Owner label | Issues |
|---|---|---|
| `/server/src/main/java/heist/rooms/*` | `backend` | BE-01 |
| `/server/src/main/java/heist/session/*` | `backend` | BE-02 |
| `/server/src/main/java/heist/game/RoundMachine.java`, `GameEngine.java`, `Phase.java` | `backend` | BE-03 |
| `/server/src/main/java/heist/game/Speed.java` | `backend` | BE-04 |
| `/server/src/main/java/heist/game/Economy.java` | `backend` | BE-05 |
| `/server/src/main/java/heist/game/EventScheduler.java` | `backend` | BE-06 |
| `/server/src/main/java/heist/game/StealArbiter.java` | `backend` | BE-07 |
| `/server/src/main/java/heist/game/Targets.java` | `backend` | BE-08 |
| `/server/src/main/java/heist/game/Endgame.java` | `backend` | BE-09 |
| `/server/src/main/java/heist/game/RoundTypes.java` | `backend` | BE-10 |
| `/server/src/main/java/heist/game/Sabotage.java` | `backend`, `sabotage` | BE-11 |
| `/server/src/main/java/heist/game/Wager.java` | `backend`, `risk-reward` | BE-12 |
| `/server/src/main/java/heist/game/BankRaid.java`, `/client/phone/overlays/bankraid.js` | `backend`, `client` | BE-13 |
| `/server/src/main/java/heist/game/Cards.java`, `/client/phone/cards/*` | `physical` | PH-04 |
| `/server/src/main/java/heist/game/Teams.java` | `backend` | TM-01 |
| `/server/src/main/java/heist/game/RivalHeist.java`, `/client/host/rival/*` | `sabotage` | MG-45 |
| `/server/src/main/java/heist/game/HackerVsHacker.java` | `sabotage` | MG-18 |
| `/server/src/main/java/heist/admin/*`, `/client/host/admin/*` | `tooling` | TL-02 |
| `/server/src/main/java/heist/net/*` | `infra` | IF-03 |
| `/server/src/main/java/heist/db/*`, `/server/db/*` | `data` | DB-01..04 |
| `/server/src/main/java/heist/api/Dares.java`, `Gemini.java` | `ai` | AI-01 |
| `/server/src/main/java/heist/api/Roast.java` | `ai` | AI-02 |
| `/server/src/main/java/heist/api/Tts.java`, `ElevenLabs.java` | `audio` | AU-04 |
| `/server/src/main/java/heist/keys/*` | `physical` | PH-01 |
| `/server/src/main/java/heist/tools/Bot*.java`, `HostClient.java`, `/scripts/bots/*` | `tooling` | TL-01 |
| `/server/src/main/java/heist/tools/Smoke.java`, `/scripts/smoke/*` | `tooling` | IF-04 |
| `/server/src/main/java/heist/tools/GenVoice.java`, `/scripts/gen-voice.sh` | `audio` | AU-02 |
| `/shared/protocol.*` | `docs` (human review) | DOC-02 |
| `/shared/minigame.d.ts` | `docs` | DOC-03 |
| `/shared/balance.json` | `docs`, `qa` | DOC-04, QA-03 |
| `/client/phone/join/*` | `client` | CL-01 |
| `/client/host/*` (except subfolders listed here) | `client` | CL-02 |
| `/client/phone/runner/*` | `client` | CL-03 |
| `/client/phone/hud/*` | `client` | CL-04 |
| `/client/phone/overlays/*`, `/client/host/overlays/*` | `client` | CL-05 |
| `/client/phone/scanner/*` | `client`, `physical` | CL-06 |
| `/client/phone/between/*` | `client` | CL-07 |
| `/client/phone/final/*`, `/client/host/final/*` | `client` | CL-08 |
| `/client/host/fx/*` | `client` | CL-09 |
| `/client/wagers/chooser.js` | `client`, `risk-reward` | CL-10 |
| `/client/phone/target/*` | `client` | MG-44 |
| `/client/host/audio/*` | `audio` | AU-03 |
| `/client/fx/*`, `/content/fail-lines.json` | `content` | CT-01 |
| `/client/modifiers/*`, `/content/modifiers.json` | `content`, `sabotage` | CT-02, MG-41..43 |
| `/client/minigames/<id>.js` (one file each) | `minigame` | MG-01..MG-40 |
| `/client/wagers/<id>.js`, `/content/wagers/<id>.json` | `risk-reward` | MG-35..37 |
| `/client/replay/*` | `data` | DB-03 |
| `/client/presage/*` | `sponsor` | PR-01, PR-02 |
| `/content/cards.json` | `content` | PH-03 |
| `/content/print/*` | `content` | PH-05 |
| `/content/flavor.json` | `content` | CT-03 |
| `/content/narrator.json` | `audio` | AU-01 |
| `/dev/*` | `minigame` | DEV-01 |
| `/scripts/keys/*` | `physical` | PH-01 |
| `/deploy/*`, `Dockerfile` | `infra` | IF-01 |
| `/docs/*` | `docs` | DOC-01..04, OPS-02, DEMO-* |
| `run.sh`, `run.cmd`, `OWNERS.md`, `.gitignore`, `.env.example` | `infra` | OPS-01 |
