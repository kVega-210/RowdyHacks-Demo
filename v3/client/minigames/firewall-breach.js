// MG-01 Firewall Breach, v2: tap the numbered nodes in ORDER! (numbers stay visible at every difficulty). Running out of
// time reveals the remaining path; a clean breach rains Matrix code.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'firewall-breach', name: 'Firewall Breach', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-firewall-breach', `
.fb-wrap{display:flex;flex-direction:column;height:100%;gap:6px}
.fb-grid{display:grid;gap:8px;max-width:420px;width:100%;margin:0 auto;flex:1;min-height:0;align-content:center}
.fb-node{border-radius:50%;aspect-ratio:1;min-height:0;min-width:0;max-height:100%;font-size:24px;padding:0;background:var(--panel,#16213a);color:var(--cyan,#4dd2ff);box-shadow:0 0 0 3px var(--line,#2a3555) inset,0 4px 0 var(--panel2,#0a0f1c)}
.fb-node.num{background:#0d2a3a;color:#fff;box-shadow:0 0 0 3px var(--cyan,#4dd2ff) inset,0 4px 0 var(--panel2,#0a0f1c)}
.fb-node.hit{background:#3dff9a;color:var(--on-accent,#0b0f1a)}
.fb-label{text-align:center;font:900 26px system-ui,sans-serif;letter-spacing:.14em;color:var(--cyan,#4dd2ff);text-shadow:0 0 10px var(--cyan,#4dd2ff)66}
`);

export function mount(container, opts) {
  let next = 1, lastWrong = null;
  const byNum = new Map();
  const g = game(container, opts, {
    id: meta.id, title: meta.name, hint: 'Tap the nodes 1, 2, 3... in order', timeMs: 12000,
    onTimeout: () => {
      const remaining = [...byNum.entries()].filter(([n]) => n >= next).map(([, b]) => b);
      g.lose('timeout', null, { good: remaining, bad: lastWrong });
    },
  });
  const cols = byD(g, 3, 4, 4), rows = byD(g, 3, 3, 4);
  const count = byD(g, 4, 6, 7);
  const cells = g.r.sample([...Array(cols * rows).keys()], count);
  const grid = h('div', { class: 'fb-grid', style: { gridTemplateColumns: `repeat(${cols},1fr)` } });
  for (let i = 0; i < cols * rows; i++) {
    const idx = cells.indexOf(i);
    const num = idx >= 0 ? idx + 1 : 0;
    const b = g.btn(num ? String(num) : '', () => {
      if (num === next) {
        b.classList.add('hit');
        next++;
        if (next > count) g.win(null, null, { matrix: true });
      } else {
        lastWrong = b;
        g.penalize(byD(g, 1500, 2000, 2500));
        g.status('ACCESS DENIED', '#ff5c7a');
      }
    }, 'fb-node' + (num ? ' num' : ''));
    if (num) byNum.set(num, b);
    grid.append(b);
  }
  g.stage.append(h('div', { class: 'fb-wrap' }, grid, h('div', { class: 'fb-label hh-label' }, 'ORDER!')));
  return g.handle();
}
