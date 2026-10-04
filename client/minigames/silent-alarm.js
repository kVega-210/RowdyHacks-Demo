// MG-30 Silent Alarm: one object hides a blinking red sensor. Find it and pull it.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'silent-alarm', name: 'Silent Alarm', tags: ['classic'], baseDurationMs: 12000 };

const OBJ = ['🪴', '🖼️', '🕰️', '📚', '🧸', '🗿', '🪑', '💡', '📻', '🧯', '🛋️', '🗄️'];

css('mg-silent-alarm', `
.sa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.sa-grid .hh-btn{position:relative;font-size:44px;min-height:86px;background:#1a1626;box-shadow:0 0 0 2px #2a3555 inset,0 4px 0 #0a0f1c}
.sa-led{position:absolute;top:8px;right:10px;width:10px;height:10px;border-radius:50%;background:transparent}
.sa-led.red.on{background:#ff2244;box-shadow:0 0 10px #ff2244}
.sa-led.green.on{background:#3dff9a;box-shadow:0 0 10px #3dff9a}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Find the RED blinking sensor', timeMs: 12000 });
  const n = byD(g, 6, 9, 12);
  const items = g.r.sample(OBJ, n);
  const culprit = g.r.int(n);
  const decoys = new Set(g.d >= 2 ? g.r.sample([...Array(n).keys()].filter((i) => i !== culprit), byD(g, 0, 2, 4)) : []);
  const leds = [];
  const grid = h('div', { class: 'sa-grid' }, items.map((o, i) => {
    const led = h('i', { class: 'sa-led ' + (i === culprit ? 'red' : decoys.has(i) ? 'green' : '') });
    leds.push({ led, phase: g.r.float(0, 1) });
    const b = g.btn(o, () => (i === culprit ? g.win() : g.lose('alarm still blaring')));
    b.append(led);
    return b;
  }));
  const period = byD(g, 900, 1300, 1700);
  const onFor = byD(g, 0.5, 0.25, 0.15);
  g.loop((dt, t) => leds.forEach((l) => l.led.classList.toggle('on', ((t / period + l.phase) % 1) < onFor)));
  g.stage.append(grid);
  return g.handle();
}
