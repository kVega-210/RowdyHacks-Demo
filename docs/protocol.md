# WebSocket protocol (DOC-02)

> **Human review required** before treating this as frozen.

One WebSocket at `/ws`. Every message is a JSON object with a `t` (type) field, at most 4KB. Typed in
[`/shared/protocol.d.ts`](../shared/protocol.d.ts); constants and the reconnecting client are in
[`/shared/protocol.js`](../shared/protocol.js).

**Rules.** The server is authoritative. Clients send **intents** only and never send timestamps that the server
trusts. Ordering for races (steals, bank raid, rival duels) is **server receive order** (each room handles intents
under one lock). Messages carrying `now` give the server clock so clients can show countdowns to `endsAt`.

## Handshake and reconnect
| Direction | Message | Payload |
|---|---|---|
| host -> | `create_room` | `{settings?: {virtualKeys, teams, rounds, games[], seed}}` |
| host -> | `host_resume` | `{room, hostToken}` (refresh-safe host screen) |
| phone -> | `join` | `{room, name, bot?}` (lobby only, max 8) |
| phone -> | `resume` | `{room, token}`: resumes the same player in any phase |
| -> both | `welcome` | host: `{role:'host', room, hostToken, settings}`; phone: `{role:'phone', room, playerId, name, token, vault, vaultName, keyCode?, virtualKeys, resumed?}` |
| any -> | `ping` | `{}` every 10s; server replies `pong {now}`. No traffic for 25s => server closes; clients reconnect with backoff and send `resume`. |

After `welcome` the server immediately re-sends the current `phase_changed` (with `resync:true`), `state`, and
whatever is live: the current `minigame_assign`, open steal/freeze/raid windows, open card votes, `escape_open`,
`final_standings`. A dropped phone therefore lands back exactly where it was with wallet and stash intact.

## Server -> clients
| Message | To | Payload |
|---|---|---|
| `state` | all (throttled to 8Hz) | `{room, phase, round, rounds, roundType, endsAt, now, bank, bankStart, speed, event:{type,endsAt}?, players:[{id,name,wallet,stash,on,key:'held'|'stolen'|'none',vault,team?,esc?,bot?}], me?:{id,vaultName,target?,shield?,boost?,team?}}` (`me` is phones only) |
| `phase_changed` | all | `{phase:'lobby'|'briefing'|'play'|'results'|'between'|'escape'|'end', round, rounds, roundType, banner, endsAt, now}` |
| `round_start` | each phone | `{round, rounds, roundType, banner, speed, difficulty, target:{id,name}, modifiers:[{id,durationMs,strength}], duel?:{opponentId,opponentName}, spectator, hacker, team?}` |
| `minigame_assign` | phone | `{attemptId, gameId, file, name, difficulty, speed, seed, wrapper?, modifiers:[...], duel?}` |
| `minigame_ack` | phone | `{attemptId, accepted, reason?:'too_fast', success, delta, wallet}` |
| `steal_open` / `steal_closed` | all | `{endsAt, now}` / `{winnerId?}` |
| `steal_result` | all | `{thiefId, thiefName, victimId, victimName, amount, blocked}` |
| `steal_reject` | scanner | `{reason:'no_window'|'closed'|'already_won'|'own_key'|'unknown_key'|'key_already_stolen'}` |
| `freeze_start` / `freeze_end` | all | `{endsAt, now}` / `{}` |
| `freeze_penalty` | phone | `{amount, wallet}` |
| `bankraid_open` / `bankraid_ack` / `bankraid_result` | all / phone / all | `{endsAt, winners, bonus}` / `{position}` (-1 = missed) / `{winners:[{id,name,amount}]}` |
| `bank_warning` | all | `{pct: 75|50|25|0, bank}` |
| `round_results` | phone / host | `{round, table:[{id,name,earned,wallet,stash,team}], bank, bounty:{targetId,targetName,mine,theirs,won,amount}, teamDelta?}` (hosts get `bounties`, `bountyWinners` instead of `bounty`) |
| `between` | all | `{nextRound, sabotage:boolean, modifiers:[ids], endsAt}` |
| `sabotage_ack` | phone | `{targetId, targetName, modifier}` |
| `modifier_apply` | victim | `{id, durationMs, strength}` (Hacker vs Hacker scramble, applied live) |
| `card_vote_open` / `card_vote_result` | all | `{voteId, playerId, playerName, endsAt, card:{number,type,title,text,physical}}` / `{voteId, playerId, passed, optOut, delta, note, card}` |
| `rival_start` / `rival_result` | all | `{a:{id,name}, b:{id,name}, gameId, pot}` / `{winnerId, winnerName, loserId, loserName, amount, penalty}` |
| `hvh_start` / `hvh_power` / `hvh_ack` / `hvh_bonus` | all / hacker | `{hackerName, victimName}` / `{victimId, victimName, uses, scrambleMs}` / `{usesLeft}` / `{amount}` |
| `teams_update` | all | `{teams:{playerId:team}, swapped:[a,b]}` |
| `escape_open` / `escape_ack` | all / phone | `{endsAt, bankEmpty}` / `{banked, stash}` |
| `final_standings` | all | `{winnerId, winnerName, standings:[{rank,id,name,stash,lost,escaped,successes,fails,steals,stolen,robbed,bounties,team}], teams?, winningTeam?, bank}` |
| `roast` | all | `{roast:{source, players:[{name, lines[]}], awards:{biggestThief, chicken, closestCall}}}` |
| `narrate` / `fx` | hosts | `{key, vars}` / `{kind:'success'|'fail'|'freeze_violation'|'escape'|'sabotage', playerId?, name?, gameId?, amount?}` |
| `key_claimed` / `kicked` | phone | `{vault, vaultName}` / `{}` |
| `settings` | hosts | `{settings}` |

## Client -> server intents
| Message | From | Payload | Valid in |
|---|---|---|---|
| `start_game` | host | `{}` | lobby, >= 2 players |
| `settings` | host | `{settings}` | lobby |
| `fill_bots` | host | `{count}` | lobby (offline demo mode) |
| `admin` | host | `{action:'force_steal'|'force_freeze'|'force_bankraid'|'skip_round'|'set_bank'|'grant'|'kick'|'end_game', amount?, playerId?}` | any |
| `key_claim` | phone | `{code}` (signed key code from the QR or typed) | lobby |
| `key_scan` | phone | `{code}` or `{victim}` (victim only with virtual keys or for bots) | steal window |
| `minigame_result` | phone | `{attemptId, success, scoreMultiplier?, reason?, wager?:{tier, wrapper?}, nerves?:{calm}}` | play, once per attempt, >= `minSolveMs` after assign |
| `freeze_violation` | phone | `{}` | freeze window (+ grace) |
| `bankraid_grab` | phone | `{}` | raid window |
| `escape` | phone | `{}` | escape window |
| `sabotage` | phone | `{targetId, modifier}` | between, once per round, from round 2 |
| `hack_scramble` | hacker | `{}` | play, Hacker vs Hacker round |
| `card_play` / `card_vote` / `card_optout` | phone | `{number}` / `{voteId, pass}` / `{voteId}` | between |
| `leave` | phone | `{}` | lobby |

## Errors
`{t:'error', code, message, ref}` where `ref` is the rejected intent. Codes: `bad_json`, `rate_limited`,
`not_joined`, `no_room`, `bad_token`, `room_full`, `game_in_progress`, `bad_name`, `not_enough_players`,
`wrong_phase`, `stale_attempt`, `unknown_intent`, `bad_key`, `key_taken`, `sabotage_used`, `too_early`,
`bad_target`, `bad_modifier`, `card_limit`, `bad_card`, `bad_vote`, `no_power`, `no_player`, `unknown_admin`,
`internal`. Rate limits: 20 intents/s and 8 scans/s per connection.
