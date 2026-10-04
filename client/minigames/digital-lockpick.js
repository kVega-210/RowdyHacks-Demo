// MG-05 Digital Lockpick: rotate the tumblers until every symbol matches the target pattern.
import { game, h, css, byD, SYMBOLS, COLORS } from '../fx/kit.js';

export const meta = { id: 'digital-lockpick', name: 'Digital Lockpick', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-digital-lockpick', `
.dl-target{display:flex;gap:10px;justify-content:center;margin-bottom:14px}
.dl-target span{width:56px;height:56px;border-radius:10px;border:2px dashed #ffd84d;display:flex;align-items:center;justify-content:center;font-size:30px}
.dl-row{display:flex;gap:10px;justify-content:center}
.dl-tum{width:84px;height:120px;font-size:44px;background:#121a2e;box-shadow:0 0 0 3px #4dd2ff inset,0 4px 0 #0a0f1c}
.dl-tum.ok{box-shadow:0 0 0 3px #3dff9a inset,0 4px 0 #0a0f1c}
.dl-note{text-align:center;opacity:.8;margin-top:10px;font-size:14px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap a tumbler to rotate it', timeMs: 12000 });
  const k = byD(g, 4, 5, 5);
  const syms = SYMBOLS.slice(0, k);
  const n = 3;
  const linked = g.d === 3;
  const target = Array.from({ length: n }, () => g.r.int(k));
  const cur = target.map((t) => (t + 1 + g.r.int(k - 1)) % k);
  const tums = [];
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
  g.stage.append(
    h('div', { class: 'dl-target' }, target.map((t) => h('span', { style: { color: COLORS[t % COLORS.length] } }, syms[t]))),
    h('div', { class: 'dl-row' }, tums),
    linked ? h('div', { class: 'dl-note' }, 'Tumblers are linked: each one also turns its left neighbour. Work right to left.') : null,
  );
  return g.handle();
}
