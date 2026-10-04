// MG-01 Firewall Breach: tap the numbered firewall nodes in order before the security meter fills.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'firewall-breach', name: 'Firewall Breach', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-firewall-breach', `
.fb-grid{display:grid;gap:8px;max-width:420px;margin:0 auto;height:100%}
.fb-node{border-radius:50%;aspect-ratio:1;min-height:0;font-size:22px;padding:0;background:#16213a;color:#4dd2ff;box-shadow:0 0 0 3px #2a3555 inset,0 4px 0 #0a0f1c}
.fb-node.num{background:#0d2a3a;color:#fff;box-shadow:0 0 0 3px #4dd2ff inset,0 4px 0 #0a0f1c}
.fb-node.hit{background:#3dff9a;color:#0b0f1a}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap the nodes 1, 2, 3... in order', timeMs: 12000 });
  const cols = byD(g, 3, 4, 4), rows = byD(g, 3, 3, 4);
  const count = byD(g, 4, 6, 7);
  const cells = g.r.sample([...Array(cols * rows).keys()], count);
  const grid = h('div', { class: 'fb-grid', style: { gridTemplateColumns: `repeat(${cols},1fr)` } });
  let next = 1;
  const nodes = [];
  for (let i = 0; i < cols * rows; i++) {
    const idx = cells.indexOf(i);
    const num = idx >= 0 ? idx + 1 : 0;
    const b = g.btn(num ? String(num) : '', () => {
      if (num === next) {
        b.classList.add('hit');
        next++;
        if (g.d === 3 && next === 2) nodes.forEach((n) => { if (!n.classList.contains('hit')) n.textContent = ''; });
        if (next > count) g.win();
      } else {
        g.penalize(byD(g, 1500, 2000, 2500));
        g.status('ACCESS DENIED', '#ff5c7a');
      }
    }, 'fb-node' + (num ? ' num' : ''));
    nodes.push(b);
    grid.append(b);
  }
  if (g.d === 3) g.hint('Memorise! Numbers vanish after your first tap');
  g.stage.append(grid);
  return g.handle();
}
