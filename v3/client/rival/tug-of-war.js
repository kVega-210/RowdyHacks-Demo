// v3 rival duel: TUG OF WAR. Mash PULL! as fast as you can; the knot moves toward whoever is pulling harder.
// Drag it over your line (rival.games.tug-of-war.target taps ahead) to win; at the buzzer the leader wins.
import { css, h } from '../fx/kit.js';

export const meta = { id: 'tug-of-war', name: 'Tug of War' };

css('duel-tug', `
.tug{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;gap:6px}
.tug-face{text-align:center;font-size:30px;line-height:1}
.tug-field{position:relative;flex:1;min-height:90px;margin:0 auto;width:64px;border-radius:32px;background:var(--panel2);border:2px solid var(--line);overflow:hidden}
.tug-zone{position:absolute;left:0;right:0;height:14%}
.tug-zone.them{top:0;background:linear-gradient(var(--cyan),transparent);opacity:.45}
.tug-zone.me{bottom:0;background:linear-gradient(transparent,var(--gold));opacity:.55}
.tug-rope{position:absolute;top:4%;bottom:4%;left:50%;width:6px;margin-left:-3px;background:repeating-linear-gradient(0deg,#c8a165 0 6px,#8b6a3a 6px 12px);border-radius:3px}
.tug-knot{position:absolute;left:50%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:#ff3a3a;border:3px solid #fff;
  box-shadow:0 0 14px #ff3a3a;transition:top .12s linear;display:flex;align-items:center;justify-content:center;font-size:20px}
.tug-btn{flex:none;height:min(34%,170px);min-height:84px;font-size:40px}
`);

export function mount(stage, api) {
  const target = api.setup.target || 25;
  const knot = h('div', { class: 'tug-knot' }, '🪢');
  const field = h('div', { class: 'tug-field' }, h('div', { class: 'tug-zone them' }), h('div', { class: 'tug-zone me' }), h('div', { class: 'tug-rope' }), knot);
  const btn = h('button', { class: 'duel-big tug-btn', type: 'button' }, 'PULL! 💪');
  stage.append(h('div', { class: 'tug' }, h('div', { class: 'tug-face' }, api.opponent.face), field,
    h('div', { class: 'tug-face' }, api.myFace), btn));
  let pending = 0;
  let rope = 0; // server's rope, positive = a ahead
  let local = 0; // my taps not yet reflected by the server
  const draw = () => {
    const mineAhead = (api.me === 'a' ? rope : -rope) + local;
    const pos = 50 + Math.max(-1, Math.min(1, mineAhead / target)) * 43; // 50% = middle, toward the bottom = me
    knot.style.top = pos + '%';
  };
  draw();
  const tap = (e) => {
    e.preventDefault();
    if (!api.started()) return;
    pending++;
    local++;
    btn.classList.add('hit');
    setTimeout(() => btn.classList.remove('hit'), 60);
    draw();
  };
  btn.addEventListener('pointerdown', tap);
  const iv = setInterval(() => {
    if (pending > 0) { api.send({ taps: Math.min(pending, 4) }); pending = Math.max(0, pending - 4); }
  }, 95);
  return {
    state(st) { if (typeof st.rope === 'number') { rope = st.rope; local = 0; draw(); } },
    end() { clearInterval(iv); btn.disabled = true; },
    destroy() { clearInterval(iv); },
  };
}
