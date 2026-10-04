// MG-15 Firewall Freeze: stop the cursor inside the safe zone. The zone keeps shrinking.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'firewall-freeze', name: 'Firewall Freeze', tags: ['cyber'], baseDurationMs: 10000 };

css('mg-ff', `
.ff-bar{position:relative;height:70px;border-radius:14px;background:#2a0d16;border:3px solid #ff5c7a;margin:30px 0 20px;overflow:hidden}
.ff-zone{position:absolute;top:0;bottom:0;background:#3dff9a;opacity:.75}
.ff-cur{position:absolute;top:-6px;bottom:-6px;width:10px;margin-left:-5px;background:#fff;box-shadow:0 0 12px #fff;border-radius:5px}
.ff-stop{display:block;margin:0 auto;width:80%;height:72px;font-size:28px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'STOP inside the green. It shrinks!', timeMs: 10000 });
  const zone = h('div', { class: 'ff-zone' });
  const cur = h('div', { class: 'ff-cur' });
  const center = g.r.float(0.3, 0.7);
  const w0 = byD(g, 0.32, 0.26, 0.22), wMin = byD(g, 0.08, 0.06, 0.04);
  let x = 0, dir = 1, w = w0;
  const v = byD(g, 0.7, 0.85, 1.0);
  g.loop((dt, t) => {
    w = Math.max(wMin, w0 - (w0 - wMin) * (t / 8000));
    x += dir * v * dt;
    if (x > 1) { x = 1; dir = -1; } else if (x < 0) { x = 0; dir = 1; }
    zone.style.left = (center - w / 2) * 100 + '%';
    zone.style.width = w * 100 + '%';
    cur.style.left = x * 100 + '%';
  });
  const stop = g.btn('STOP', () => (Math.abs(x - center) <= w / 2 ? g.win() : g.lose('firewall slammed shut')), 'bad ff-stop');
  g.stage.append(h('div', { class: 'ff-bar' }, zone, cur), stop);
  return g.handle();
}
