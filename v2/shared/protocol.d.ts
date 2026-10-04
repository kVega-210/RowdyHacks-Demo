// DOC-02 types for the WebSocket protocol. Runtime constants live in protocol.js; prose in /docs/protocol.md.

export type Phase = 'lobby' | 'briefing' | 'play' | 'results' | 'between' | 'escape' | 'end';
export type RoundTypeId = 'breakin' | 'hack' | 'rival';
export type ModifierId = 'shrunken-buttons' | 'screen-jitter' | 'false-alarm' | 'jam-the-signal';

export interface Settings { virtualKeys?: boolean; teams?: boolean; rounds?: number; games?: string[] | null; seed?: number; }
export interface ModifierSpec { id: ModifierId; durationMs: number; strength: number; }
export interface WagerPick { tier: '1' | '2' | '3'; }

export interface PublicPlayer {
  id: string; name: string; wallet: number; stash: number; on: 0 | 1;
  key: 'held' | 'stolen' | 'none'; vault: number; team?: string; esc?: 1; bot?: 1;
}
export interface Me { id: string; vaultName?: string; target?: { id: string; name: string }; shield?: 1; boost?: number; team?: string; }

// ---- client -> server
export type Intent =
  | { t: 'create_room'; settings?: Settings }
  | { t: 'host_resume'; room: string; hostToken: string }
  | { t: 'join'; room: string; name: string; bot?: boolean }
  | { t: 'resume'; room: string; token: string }
  | { t: 'leave' } | { t: 'ping' }
  | { t: 'start_game' } | { t: 'settings'; settings: Settings } | { t: 'fill_bots'; count?: number }
  | { t: 'admin'; action: 'force_steal' | 'force_freeze' | 'force_bankraid' | 'skip_round' | 'set_bank' | 'grant' | 'kick' | 'end_game'; amount?: number; playerId?: string }
  | { t: 'key_claim'; code: string }
  | { t: 'key_scan'; code?: string; victim?: string }
  | { t: 'minigame_result'; attemptId: string; success: boolean; scoreMultiplier?: number; reason?: string; wager?: WagerPick; nerves?: { calm: boolean } }
  | { t: 'freeze_violation' } | { t: 'bankraid_grab' } | { t: 'escape' } | { t: 'hack_scramble' }
  | { t: 'sabotage'; targetId: string; modifier: ModifierId }
  | { t: 'card_play'; number: number } | { t: 'card_vote'; voteId: string; pass: boolean } | { t: 'card_optout'; voteId: string };

// ---- server -> client
export type ErrorCode = 'bad_json' | 'rate_limited' | 'not_joined' | 'no_room' | 'bad_token' | 'room_full' | 'game_in_progress'
  | 'bad_name' | 'not_enough_players' | 'wrong_phase' | 'stale_attempt' | 'unknown_intent' | 'bad_key' | 'key_taken' | 'sabotage_used'
  | 'too_early' | 'bad_target' | 'bad_modifier' | 'card_limit' | 'bad_card' | 'bad_vote' | 'no_power' | 'no_player' | 'unknown_admin' | 'internal';

export interface Card { number: number; type: string; title: string; text: string; physical: boolean; }
export interface Standing { rank: number; id: string; name: string; stash: number; lost: number; escaped: boolean; successes: number; fails: number; steals: number; stolen: number; robbed: number; bounties: number; team?: string; }

export type ServerMessage =
  | { t: 'welcome'; role: 'host'; room: string; hostToken: string; settings: Settings }
  | { t: 'welcome'; role: 'phone'; room: string; playerId: string; name: string; token: string; vault?: number; vaultName?: string; keyCode?: string; virtualKeys: boolean; resumed?: boolean }
  | { t: 'error'; code: ErrorCode; message: string; ref?: string }
  | { t: 'pong'; now: number }
  | { t: 'state'; room: string; phase: Phase; round: number; rounds: number; roundType?: RoundTypeId; endsAt: number; now: number; bank?: number; bankStart?: number; speed: number; event?: { type: 'steal' | 'freeze' | 'bankraid'; endsAt: number }; players: PublicPlayer[]; me?: Me }
  | { t: 'phase_changed'; phase: Phase; round: number; rounds: number; roundType?: RoundTypeId; banner?: string; endsAt: number; now: number; resync?: boolean }
  | { t: 'round_start'; round: number; rounds: number; roundType: RoundTypeId; banner: string; speed: number; difficulty: 1 | 2 | 3; target?: { id: string; name: string }; modifiers: ModifierSpec[]; duel?: { opponentId: string; opponentName: string }; spectator: boolean; hacker: boolean; team?: string }
  | { t: 'minigame_assign'; attemptId: string; gameId: string; file: string; name: string; difficulty: 1 | 2 | 3; speed: number; seed: number; modifiers: ModifierSpec[]; duel?: true }
  | { t: 'minigame_ack'; attemptId: string; accepted: boolean; reason?: 'too_fast'; success?: boolean; delta?: number; wallet?: number }
  | { t: 'steal_open'; endsAt: number; now: number } | { t: 'steal_closed'; winnerId?: string }
  | { t: 'steal_result'; thiefId: string; thiefName: string; victimId: string; victimName: string; amount: number; blocked: boolean }
  | { t: 'steal_reject'; reason: 'no_window' | 'closed' | 'already_won' | 'own_key' | 'unknown_key' | 'key_already_stolen' }
  | { t: 'freeze_warning'; startsAt: number; now: number; ms: number }
  | { t: 'freeze_start'; endsAt: number; now: number; roundEndsAt?: number } | { t: 'freeze_end' } | { t: 'freeze_penalty'; amount: number; wallet: number }
  | { t: 'bankraid_open'; endsAt: number; now: number; winners: number; bonus?: number } | { t: 'bankraid_ack'; position: number }
  | { t: 'bankraid_result'; winners: { id: string; name: string; amount: number }[] }
  | { t: 'bank_warning'; pct: 75 | 50 | 25 | 0; bank: number }
  | { t: 'round_results'; round: number; table: { id: string; name: string; earned: number; wallet: number; stash: number; team?: string }[]; bank: number; bounty?: { targetId: string; targetName: string; mine: number; theirs: number; won: boolean; amount: number }; teamDelta?: number; bounties?: number; bountyWinners?: string[] }
  | { t: 'between'; nextRound: number; sabotage: boolean; modifiers: ModifierId[]; endsAt: number }
  | { t: 'sabotage_ack'; targetId: string; targetName: string; modifier: ModifierId }
  | { t: 'modifier_apply' } & ModifierSpec
  | { t: 'card_vote_open'; voteId: string; playerId: string; playerName: string; endsAt: number; card: Card }
  | { t: 'card_vote_result'; voteId: string; playerId: string; playerName: string; passed: boolean; optOut: boolean; delta: number; note: string; card: number }
  | { t: 'rival_start'; a: { id: string; name: string }; b: { id: string; name: string }; gameId: string; pot: number }
  | { t: 'rival_result'; winnerId: string; winnerName: string; loserId?: string; loserName?: string; amount: number; penalty: number }
  | { t: 'hvh_start'; hackerName: string; victimName: string } | { t: 'hvh_power'; victimId: string; victimName: string; uses: number; scrambleMs: number }
  | { t: 'hvh_ack'; usesLeft: number } | { t: 'hvh_bonus'; amount: number }
  | { t: 'teams_update'; teams: Record<string, string>; swapped: [string, string] }
  | { t: 'escape_open'; endsAt: number; bankEmpty?: boolean } | { t: 'escape_ack'; banked: number; stash: number }
  | { t: 'final_standings'; winnerId: string; winnerName: string; standings: Standing[]; teams?: Record<string, number>; winningTeam?: string; bank: number }
  | { t: 'roast'; roast: { source: 'gemini' | 'template'; players: { name: string; lines: string[] }[]; awards: { biggestThief?: string; chicken?: string; closestCall?: string } } }
  | { t: 'narrate'; key: string; vars: Record<string, string | number> }
  | { t: 'fx'; kind: 'success' | 'fail' | 'freeze_violation' | 'escape' | 'sabotage'; playerId?: string; name?: string; gameId?: string; amount?: number; reason?: string; modifier?: string }
  | { t: 'key_claimed'; vault: number; vaultName: string } | { t: 'kicked' } | { t: 'settings'; settings: Settings };
