// CT-02 Turbo: the minigame's clock runs faster. Stacks multiplicatively with the round speed via the kit's
// data-hh-timescale hook, capped so the game stays winnable.
import { timed } from './_shared.js';

export const meta = { id: 'speed-up', name: 'Turbo', tags: ['sabotage'] };

export function applyModifier(el, { duration = 6000, strength = 0.5 } = {}) {
  const prev = el.dataset.hhTimescale;
  el.dataset.hhTimescale = String(1 + Math.min(0.6, Math.max(0, strength) * 0.6));
  return timed(duration, () => {
    if (prev == null) delete el.dataset.hhTimescale; else el.dataset.hhTimescale = prev;
  });
}
