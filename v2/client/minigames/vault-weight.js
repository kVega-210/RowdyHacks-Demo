// MG-29 Vault Weight: load the bag close to the weight limit without going over, then hit ESCAPE.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'vault-weight', name: 'Vault Weight', tags: ['classic'], baseDurationMs: 12000 };

const LOOT = ['🪙', '💍', '👑', '🏺', '💎', '📿', '🕰️', '🗝️', '🎻', '🖼️'];

css('mg-vault-weight', `
.vw-scale{position:relative;height:42px;border-radius:10px;background:#121a2e;border:2px solid #2a3555;overflow:hidden;margin-bottom:6px}
.vw-fill{position:absolute;top:0;bottom:0;left:0;background:linear-gradient(90deg,#3dff9a,#ffd84d)}
.vw-min{position:absolute;top:0;bottom:0;border-left:3px dashed #3dff9a}
.vw-max{position:absolute;top:0;bottom:0;right:0;width:4px;background:#ff2244}
.vw-txt{text-align:center;font-weight:800;margin-bottom:8px}
.vw-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.vw-grid .hh-btn{font-size:28px;min-height:70px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#16213a;color:#fff;box-shadow:0 0 0 2px #2a3555 inset,0 4px 0 #0a0f1c}
.vw-grid .hh-btn small{font-size:14px;color:#ffd84d}
.vw-grid .hh-btn.in{box-shadow:0 0 0 3px #3dff9a inset,0 4px 0 #0a0f1c;background:#103322}
.vw-go{display:block;margin:10px auto 0;width:80%;height:60px;font-size:24px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Fill past the green line. Never over the red.', timeMs: 13000 });
  const limit = byD(g, 20, 25, 30);
  const minFrac = byD(g, 0.7, 0.8, 0.9);
  // Build a guaranteed solution, then add decoys.
  const sol = [];
  let s = 0;
  while (s < limit * minFrac) {
    const w = Math.min(g.r.range(2, 8), limit - s);
    sol.push(w);
    s += w;
  }
  const items = g.r.shuffle([...sol, ...Array.from({ length: 8 - Math.min(sol.length, 8) }, () => g.r.range(3, 9))]).slice(0, 8);
  if (!sol.every((w) => items.includes(w))) items.splice(0, sol.length, ...sol);
  const picked = new Set();
  const fill = h('div', { class: 'vw-fill' });
  const txt = h('div', { class: 'vw-txt' });
  const total = () => [...picked].reduce((a, i) => a + items[i], 0);
  const draw = () => {
    const t = total();
    fill.style.width = Math.min(100, (t / limit) * 100) + '%';
    txt.textContent = `${t} / ${limit} kg`;
    if (t > limit) g.lose('vault floor alarm');
  };
  const grid = h('div', { class: 'vw-grid' }, items.map((w, i) => {
    const b = g.btn('', () => {
      if (picked.has(i)) picked.delete(i); else picked.add(i);
      b.classList.toggle('in');
      draw();
    });
    b.append(LOOT[i % LOOT.length], h('small', {}, w + 'kg'));
    return b;
  }));
  draw();
  g.stage.append(h('div', { class: 'vw-scale' }, fill, h('div', { class: 'vw-min', style: { left: minFrac * 100 + '%' } }), h('div', { class: 'vw-max' })),
    txt, grid, g.btn('ESCAPE', () => (total() >= limit * minFrac && total() <= limit ? g.win() : g.lose('bag too light')), 'good vw-go'));
  return g.handle();
}
