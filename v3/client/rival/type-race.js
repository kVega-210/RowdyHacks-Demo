// v3 rival duel: TYPE RACE. Both crooks get the same password; tap it out on the keypad. A wrong key knocks you back
// one letter. First to finish wins; at the buzzer, whoever got further wins.
import { css, h } from '../fx/kit.js';
import { theirs } from '../phone/duel/duel.js';

export const meta = { id: 'type-race', name: 'Type Race' };

css('duel-type', `
.tr{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;gap:6px}
.tr-opp{display:flex;align-items:center;gap:8px;font-size:22px}.tr-opp .duel-bar{flex:1}
.tr-word{display:flex;justify-content:center;gap:5px}
.tr-word span{width:38px;height:46px;border-radius:8px;border:2px solid var(--line);background:var(--panel2);display:flex;align-items:center;justify-content:center;
  font:900 26px var(--font-mono,monospace);color:var(--ink)}
.tr-word span.ok{border-color:#3dff9a;color:#3dff9a;background:#0d2a1c}.tr-word span.now{border-color:var(--gold);box-shadow:0 0 8px var(--gold)}
.tr-pad{flex:1;min-height:0;display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.tr-pad button{border:0;border-radius:12px;background:var(--panel);color:var(--ink);font:900 26px var(--font-mono,monospace);box-shadow:inset 0 0 0 2px var(--line),0 3px 0 var(--panel2);touch-action:manipulation}
.tr-pad button:active{transform:translateY(2px)}
.tr-pad button.bad{background:#5a1020;box-shadow:inset 0 0 0 2px #ff4d6d}
`);

export function mount(stage, api) {
  const word = String(api.setup.word || 'HEIST');
  const keys = String(api.setup.keys || 'ABCDEFHKMNPRSTXZ').split('');
  let pos = 0;
  const cells = word.split('').map((ch) => h('span', {}, ch));
  const oppBar = h('i');
  const pad = h('div', { class: 'tr-pad' });
  const paint = () => cells.forEach((c, i) => { c.className = i < pos ? 'ok' : i === pos ? 'now' : ''; });
  for (const k of keys) {
    const b = h('button', { type: 'button' }, k);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!api.started() || pos >= word.length) return;
      if (k === word[pos]) {
        pos++;
        api.sfx.play('click');
        if (pos === word.length) api.send({ done: word }); else api.send({ progress: pos });
      } else {
        pos = Math.max(0, pos - 1); // a wrong key knocks you back a letter
        b.classList.add('bad');
        setTimeout(() => b.classList.remove('bad'), 250);
        if (navigator.vibrate) navigator.vibrate(60);
        api.send({ progress: pos });
      }
      paint();
    });
    pad.append(b);
  }
  paint();
  stage.append(h('div', { class: 'tr' },
    h('div', { class: 'tr-opp' }, h('span', {}, api.opponent.face), h('div', { class: 'duel-bar' }, oppBar)),
    h('div', { class: 'tr-word' }, cells),
    h('div', { class: 'duel-label' }, 'TYPE!'),
    pad));
  return {
    state(st) { const p = theirs(st, api.me).progress || 0; oppBar.style.width = (p / word.length) * 100 + '%'; },
    end() { pad.querySelectorAll('button').forEach((b) => { b.disabled = true; }); },
    destroy() {},
  };
}
