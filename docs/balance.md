# Scoring and balance (DOC-04)

Every gameplay number lives in [`/shared/balance.json`](../shared/balance.json). The server reads it through
`heist.config.Balance` (a missing key is a startup error, never a silent default) and clients fetch the same file.
Tune here, nowhere else (QA-03).

| Knob | Value | Why |
|---|---|---|
| `bank.startPerPlayer` | 4,000 | The suggested $2,500 ran dry by round 3 in 8-bot simulations (bots at human pace), skipping the Rival round. $4,000 x players lasts to round 4 even with 8 aggressive bots (humans gamble less, so expect 5-6), so the shrinking bank still forces an urgent Escape. |
| `payout.byDifficulty` | 100 / 200 / 300 | Success payout by difficulty; difficulty climbs 1,1,2,2,3,3 by round. |
| `speed.perRound` | x1.12 | Round 6 runs at ~1.76x. Capped at `speed.max`. Stacks with the Turbo sabotage. |
| `steal.pctOfVictimWallet` / `minAmount` | 25% / $100 | Big enough to matter, capped at what the victim holds. |
| `freeze.violationPenalty` | $150 | Hurts more than a fail so people actually freeze. |
| `fail.walletPenalty` | $50 | Small: failing should be funny, not ruinous. Push-your-luck fails x3. |
| `rounds.count` / `playMs` | 6 / 50s | Inside the 6-8 rounds, 45-60s target. Full game ~8 minutes. |
| `bounty.bonus` | $150 | Out-earn your secret target. |
| `roundTypes.hack.payoutMult` | 1.25 | Compensates for no stealing in Hack rounds. |
| `wager.tiers` | x1/x2/x3.5 pay, x1/x2.5/x5 fine | Higher tiers are slightly negative EV for average players, positive for good ones. |
| `minigame.minSolveMs` | 600 | Results faster than this are rejected as impossible. |
| `bankRaid` | 35% of rounds, 5s, top 3 split $600 | A short, loud chaos beat. |
| `cards.*` | see file | Every card's effect key points here. |

Invariant enforced by the server and tests: `bankStart = bank + sum(wallets) + sum(stashes) + burned`.
Fines are burned, not returned to the bank, so the bank only shrinks.

Playtest tuning questions (QA-03): does the bank survive to round 5? Do steals feel frequent enough? Is
FREEZE ever violated by accident? Are tier-3 wagers chosen at all?
