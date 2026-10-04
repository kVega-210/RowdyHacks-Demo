# HEIST HAVOC! Game Spec (DOC-01)

A party heist for 2-8 players around one table: one big **host screen** (laptop/TV), everyone's **phone**,
real **keys** on lanyards with QR tags, and a deck of **cards**. All numbers live in
[`/shared/balance.json`](../shared/balance.json) (DOC-04); this document only describes rules.

## Setup (5 minutes)
1. Start the server (`./run.sh`) and open `/host/` on the big screen. It shows a 4-letter **room code** and a QR.
2. Each player scans the QR (or opens `/phone/` and types the code) and picks a name.
3. **Physical keys** (optional, host toggle): each player takes a key from the table and scans its tag to claim a
   vault. With **virtual keys** (default) vaults are assigned automatically and steals happen on screen.
4. Shuffle the card deck face-down in the middle. Host presses **START THE HEIST**.

## Core loop
```
join -> claim a vault (scan key) -> [ briefing -> PLAY -> results -> break ] x 6 -> ESCAPE -> winner
```
- **Briefing**: the round type is announced and each phone privately shows your **secret target**.
- **Play** (about 50s): your phone serves minigames back to back. Win = cash from the central **bank** into your
  **wallet**; fail = a small fine from your wallet. Every round is faster than the last (**speed ramp**) and the
  minigames get harder.
- During play the server fires timed **events**:
  - **STEAL!**: grab another player's key and scan it. The first valid scan (by server receive time) wins a cut of
    that player's wallet. Your own key never counts, one steal per window, and a stolen key comes back at round end.
  - **FREEZE!**: hands off. Touching your phone during the window costs a fine (honor system).
  - **BANK RAID!**: the first few players to smash GRAB split a bonus.
- **Results**: everyone's haul is shown. If you out-earned your secret target, you collect a **bounty**.
- **Break**: draw a card if you dare (see Cards), and from round 2 pick one **sabotage** against a rival.

## Money: wallet vs stash vs bank
- The **bank** starts with a fixed amount per player and only ever shrinks. When it hits $0 the game skips straight
  to the Escape.
- **Wallet** cash is at risk: it can be stolen, fined, and is **lost** if you fail to escape.
- **Stash** is safe. The only way in is the **Escape** (and it is what wins).

## Round types
| Type | Stealing | Payouts | Notes |
|---|---|---|---|
| Break-in | Steal windows on | normal | classic-themed minigames |
| Hack | no stealing | bigger | cyber-themed minigames |
| Rival Heist | no | pot | two random players race the same seeded minigame; first to crack it takes most of the pot, the loser pays a fine; everyone else watches the big screen |

One round is also **Hacker vs. Hacker**: a random player gets a SCRAMBLE button that jams one rival's screen and
earns a bonus each time that rival fails while jammed.

## Sabotage (between rounds)
Pick a victim and a dirty trick (Turbo, Mirror Mode, Tiny Buttons, Earthquake, False Alarm, Lockout, Jam the
Signal). It hits their first minigames next round. Tricks are always beatable; they only make things harder.

## Wagers and risk
Some minigames ask you to choose a tier first (harder = bigger payout and bigger fine), some are push-your-luck
(cash out before the alarm), and sometimes any minigame is wrapped in a wager (Small Vault/Big Vault, Clean
Getaway, The Double Safe).

## Cards
During a break, draw the top card and type its number into your phone. Everyone sees it; do the dare; the other
phones vote PASS/FAIL for 10 seconds and the majority decides the cash effect. Card types: dare, workout,
double-or-nothing, shield (blocks the next steal on you) and steal-boost (your next steal takes more). Every physical
card has a free opt-out for anyone with physical limits; other cards can be skipped for a small fee.

## Escape and winning
After the final round (or when the bank runs dry) the alarm rings: tap **ESCAPE** within the window to move your
wallet into your stash. Unbanked wallet cash is lost. **Highest stash wins.** Ties break on fewer fails, then more
successes, then who escaped first, then who joined first, so there is always exactly one winner. The Mastermind
then roasts everyone.

## Running a table session (cheat sheet for a stranger)
1. Host screen up, sound on (click once), lobby visible. 2. Everyone joins; toggle physical keys if you printed tags.
3. Too few people? **Fill with bots**. 4. Start. Read the briefing banner aloud the first time. 5. During STEAL, people
reach for keys; during FREEZE, everyone freezes. 6. In breaks, push the card deck around the table.
7. At the alarm, yell "ESCAPE!". 8. Read the roast out loud.
