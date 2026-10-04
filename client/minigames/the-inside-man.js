// MG-33 The Inside Man: copy the GREEN accomplice's signals; ignore the RED decoy.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'the-inside-man', name: 'The Inside Man', tags: ['classic'], baseDurationMs: 12000 };

const ARROWS = ['◀', '▲', '▶', '▼'];

css('mg-inside', `
.im-sig{display:flex;align-items:center;justify-content:center;gap:14px;height:150px}
.im-sig .who{font-size:54px}.im-sig .arr{font-size:80px;font-weight:900}
.im-sig.green .arr{color:#3dff9a;text-shadow:0 0 18px #3dff9a}.im-sig.red .arr{color:#ff2244;text-shadow:0 0 18px #ff2244}
.im-prog{text-align:center;font-weight:800;margin-bottom:8px}
.im-pad{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.im-pad .hh-btn{height:64px;font-size:28px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Copy GREEN signals. Ignore RED.', timeMs: 13000 });
  const need = byD(g, 4, 5, 6);
  const redChance = byD(g, 0.25, 0.35, 0.45);
  const sig = h('div', { class: 'im-sig' });
  const prog = h('div', { class: 'im-prog' });
  let done = 0, cur = null, answered = false;
  const showMs = byD(g, 1300, 1100, 950);
  const next = () => {
    if (cur && cur.green && !answered) return g.lose('missed a signal');
    if (done >= need) return;
    // Never two decoys in a row, and the first signal is always real.
    const green = done === 0 || (cur && !cur.green) || !g.r.chance(redChance);
    cur = { green, dir: g.r.int(4) };
    answered = false;
    sig.className = 'im-sig ' + (green ? 'green' : 'red');
    sig.replaceChildren(h('span', { class: 'who' }, green ? '🧑‍💼' : '🕵️'), h('span', { class: 'arr' }, ARROWS[cur.dir]));
    prog.textContent = `Signals ${done}/${need}`;
  };
  next();
  g.every(showMs, next);
  g.stage.append(prog, sig, h('div', { class: 'im-pad' }, ARROWS.map((a, i) => g.btn(a, () => {
    if (!cur || answered) return;
    if (!cur.green) return g.lose('followed the decoy');
    if (i !== cur.dir) return g.lose('wrong signal');
    answered = true;
    done++;
    prog.textContent = `Signals ${done}/${need}`;
    sig.className = 'im-sig';
    if (done >= need) g.win();
  }, 'alt'))));
  return g.handle();
}
