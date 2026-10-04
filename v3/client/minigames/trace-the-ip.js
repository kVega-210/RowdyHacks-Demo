// MG-06 Trace the IP: tap the server whose address matches the target route (near-miss decoys).
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'trace-the-ip', name: 'Trace the IP', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-trace-ip', `
.ti-target{text-align:center;margin-bottom:6px}.ti-target b{display:block;font:900 26px ui-monospace,monospace;color:var(--gold,#ffd84d)}
.ti-list{display:grid;gap:6px}
.ti-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:8px 0 0;text-shadow:0 0 10px #ff224466}
.ti-list .hh-btn{font:800 20px ui-monospace,monospace;min-height:40px;padding:4px 12px;background:var(--panel,#16213a);color:#9fe3ff;box-shadow:0 0 0 2px var(--cyan,#4dd2ff) inset,0 4px 0 var(--panel2,#0a0f1c)}
@media (max-height:700px){.ti-list{gap:5px}.ti-list .hh-btn{min-height:34px;font-size:18px;padding:2px 10px}.ti-target b{font-size:22px}.ti-label{margin-top:4px;font-size:21px}}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap the server that matches the route', timeMs: 12000 });
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
  // Answers are laid out once and never move during play.
  const btns = [];
  const list = h('div', { class: 'ti-list' }, g.r.shuffle(ips).map((ip) => {
    const b = g.btn(ip, () => (ip === ips[0] ? g.win() : g.lose('traced back to you', null, { good: btns[0], bad: b })));
    if (ip === ips[0]) btns.unshift(b); else btns.push(b);
    return b;
  }));
  g.stage.append(h('div', { class: 'ti-target' }, 'ROUTE TO', h('b', {}, ips[0])), list, h('div', { class: 'ti-label hh-label' }, 'MATCH!'));
  return g.handle();
}
