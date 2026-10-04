// MG-06 Trace the IP: the server list keeps reshuffling; tap the one matching the target route.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'trace-the-ip', name: 'Trace the IP', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-trace-ip', `
.ti-target{text-align:center;margin-bottom:10px}.ti-target b{display:block;font:900 28px ui-monospace,monospace;color:#ffd84d}
.ti-list{display:grid;gap:8px}
.ti-list .hh-btn{font:800 20px ui-monospace,monospace;min-height:50px;background:#16213a;color:#9fe3ff;box-shadow:0 0 0 2px #4dd2ff inset,0 4px 0 #0a0f1c}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Find the server before it moves again', timeMs: 12000 });
  const n = byD(g, 4, 5, 6);
  const oct = () => g.r.range(10, 254);
  const target = [oct(), oct(), oct(), oct()];
  const ips = [target.join('.')];
  while (ips.length < n) {
    const d = target.slice();
    const idx = g.d === 1 ? g.r.int(4) : g.r.range(2, 3);
    d[idx] = (d[idx] + g.r.range(1, g.d === 1 ? 90 : 9)) % 255;
    const s = d.join('.');
    if (!ips.includes(s)) ips.push(s);
  }
  const list = h('div', { class: 'ti-list' });
  const shuffle = () => list.replaceChildren(...g.r.shuffle(ips).map((ip) =>
    g.btn(ip, () => (ip === ips[0] ? g.win() : g.lose('traced back to you')))));
  shuffle();
  g.every(byD(g, 2600, 1900, 1400), shuffle);
  g.stage.append(h('div', { class: 'ti-target' }, 'ROUTE TO', h('b', {}, ips[0])), list);
  return g.handle();
}
