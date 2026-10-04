// CT-02 Mirror Mode: the whole minigame is mirrored left-to-right. Taps still land on what you see, so it is
// confusing but never unwinnable.
import { timed, styleOnce } from './_shared.js';

export const meta = { id: 'inverted-controls', name: 'Mirror Mode', tags: ['sabotage'] };

styleOnce('inverted', '.mod-inverted{transform:scaleX(-1)!important}');

export function applyModifier(el, { duration = 6000 } = {}) {
  el.classList.add('mod-inverted');
  return timed(duration, () => el.classList.remove('mod-inverted'));
}
