// MG-43 Lockout: disables one control at a time for a short spell, then moves the lock to another control.
// A single control is never locked for more than ~2.5s, so the minigame always stays winnable.
import { timed, styleOnce, controlsIn } from './_shared.js';

export const meta = { id: 'lockout', name: 'Lockout', tags: ['sabotage'] };

styleOnce('lockout', `.mod-locked{pointer-events:none!important;filter:grayscale(1) brightness(.6);position:relative}
.mod-locked::after{content:'🔒';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;background:#0008;border-radius:inherit}`);

export function applyModifier(el, { duration = 6000, strength = 0.5 } = {}) {
  let locked = null;
  const hold = 1200 + Math.max(0, Math.min(1, strength)) * 1300;
  const release = () => { if (locked) locked.classList.remove('mod-locked'); locked = null; };
  const relock = () => {
    release();
    const ctrls = controlsIn(el);
    if (ctrls.length < 2) return; // never lock the only control
    locked = ctrls[Math.floor(Math.random() * ctrls.length)];
    locked.classList.add('mod-locked');
  };
  relock();
  const iv = setInterval(relock, hold);
  return timed(duration, () => { clearInterval(iv); release(); });
}
