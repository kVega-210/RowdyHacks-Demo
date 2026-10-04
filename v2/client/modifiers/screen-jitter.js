// CT-02 Earthquake (v2: gentler): the minigame drifts a couple of pixels, a few times a second.
import { timed } from './_shared.js';

export const meta = { id: 'screen-jitter', name: 'Earthquake', tags: ['sabotage'] };

export function applyModifier(el, { duration = 6000, strength = 0.5 } = {}) {
  const amp = 1 + Math.max(0, Math.min(1, strength)) * 2.5;
  const prev = el.style.translate;
  const prevTr = el.style.transition;
  el.style.transition = 'translate 120ms ease-in-out';
  const shake = () => { el.style.translate = `${(Math.random() * 2 - 1) * amp}px ${(Math.random() * 2 - 1) * amp}px`; };
  shake();
  const iv = setInterval(shake, 140);
  return timed(duration, () => { clearInterval(iv); el.style.translate = prev || ''; el.style.transition = prevTr || ''; });
}
