// MG-05 Digital Lockpick, v2: bigger symbols, a MATCH! label, and an answer reveal when time runs out.
import { game, h, css, byD, SYMBOLS, COLORS } from '../fx/kit.js';

export const meta = { id: 'digital-lockpick', name: 'Digital Lockpick', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-digital-lockpick', `
.dl-wrap{display:flex;flex-direction:column;justify-content:center;height:100%;gap:6px}
.dl-target{display:flex;gap:12px;justify-content:center}
.dl-target span{width:74px;height:74px;border-radius:12px;border:3px dashed var(--gold,#ffd84d);display:flex;align-items:center;justify-content:center;font-size:44px}
.dl-label{text-align:center;font:900 26px system-ui,sans-serif;letter-spacing:.14em;color:var(--gold,#ffd84d);text-shadow:0 0 10px var(--gold,#ffd84d)66}
.dl-row{display:flex;gap:12px;justify-content:center}
.dl-tum{width:96px;height:124px;font-size:60px;background:var(--panel,#121a2e);box-shadow:0 0 0 3px var(--cyan,#4dd2ff) inset,0 4px 0 var(--panel2,#0a0f1c)}
.dl-tum.ok{box-shadow:0 0 0 3px #3dff9a inset,0 4px 0 var(--panel2,#0a0f1c)}
.dl-note{text-align:center;opacity:.8;margin-top:6px;font-size:14px}
`);

export function mount(container, opts) {
  let targets = [], tums = [], cur = [], target = [];
  const g = game(container, opts, {
    id: meta.id, title: meta.name, hint: 'Tap a tumbler to rotate it', timeMs: 12000,
    // Out of time: show the target pattern in green and every tumbler that didn't match in red.
    onTimeout: () => g.lose('timeout', null, { good: targets.concat(tums.filter((_, i) => cur[i] === target[i])), bad: tums.filter((_, i) => cur[i] !== target[i]) }),
  });
  const k = byD(g, 4, 5, 5);
  const syms = SYMBOLS.slice(0, k);
  const n = 3;
  const linked = g.d === 3;
  target = Array.from({ length: n }, () => g.r.int(k));
  cur = target.map((t) => (t + 1 + g.r.int(k - 1)) % k);
  const draw = () => tums.forEach((b, i) => {
    b.textContent = syms[cur[i]];
    b.style.color = COLORS[cur[i] % COLORS.length];
    b.classList.toggle('ok', cur[i] === target[i]);
  });
  for (let i = 0; i < n; i++) {
    tums.push(g.btn('', () => {
      cur[i] = (cur[i] + 1) % k;
      if (linked && i > 0) cur[i - 1] = (cur[i - 1] + 1) % k;
      draw();
      if (cur.every((c, j) => c === target[j])) g.win();
    }, 'dl-tum'));
  }
  draw();
  targets = target.map((t) => h('span', { style: { color: COLORS[t % COLORS.length] } }, syms[t]));
  g.stage.append(h('div', { class: 'dl-wrap' },
    h('div', { class: 'dl-target' }, targets),
    h('div', { class: 'dl-label hh-label' }, 'MATCH!'),
    h('div', { class: 'dl-row' }, tums),
    linked ? h('div', { class: 'dl-note' }, 'Tumblers are linked: each one also turns its left neighbour. Work right to left.') : null));
  return g.handle();
}
