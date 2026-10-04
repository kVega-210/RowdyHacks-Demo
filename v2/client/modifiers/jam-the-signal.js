// MG-41 Jam the Signal: static noise over the screen and twitching controls. Also used by Hacker vs. Hacker
// (MG-18) as the Scramble power. Controls only drift a few pixels, so everything stays tappable.
import { timed, styleOnce, controlsIn } from './_shared.js';

export const meta = { id: 'jam-the-signal', name: 'Jam the Signal', tags: ['sabotage'] };

styleOnce('jam', `
.mod-jam-noise{position:absolute;top:0;right:0;bottom:0;left:0;z-index:40;pointer-events:none;mix-blend-mode:screen;
  background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 2px,transparent 2px 4px);animation:modJam .12s steps(3) infinite}
@keyframes modJam{0%{transform:translateY(0)}50%{transform:translateY(-3px)}100%{transform:translateY(2px)}}
.mod-jam-text{position:absolute;top:8px;left:0;right:0;text-align:center;font:900 14px ui-monospace,monospace;color:#3dff9a;z-index:41;pointer-events:none}
.mod-jammed{filter:hue-rotate(90deg) contrast(1.2)}
`);

export function applyModifier(el, { duration = 5000, strength = 0.6 } = {}) {
  const s = Math.max(0, Math.min(1, strength));
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const noise = document.createElement('div');
  noise.className = 'mod-jam-noise';
  noise.style.opacity = String(0.4 + s * 0.6);
  const text = document.createElement('div');
  text.className = 'mod-jam-text';
  text.textContent = '▓▒░ SIGNAL JAMMED ░▒▓';
  el.append(noise, text);
  el.classList.add('mod-jammed');
  const moved = new Set();
  const twitch = () => {
    moved.forEach((b) => { b.style.translate = ''; });
    moved.clear();
    for (const b of controlsIn(el)) {
      if (Math.random() < 0.5) {
        b.style.translate = `${(Math.random() * 2 - 1) * 8 * s}px ${(Math.random() * 2 - 1) * 8 * s}px`;
        moved.add(b);
      }
    }
  };
  const iv = setInterval(twitch, 350);
  return timed(duration, () => {
    clearInterval(iv);
    moved.forEach((b) => { b.style.translate = ''; });
    noise.remove();
    text.remove();
    el.classList.remove('mod-jammed');
  });
}
