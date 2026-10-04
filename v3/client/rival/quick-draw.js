// v3 rival duel: QUICK DRAW. A western standoff: wait... wait... when it says DRAW!, tap first.
// Tapping before the signal is a foul and hands the win to your opponent.
import { css, h } from '../fx/kit.js';

export const meta = { id: 'quick-draw', name: 'Quick Draw' };

css('duel-draw', `
.qd{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;gap:8px}
.qd-stand{display:flex;justify-content:space-between;align-items:flex-end;padding:0 18px;font-size:54px;line-height:1}
.qd-stand .them{transform:scaleX(-1)}
.qd-btn{flex:1;min-height:120px;font-size:44px;background:var(--panel);color:var(--dim);box-shadow:inset 0 0 0 3px var(--line),0 6px 0 var(--panel2)}
.qd-btn.draw{background:#ff3a3a;color:#fff;box-shadow:0 0 40px #ff3a3a,0 6px 0 #8f1515;animation:qdPulse .25s ease-out}
.qd-btn.foul{background:#5a1020;color:#ff9aa8}
.qd-btn.shot{background:var(--gold);color:var(--on-accent,#000)}
@keyframes qdPulse{from{transform:scale(1.08)}}
`);

export function mount(stage, api) {
  const signalAt = api.setup.signalAt || api.startsAt + 2500;
  let state = 'wait', fired = false;
  const label = h('div', { class: 'duel-label' }, 'STEADY...');
  const btn = h('button', { class: 'duel-big qd-btn', type: 'button' }, 'WAIT FOR IT');
  stage.append(h('div', { class: 'qd' },
    h('div', { class: 'qd-stand' }, h('span', {}, api.myFace + '🔫'), h('span', { class: 'them' }, api.opponent.face + '🔫')),
    label, btn));
  const iv = setInterval(() => {
    if (state === 'wait' && api.now() >= signalAt) {
      state = 'draw';
      btn.classList.add('draw');
      btn.textContent = 'DRAW! 💥';
      label.textContent = 'DRAW!';
      if (navigator.vibrate) navigator.vibrate(80);
      api.sfx.play('vault');
    }
  }, 16);
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (fired || !api.started()) return;
    fired = true;
    api.send({ tap: true });
    if (state === 'draw') { btn.classList.remove('draw'); btn.classList.add('shot'); btn.textContent = 'BANG! 💥'; }
    else { btn.classList.add('foul'); btn.textContent = 'TOO EARLY!'; label.textContent = 'FOUL'; }
  });
  return {
    state() {},
    end() { clearInterval(iv); btn.disabled = true; },
    destroy() { clearInterval(iv); },
  };
}
