// CT-02 Tiny Buttons: every control shrinks (min 55% size) but stays tappable.
import { timed, styleOnce } from './_shared.js';

export const meta = { id: 'shrunken-buttons', name: 'Tiny Buttons', tags: ['sabotage'] };

styleOnce('shrink', '.mod-shrink button,.mod-shrink .hh-btn,.mod-shrink .hh-ctl{transform:scale(var(--mod-shrink,.7))!important;transition:transform .2s}');

export function applyModifier(el, { duration = 6000, strength = 0.5 } = {}) {
  el.style.setProperty('--mod-shrink', String(Math.max(0.55, 1 - Math.max(0, strength) * 0.45)));
  el.classList.add('mod-shrink');
  return timed(duration, () => { el.classList.remove('mod-shrink'); el.style.removeProperty('--mod-shrink'); });
}
