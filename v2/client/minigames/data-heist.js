// MG-10 Data Heist: move the file through the network to the exit; red security zones blink on and off.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'data-heist', name: 'Data Heist', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-data-heist', `
.dh-board{display:grid;gap:4px;margin:0 auto;height:min(100%,340px,calc(100% - 150px));aspect-ratio:1;max-width:100%}
.dh-c{border-radius:6px;background:#121a2e;display:flex;align-items:center;justify-content:center;font-size:22px}
.dh-c.red{background:#3a1220}.dh-c.red.on{background:#ff2244;box-shadow:0 0 10px #ff2244}
.dh-c.exit{background:#103322;outline:2px solid #3dff9a}
.dh-pad{display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,52px);gap:6px;justify-content:center}
.dh-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:6px 0 4px;text-shadow:0 0 10px #ff224466}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Avoid the red zones while they glow', timeMs: 13000 });
  const n = byD(g, 5, 5, 6);
  const reds = new Map();
  const exit = [n - 1, 0];
  let pos = [0, n - 1];
  const count = byD(g, 5, 7, 11);
  while (reds.size < count) {
    const x = g.r.int(n), y = g.r.int(n);
    if ((x === pos[0] && y === pos[1]) || (x === exit[0] && y === exit[1])) continue;
    reds.set(x + ',' + y, { phase: g.r.float(0, 1), period: g.r.float(1.4, 2.4) });
  }
  const cells = [];
  const board = h('div', { class: 'dh-board', style: { gridTemplateColumns: `repeat(${n},1fr)` } });
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = h('div', { class: 'dh-c' + (reds.has(x + ',' + y) ? ' red' : '') + (x === exit[0] && y === exit[1] ? ' exit' : '') });
    cells.push(c);
    board.append(c);
  }
  const isOn = (key, t) => { const r = reds.get(key); return r && ((t / 1000 / r.period + r.phase) % 1) < 0.5; };
  const draw = (t) => {
    cells.forEach((c, i) => {
      const x = i % n, y = Math.floor(i / n), key = x + ',' + y;
      if (reds.has(key)) c.classList.toggle('on', isOn(key, t));
      c.textContent = x === pos[0] && y === pos[1] ? '📁' : x === exit[0] && y === exit[1] ? '🚪' : '';
    });
  };
  const move = (dx, dy) => {
    const nx = Math.max(0, Math.min(n - 1, pos[0] + dx)), ny = Math.max(0, Math.min(n - 1, pos[1] + dy));
    pos = [nx, ny];
    draw(g.elapsed);
    if (isOn(nx + ',' + ny, g.elapsed)) return g.lose('tripped security');
    if (nx === exit[0] && ny === exit[1]) g.win();
  };
  g.loop((dt, t) => {
    draw(t);
    if (isOn(pos[0] + ',' + pos[1], t)) g.lose('security sweep');
  });
  const pad = h('div', { class: 'dh-pad' },
    h('span'), g.btn('▲', () => move(0, -1), 'alt'), h('span'),
    g.btn('◀', () => move(-1, 0), 'alt'), g.btn('▼', () => move(0, 1), 'alt'), g.btn('▶', () => move(1, 0), 'alt'));
  g.stage.append(board, h('div', { class: 'dh-label' }, 'HACK!'), pad);
  return g.handle();
}
