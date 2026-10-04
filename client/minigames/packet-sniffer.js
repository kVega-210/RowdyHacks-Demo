// MG-03 Packet Sniffer: packets stream past; tap the one carrying the target data before it escapes.
import { game, h, css, byD, SYMBOLS } from '../fx/kit.js';

export const meta = { id: 'packet-sniffer', name: 'Packet Sniffer', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-packet-sniffer', `
.ps-target{text-align:center;margin-bottom:8px;font-size:15px}.ps-target b{font-size:30px;letter-spacing:6px;color:#ffd84d}
.ps-pipe{position:absolute;left:0;right:0;top:58px;bottom:0;border:2px solid #2a3555;border-radius:12px;overflow:hidden;background:#05070d}
.ps-lane{position:absolute;left:0;right:0;height:25%}
.ps-pkt{position:absolute;top:10%;height:80%;width:110px;padding:0;font-size:22px;letter-spacing:3px;background:#16213a;color:#4dd2ff;box-shadow:0 0 0 2px #4dd2ff inset}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap the packet with the target data', timeMs: 13000 });
  const len = byD(g, 2, 3, 3);
  const pool = SYMBOLS.slice(0, byD(g, 6, 6, 8));
  const target = Array.from({ length: len }, () => g.r.pick(pool)).join('');
  const pipe = h('div', { class: 'ps-pipe hh-ctl' });
  g.stage.append(h('div', { class: 'ps-target' }, 'TARGET DATA ', h('b', {}, target)), pipe);
  const lanes = 4;
  const total = byD(g, 10, 14, 18);
  const targetAt = g.r.range(Math.floor(total * 0.25), Math.floor(total * 0.6));
  const v = byD(g, 0.32, 0.4, 0.5); // fraction of pipe width per second
  const packets = [];
  const decoy = () => {
    let s;
    do {
      s = target.split('');
      s[g.r.int(len)] = g.r.pick(pool);
      if (g.r.chance(0.4)) s = g.r.shuffle(s);
      s = s.join('');
    } while (s === target);
    return g.d === 1 ? Array.from({ length: len }, () => g.r.pick(pool)).join('').replace(target, 'X') : s;
  };
  for (let i = 0; i < total; i++) {
    const isT = i === targetAt;
    const label = isT ? target : decoy();
    const b = g.btn(label, () => (isT ? g.win() : g.lose('sniffed the wrong packet')), 'ps-pkt');
    const lane = i % lanes;
    b.style.top = `calc(${lane * 25}% + 4px)`;
    b.style.height = 'calc(25% - 8px)';
    packets.push({ b, x: -0.35 - i * 0.22, isT, lane });
    pipe.append(b);
  }
  g.loop((dt) => {
    for (const p of packets) {
      p.x += v * dt;
      p.b.style.left = p.x * 100 + '%';
      if (p.isT && p.x > 1.02) return g.lose('target packet escaped');
    }
  });
  return g.handle();
}
