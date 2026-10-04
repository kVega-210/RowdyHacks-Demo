// MG-30 Silent Alarm: objects hide blinking sensors. Disarm every RED and YELLOW one; GREEN sensors are safe.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'silent-alarm', name: 'Silent Alarm', tags: ['classic'], baseDurationMs: 12000 };

const OBJ = ['🪴', '🖼️', '🕰️', '📚', '🧸', '🗿', '🪑', '💡', '📻', '🧯', '🛋️', '🗄️'];

css('mg-silent-alarm', `
.sa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sa-grid .hh-btn{position:relative;font-size:40px;min-height:72px;background:#1a1626;box-shadow:0 0 0 2px var(--line,#2a3555) inset,0 4px 0 var(--panel2,#0a0f1c)}
.sa-grid .hh-btn.sa-off{opacity:.45}
.sa-led{position:absolute;top:8px;right:10px;width:11px;height:11px;border-radius:50%;background:transparent}
.sa-led.red.on{background:#ff2244;box-shadow:0 0 10px #ff2244}
.sa-led.yellow.on{background:var(--gold,#ffd84d);box-shadow:0 0 10px var(--gold,#ffd84d)}
.sa-led.green.on{background:#3dff9a;box-shadow:0 0 10px #3dff9a}
.sa-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:8px 0 6px;text-shadow:0 0 10px #ff224466}
`);

export function mount(container, opts) {
  const g = game(container, opts, {
    id: meta.id, title: meta.name, hint: 'Tap RED + YELLOW sensors. GREEN is safe.', timeMs: 12000,
    onTimeout: () => g.lose('timeout', null, { good: armed.map((i) => btns[i]) }),
  });
  const n = byD(g, 6, 9, 12);
  const items = g.r.sample(OBJ, n);
  // Sensor kinds: one red alarm, some yellow alarms (also must be disarmed), some green safe decoys, rest unlit.
  const order = g.r.shuffle([...Array(n).keys()]);
  const nYellow = byD(g, 1, 1, 2), nGreen = byD(g, 0, 2, 4);
  const kind = Array(n).fill('');
  kind[order[0]] = 'red';
  order.slice(1, 1 + nYellow).forEach((i) => { kind[i] = 'yellow'; });
  order.slice(1 + nYellow, 1 + nYellow + nGreen).forEach((i) => { kind[i] = 'green'; });
  let armed = order.slice(0, 1 + nYellow);
  const leds = [], btns = [];
  const grid = h('div', { class: 'sa-grid' }, items.map((o, i) => {
    const led = h('i', { class: 'sa-led ' + kind[i] });
    leds.push({ led, phase: g.r.float(0, 1) });
    const b = g.btn(o, () => {
      if (!armed.includes(i)) return g.lose('alarm still blaring', null, { good: armed.map((j) => btns[j]), bad: b });
      armed = armed.filter((j) => j !== i);
      led.className = 'sa-led';
      b.classList.add('sa-off');
      b.disabled = true;
      g.dollar(b);
      if (!armed.length) g.win();
    });
    b.append(led);
    btns.push(b);
    return b;
  }));
  const period = byD(g, 900, 1300, 1700);
  const onFor = byD(g, 0.5, 0.25, 0.15);
  g.loop((dt, t) => leds.forEach((l) => l.led.classList.toggle('on', ((t / period + l.phase) % 1) < onFor)));
  g.stage.append(h('div', { class: 'sa-label hh-label' }, 'DISARM!'), grid);
  return g.handle();
}
