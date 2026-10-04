# HEIST HAVOC! v3

v3 = v2 plus **round themes and stylised type**. It is a separate, self-contained copy: v1 (repo root, port 7070),
v2 (`v2/`, port 7071) and v3 (`v3/`, port **7072**) can all run at the same time.

## What's new in v3
- **The theme follows the round type.** Break-in and Rival rounds are **classic**: black and red with yellow
  highlights, an amber terminal and a stencil font (Black Ops One). Hack rounds are **cyber**: terminal/Matrix green
  with Orbitron. The swap happens under the fade-to-black at each briefing, on the host and every phone.
- The background still heats up as the round clock runs out: dark red to alarm red in classic, dark green to
  radioactive green in cyber.
- **Stylised text:** display font for titles, buttons, the HUD, scoreboard and every minigame action word (HACK!,
  ESCAPE!, ...), Rajdhani for body text and VT323 for the terminal. Fonts are bundled in `client/assets/fonts`
  (SIL Open Font License), so it works offline.
- Everything reads its colours from `client/fx/theme.css`; add a theme by adding one more block there and mapping a
  round type to it in `client/fx/theme.js`. The minigame sandbox has a Theme picker to preview any game in either theme.

## Run it
Requires Java 21.
```sh
cd v3
./run.sh            # macOS/Linux
.\run.cmd           # Windows
```
Open **http://localhost:7072/host/** on the big screen and **http://localhost:7072/phone/** (or scan the QR) on phones.
Press **Fill with bots** to play solo. The minigame sandbox is at `/dev/minigame-sandbox/`.

```sh
./run.sh test                                   # JUnit tests (50)
node scripts/browser-check/minigames.mjs        # fuzz every minigame in headless Chromium (server on 7072)
HEIST_TIME_SCALE=4 PORT=7173 ./run.sh           # sped-up server, then:
node scripts/browser-check/e2e.mjs http://localhost:7173   # host + phone + bots full game
```

## Phones can't load the game?
- **Blank or error screen on the phone:** open the link in the phone's normal browser (Chrome on Android, Safari on
  iPhone), not inside a QR-scanner or social app. The game now shows a readable error instead of a blank page; send us
  the red "Details" text if you see it. It needs roughly iOS 13+ / Android Chrome 80+.
- **The page never loads at all (times out):** the phone can't reach the laptop.
  - Phone and laptop must be on the **same Wi-Fi** (not a guest network with "client isolation", not mobile data).
  - On Windows, allow Java through the firewall for **Private** networks when asked (or in *Windows Defender Firewall ->
    Allow an app*), and set the Wi-Fi network profile to *Private*.
  - The server prints the address it put in the QR code, plus alternatives if the laptop has several network adapters.
    If the QR address doesn't work, try the others and put the working one in `v3/.env` as
    `PUBLIC_URL=http://192.168.x.x:7072`.

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

### Second batch (minigames 13-26 and more)
**Economy and flow**
- The game ends only when the bank is empty. Each round's payouts are scaled so the bank is paid out over the host's chosen
  number of rounds: `bank / rounds left`, divided by what the crew actually earned last round. Penalties go back into the
  bank. If cash is left after the last round, **overtime** rounds pay out harder until it is empty (safety cap: 6).
- No escape phase: every wallet is banked automatically at the end.
- Stealing is gone, along with everything that only existed for it: the Steal screen, keys and key scanning, the HUD key and
  stash cells, and the Shield and Steal Boost cards.
- Freeze is a little more frequent (50% of rounds, still at most one).

**Targeting**
- Every player gets a random animal face (unique in the room). The sabotage picker shows the faces in a compact grid next
  to the tricks, so nothing scrolls.
- Each sabotage or scramble hits exactly one minigame, never two of the same player's minigames in a row, and a player
  hit last round can't be picked in the next break (shown with 🛡️).

**Screens**
- The host scales every view to the space above the terminal, so nothing is hidden behind it.
- False Alarm flashes its fake alerts in random languages.

**Minigames:** Alarm Jackpot, Backdoor, Black Market Deal, Data Heist, Digital Wiretap, Encryption Breaker, Firewall
Breach, Firewall Freeze, Getaway Driver, Guard Patrol, Laser Grid, Laser Timing, Last Second Grab, Lockpick, Malware
Cleanup, Museum Heist, Packet Sniffer, Password Cracker, Password Roulette, Rooftop Escape and Safecracker all got
the requested changes.

### Third batch
- Removed the Bank Raid pop-up (the big gold GRAB button) and the whole card deck (draw a card, crew vote, the dares API
  and the printable cards sheet). The only mid-round event left is the Freeze.
- Removed the Train Heist and Ventilation Shaft minigames (34 left).
- Safecracker, Security Badge, Security Camera Loop, Security Override, Server Overload, Silent Alarm, The Inside Man,
  Trace the IP and Vault Weight got the requested changes.

Every tunable number is still in `shared/balance.json` (see `economy`, `events`, `freeze` and `sabotage`).
