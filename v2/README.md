# HEIST HAVOC! v2

A separate, self-contained copy of the game with the v2 changes. v1 (the repo root) is untouched, and both can run
at the same time: v1 uses port 7070 and v2 uses port **7071**.

## Run it
Requires Java 21.
```sh
cd v2
./run.sh            # macOS/Linux
.\run.cmd           # Windows
```
Open **http://localhost:7071/host/** on the big screen and **http://localhost:7071/phone/** (or scan the QR) on phones.
Press **Fill with bots** to play solo. The minigame sandbox is at `/dev/minigame-sandbox/`.

```sh
./run.sh test                                   # JUnit tests (54)
node scripts/browser-check/minigames.mjs        # fuzz every minigame in headless Chromium (server on 7071)
HEIST_TIME_SCALE=4 PORT=7172 ./run.sh           # sped-up server, then:
node scripts/browser-check/e2e.mjs http://localhost:7172   # host + phone + bots full game
```

## What changed from v1
**Everywhere**
- Fallout-style green terminal on the bottom ~22% of every screen. Phones log your own events; the host logs everyone's.
  At the end of the game it becomes scrollable (ARCHIVE).
- Shared effects in `client/fx/effects.js`: 💲 dollar pop, green/red answer reveal, and matrix rain.
- The background shifts from black/blue to bright red as the round clock runs down (`--heat`).
- Quick fade through black between screens (`client/fx/screen.js`).
- Removed the wager wrappers (Clean Getaway, Small Vault/Big Vault, The Double Safe) and the Mirror Mode, Lockout and
  Turbo modifiers. Earthquake (screen jitter) is gentler.
- Freeze: at most one per round (35% chance). A 🚨 rises from behind the terminal for 3s as a warning, and the Freeze
  pauses the minigame and the round timer for everyone.
- Fail gags trimmed to jail bars, flashing sirens and the net.

**Minigames 1-12:** Alarm Jackpot, Backdoor, Black Market Deal, CAPTCHA Criminal, Code Injection, Data Heist, Digital
Lockpick, Digital Wiretap, Disguise Check, Encryption Breaker, Evidence Cleanup, Firewall Breach. These got new labels,
bigger text, tile choices (doors and briefcases), answer reveals on fail, and matrix rain or dollar pops on success.

Every tunable number is still in `shared/balance.json` (see `events`, `freeze` and `sabotage.modifiers`).
