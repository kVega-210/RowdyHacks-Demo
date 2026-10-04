// CT-02 Earthquake: the minigame shakes a few pixels every frame.
import { timed } from './_shared.js';

export const meta = { id: 'screen-jitter', name: 'Earthquake', tags: ['sabotage'] };

export function applyModifier(el, { duration = 6000, strength = 0.5 } = {}) {
  const amp = 2 + Math.max(0, Math.min(1, strength)) * 8;
  const prev = el.style.translate;
  let raf = requestAnimationFrame(function shake() {
    el.style.translate = `${(Math.random() * 2 - 1) * amp}px ${(Math.random() * 2 - 1) * amp}px`;
    raf = requestAnimationFrame(shake);
  });
  return timed(duration, () => { cancelAnimationFrame(raf); el.style.translate = prev || ''; });
}
