// MG-23 Getaway Driver: dodge the roadblocks for the whole timer and grab enough cash bags.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'getaway-driver', name: 'Getaway Driver', tags: ['classic'], baseDurationMs: 10000 };

css('mg-getaway', `
.gd-road{position:absolute;left:0;right:0;top:0;bottom:70px;margin:0 auto;max-width:360px;background:#2b2f3a;border-left:6px solid #ffd84d;border-right:6px solid #ffd84d;overflow:hidden;border-radius:8px}
.gd-road:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 32%,#ffffff22 32% 34%,transparent 34% 66%,#ffffff22 66% 68%,transparent 68%)}
.gd-o{position:absolute;width:33.3%;text-align:center;font-size:38px;margin-top:-22px}
.gd-car{position:absolute;bottom:8px;width:33.3%;text-align:center;font-size:46px;transition:left .09s}
.gd-pad{position:absolute;left:0;right:0;bottom:0;display:flex;gap:12px;justify-content:center}
.gd-pad .hh-btn{width:42%;height:60px;font-size:28px}
.gd-cash{position:absolute;top:6px;right:8px;z-index:3;font-weight:900;color:#ffd84d}
`);

export function mount(container, opts) {
  const need = [0, 2, 3];
  const g = game(container, opts, {
    id: meta.id, title: meta.name, hint: 'Dodge 🚧 and grab 💰', timeMs: 10000,
    onTimeout: () => (cash >= need[g.d - 1] ? g.win(1 + cash * 0.1) : g.lose('not enough loot')),
  });
  let lane = 1, cash = 0;
  const road = h('div', { class: 'gd-road' });
  const car = h('div', { class: 'gd-car' }, '🚗');
  const cashEl = h('div', { class: 'gd-cash' });
  road.append(car);
  const objs = [];
  const v = byD(g, 0.45, 0.55, 0.65);
  let spawnAcc = 0;
  const spawn = () => {
    const block = g.r.int(3);
    const ob = h('div', { class: 'gd-o' }, '🚧');
    ob.style.left = block * 33.3 + '%';
    objs.push({ el: ob, lane: block, y: -0.05, kind: 'block' });
    road.append(ob);
    if (g.r.chance(0.7)) {
      const l = (block + 1 + g.r.int(2)) % 3;
      const c = h('div', { class: 'gd-o' }, '💰');
      c.style.left = l * 33.3 + '%';
      objs.push({ el: c, lane: l, y: -0.05 - g.r.float(0, 0.1), kind: 'cash' });
      road.append(c);
    }
  };
  g.loop((dt) => {
    spawnAcc += dt;
    if (spawnAcc > byD(g, 1.1, 0.95, 0.8)) { spawnAcc = 0; spawn(); }
    car.style.left = lane * 33.3 + '%';
    cashEl.textContent = `💰 ${cash}/${need[g.d - 1]}`;
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      o.y += v * dt;
      o.el.style.top = o.y * 100 + '%';
      if (o.y > 0.82 && o.y < 0.95 && o.lane === lane) {
        if (o.kind === 'block') return g.lose('crashed');
        cash++;
        o.el.remove();
        objs.splice(i, 1);
      } else if (o.y > 1.1) { o.el.remove(); objs.splice(i, 1); }
    }
  });
  g.stage.append(cashEl, road, h('div', { class: 'gd-pad' },
    g.btn('◀', () => { lane = Math.max(0, lane - 1); }, 'alt'), g.btn('▶', () => { lane = Math.min(2, lane + 1); }, 'alt')));
  return g.handle();
}
