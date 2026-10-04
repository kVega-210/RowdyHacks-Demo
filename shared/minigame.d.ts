// DOC-03 minigame, wager and sabotage-modifier contracts. Prose: /docs/minigame-interface.md

export interface MinigameMeta {
  /** Unique, equal to the file name without .js */
  id: string;
  name: string;
  /** Must include 'cyber' or 'classic'; may add 'choice' (pick a tier first) or 'push-luck' (cash out with scoreMultiplier) */
  tags: string[];
  /** Typical duration at speed 1 (<= 12000 for a normal game) */
  baseDurationMs: number;
}

export interface SuccessResult { scoreMultiplier?: number; wager?: { tier: '1' | '2' | '3'; wrapper?: string } }
export interface FailResult { reason: string; wager?: { tier: '1' | '2' | '3'; wrapper?: string } }

export interface MountOptions {
  difficulty: 1 | 2 | 3;
  /** >= 1. Scales every timer and motion. Sabotage Turbo stacks via data-hh-timescale. */
  speed: number;
  /** Deterministic seed: same seed => same puzzle (Rival Heist depends on this). */
  seed: number;
  /** Call exactly one of these, exactly once. */
  onSuccess(result?: SuccessResult): void;
  onFail(result: FailResult): void;
  /** balance.json wager.tiers, for choice games to display multipliers. */
  tiers?: Record<string, { payoutMult: number; failPenaltyMult: number }>;
}

export interface MinigameHandle { destroy(): void; }

/** Shape of every file in /client/minigames/*.js (files starting with "_" are ignored). */
export interface MinigameModule {
  meta: MinigameMeta;
  mount(container: HTMLElement, opts: MountOptions): MinigameHandle;
}

/** /client/modifiers/*.js */
export interface ModifierModule {
  meta: { id: string; name: string; tags: string[] };
  /** Must be cleanly removable and must never make a minigame unwinnable. Auto-expires after duration. */
  applyModifier(el: HTMLElement, opts: { duration: number; strength: number }): () => void;
}

/** /client/wagers/*.js wrappers (not minigames): pick safe/risky, then mount any minigame with tweaked params. */
export interface WagerWrapperModule {
  meta: { id: string; name: string; tags: string[] };
  mount(container: HTMLElement, opts: MountOptions & {
    game: MinigameModule;
    config: Record<string, { difficultyDelta: number; speedMult: number; locks?: number }>;
    content: { id: string; name: string; prompt: string; options: { tier: string; label: string; blurb: string; risk: string }[] };
  }): MinigameHandle;
}
