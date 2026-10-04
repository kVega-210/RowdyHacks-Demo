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
node scripts/browser-check/fit.mjs               # every minigame fits above the terminal on 320x480 .. 412x780 phones
HEIST_TIME_SCALE=4 PORT=7173 ./run.sh           # sped-up server, then:
node scripts/browser-check/e2e.mjs http://localhost:7173   # host + phone + bots full game
node scripts/browser-check/rematch.mjs http://localhost:7173   # end a game, press New heist, same crew in the new lobby
```

## New heist (same crew)
On the final screen, **▶ New heist (same crew)** opens a new room with the same settings and moves everyone over: the
host screen, every connected phone and the bots, keeping their names and faces. Phones jump straight to the new lobby;
the host just presses Start. A phone that dropped in the last minute (locked screen, Wi-Fi blip) follows when it
reconnects. Anyone gone longer can join the new room with its QR code as usual.

## Rival duels (v3)
- **Rival rounds** (round 5 by default) happen only with an **even** crew: everyone is paired at random and duels their
  rival back to back for the whole round. Odd crews get a normal break-in instead, so nobody sits idle.
- **Rival events** are a random mid-round event (40% of rounds from round 2, even crews only): jobs pause, everyone is
  re-paired at random and every pair plays one duel at the same time, then jobs resume and the round gets its time back.
- **Four live duel games** (`client/rival/`), refereed by the server (`server/.../game/Duel.java`):
  **Tug of War** (mash PULL!), **Type Race** (same password, keypad, wrong key knocks you back), **Memory Duel**
  (Simon sequence grows each level, first slip loses) and **Quick Draw** (tap after DRAW!, early = foul).
  Every duel shows your opponent's face and name; the host shows every pair live.
- Winner gets `payout.byDifficulty x rival.potMult x the round's payout scale`; the loser pays `rival.loserPenalty`
  back to the bank. All timings are under `rival` / `rivalEvent` in `shared/balance.json`.

## Up to 30 players
- `players.max` is 30. Bigger crews get a bigger vault **and** more cash per job: bank =
  `startPerPlayer x players^crewExponent` (1.1), and each round pays roughly bank / rounds left spread over the crew.
  The host lobby shows the vault and the ≈ pay per job as people join.
- The host scoreboard and result tables split into columns of 10, the duel board compacts, the phone sabotage picker
  switches to a full-width face grid, and there are 36 animal faces. "🤖 +6 bots" keeps adding bots to try big crews.

## Phones can't load the game?
- **Brave:** with Shields' "Upgrade connections to HTTPS" on Strict, Brave shows a warning for the game's plain
  `http://` LAN address. Tap **Continue**, or turn Shields off for that address.
- **The host terminal tells you why a phone failed:** any phone that can't start the game reports its browser and the
  error, shown as "PHONE COULD NOT START (Brave 79 / Android 9): ..." on the big screen and in the server window.
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
