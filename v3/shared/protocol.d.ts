// DOC-02 types for the WebSocket protocol. Runtime constants live in protocol.js; prose in /docs/protocol.md.

export type Phase = 'lobby' | 'briefing' | 'play' | 'results' | 'between' | 'end'; // v2: no escape phase
export type RoundTypeId = 'breakin' | 'hack' | 'rival';
export type DuelKind = 'tug-of-war' | 'type-race' | 'memory-duel' | 'quick-draw';
export interface Face { id: string; name: string; face: string }
export type ModifierId = 'shrunken-buttons' | 'screen-jitter' | 'false-alarm' | 'jam-the-signal';

export interface Settings { teams?: boolean; rounds?: number; games?: string[] | null; seed?: number; }
export interface ModifierSpec { id: ModifierId; durationMs: number; strength: number; }
export interface WagerPick { tier: '1' | '2' | '3'; }

export interface PublicPlayer {
  id: string; name: string; wallet: number; stash: number; on: 0 | 1;
  face: string; team?: string; bot?: 1;
}
export interface Me { id: string; face: string; target?: { id: string; name: string; face: string }; team?: string; }

// ---- client -> server
export type Intent =
  | { t: 'create_room'; settings?: Settings }
  | { t: 'host_resume'; room: string; hostToken: string }
  | { t: 'join'; room: string; name: string; bot?: boolean }
  | { t: 'resume'; room: string; token: string }
  | { t: 'leave' } | { t: 'ping' }
  | { t: 'start_game' } | { t: 'settings'; settings: Settings } | { t: 'fill_bots'; count?: number }
  | { t: 'admin'; action: 'force_freeze' | 'force_rival' | 'skip_round' | 'set_bank' | 'grant' | 'kick' | 'end_game'; amount?: number; playerId?: string }
  | { t: 'minigame_result'; attemptId: string; success: boolean; scoreMultiplier?: number; reason?: string; wager?: WagerPick; nerves?: { calm: boolean } }
  | { t: 'freeze_violation' } | { t: 'hack_scramble' }
  | { t: 'sabotage'; targetId: string; modifier: ModifierId }
  | { t: 'duel_input'; duelId: string; taps?: number; progress?: number; done?: string; level?: number; keys?: number[]; tap?: boolean };

// ---- server -> client
export type ErrorCode = 'bad_json' | 'rate_limited' | 'not_joined' | 'no_room' | 'bad_token' | 'room_full' | 'game_in_progress'
  | 'bad_name' | 'not_enough_players' | 'wrong_phase' | 'stale_attempt' | 'unknown_intent' | 'sabotage_used' | 'target_cooldown' | 'victim_cooldown'
  | 'too_early' | 'bad_target' | 'bad_modifier' | 'no_power' | 'no_player' | 'unknown_admin' | 'internal';

export interface Standing { rank: number; id: string; name: string; face: string; stash: number; successes: number; fails: number; bounties: number; team?: string; }

export type ServerMessage =
  | { t: 'welcome'; role: 'host'; room: string; hostToken: string; settings: Settings }
  | { t: 'welcome'; role: 'phone'; room: string; playerId: string; name: string; token: string; face: string; resumed?: boolean }
  | { t: 'error'; code: ErrorCode; message: string; ref?: string }
  | { t: 'pong'; now: number }
  | { t: 'state'; room: string; phase: Phase; round: number; rounds: number; overtime: number; roundType?: RoundTypeId; endsAt: number; now: number; bank?: number; bankStart?: number; speed: number; event?: { type: 'freeze'; endsAt: number }; players: PublicPlayer[]; me?: Me }
  | { t: 'phase_changed'; phase: Phase; round: number; rounds: number; roundType?: RoundTypeId; banner?: string; endsAt: number; now: number; overtime: number; resync?: boolean }
  | { t: 'round_start'; round: number; rounds: number; roundType: RoundTypeId; banner: string; speed: number; difficulty: 1 | 2 | 3; target?: { id: string; name: string; face: string }; modifiers: ModifierSpec[]; duel?: { opponentId: string; opponentName: string }; spectator: boolean; hacker: boolean; team?: string; payoutScale: number; overtime: number }
  | { t: 'minigame_assign'; attemptId: string; gameId: string; file: string; name: string; difficulty: 1 | 2 | 3; speed: number; seed: number; modifiers: ModifierSpec[]; duel?: true }
  | { t: 'minigame_ack'; attemptId: string; accepted: boolean; reason?: 'too_fast'; success?: boolean; delta?: number; wallet?: number }
  | { t: 'freeze_warning'; startsAt: number; now: number; ms: number }
  | { t: 'freeze_start'; endsAt: number; now: number; roundEndsAt?: number } | { t: 'freeze_end' } | { t: 'freeze_penalty'; amount: number; wallet: number }
  | { t: 'bank_warning'; pct: 75 | 50 | 25 | 0; bank: number }
  | { t: 'round_results'; round: number; table: { id: string; name: string; earned: number; wallet: number; stash: number; team?: string }[]; bank: number; bounty?: { targetId: string; targetName: string; mine: number; theirs: number; won: boolean; amount: number }; teamDelta?: number; bounties?: number; bountyWinners?: string[] }
  | { t: 'between'; nextRound: number; overtime: number; sabotage: boolean; modifiers: ModifierId[]; immune: string[]; endsAt: number }
  | { t: 'sabotage_ack'; targetId: string; targetName: string; targetFace: string; modifier: ModifierId }
  | { t: 'modifier_apply' } & ModifierSpec
  // v3 live rival duels (rival rounds and rival events)
  | { t: 'duel_start'; duelId: string; kind: DuelKind; name: string; file: string; you: 'a' | 'b'; event: boolean; opponent: Face;
      record: { you: number; them: number }; pot: number; now: number; startsAt: number; endsAt: number; setup: Record<string, unknown> }
  | { t: 'duel_state'; duelId: string; rope?: number; a: { progress?: number; level?: number }; b: { progress?: number; level?: number }; bar: number }
  | { t: 'duel_end'; duelId: string; aborted?: boolean; kind?: DuelKind; winnerId?: string; winnerName?: string; loserId?: string; draw?: boolean;
      reason?: string; amount?: number; penalty?: number }
  | { t: 'rival_event_start'; endsAt: number; now: number; kind: DuelKind; name: string; roundEndsAt: number }
  | { t: 'rival_event_end'; roundEndsAt: number; now: number }
  | { t: 'rival_round'; pairs: { a: Face; b: Face }[]; event?: boolean }
  | { t: 'hvh_start'; hackerName: string; victimName: string } | { t: 'hvh_power'; victimId: string; victimName: string; victimFace: string; uses: number; scrambleMs: number }
  | { t: 'hvh_ack'; usesLeft: number } | { t: 'hvh_bonus'; amount: number }
  | { t: 'teams_update'; teams: Record<string, string>; swapped: [string, string] }
  | { t: 'final_standings'; winnerId: string; winnerName: string; standings: Standing[]; teams?: Record<string, number>; winningTeam?: string; bank: number }
  | { t: 'roast'; roast: { source: 'gemini' | 'template'; players: { name: string; lines: string[] }[]; awards: { biggestThief?: string; chicken?: string; closestCall?: string } } }
  | { t: 'narrate'; key: string; vars: Record<string, string | number> }
  | { t: 'fx'; kind: 'success' | 'fail' | 'freeze_violation' | 'sabotage'; playerId?: string; name?: string; gameId?: string; amount?: number; reason?: string; modifier?: string }
  | { t: 'kicked' } | { t: 'settings'; settings: Settings };
