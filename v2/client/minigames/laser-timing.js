// MG-27 Laser Timing: lasers slide, sweep and tilt across the room; tap DIVE! when none of them touches the green box.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'laser-timing', name: 'Laser Timing', tags: ['classic'], baseDurationMs: 12000 };

css('mg-laser-timing', `
.lt-room{position:relative;height:200px;border-radius:12px;background:#05070d;border:2px solid #2a3555;overflow:hidden;margin:6px 0 4px}
.lt-beam{position:absolute;top:0;bottom:0;width:6px;margin-left:-3px;background:#ff2244;box-shadow:0 0 14px #ff2244}
.lt-hbeam{position:absolute;left:0;right:0;height:6px;margin-top:-3px;background:#ff2244;box-shadow:0 0 14px #ff2244}
.lt-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 6px #ff2244)}
.lt-svg line{stroke:#ff2244;stroke-width:6px;stroke-linecap:round;vector-effect:non-scaling-stroke}
.lt-body{position:absolute;bottom:6px;height:22px;border-radius:6px;background:#3dff9a44;border:2px dashed #3dff9a;box-sizing:border-box}
.lt-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:6px 0 4px;text-shadow:0 0 10px #ff224466}
.lt-go{display:block;margin:6px auto 0;width:80%;height:64px;font-size:26px}
`);

const SVGNS = 'http://www.w3.org/2000/svg';

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'DIVE when no laser touches the green box', timeMs: 12000 });
  const need = byD(g, 1, 2, 3);
  // Green box (the thief's dive lane), in room fractions. Bottom 6px + 22px tall in a 200px room.
  const body = byD(g, 0.2, 0.21, 0.22);
  const bx0 = 0.5 - body / 2, bx1 = 0.5 + body / 2, by0 = 1 - 30 / 200, by1 = 1 - 4 / 200;
  const a = h('div', { class: 'lt-beam' }), b = h('div', { class: 'lt-beam' });
  const hb = h('div', { class: 'lt-hbeam' });
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'lt-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  const diag = document.createElementNS(SVGNS, 'line');
  svg.append(diag);
  const bodyEl = h('div', { class: 'lt-body', style: { left: bx0 * 100 + '%', width: body * 100 + '%' } });
  // Each laser gets a seeded phase and a little seeded speed variance, re-rolled after every cleared room.
  const base = { gap: byD(g, 1.6, 1.9, 2.2), h: byD(g, 0.9, 1.1, 1.3), d: byD(g, 0.7, 0.85, 1.0) };
  const SLANT = 0.22; // diagonal: x shifts by +-SLANT between the top and bottom of the room
  let L;
  const roll = () => {
    const v = () => g.r.float(0.85, 1.15);
    L = { t0: g.r.float(0, 6), gr: base.gap * v(), h0: g.r.float(0, 6), hr: base.h * v(), d0: g.r.float(0, 6), dr: base.d * v(), dir: g.r.chance(0.5) ? 1 : -1 };
  };
  roll();
  let passed = 0;
  const gapAt = (t) => 0.06 + 0.5 * (0.5 + 0.5 * Math.sin(L.t0 + (t / 1000) * L.gr)); // 0.06..0.56
  const hyAt = (t) => 0.5 + 0.47 * Math.sin(L.h0 + (t / 1000) * L.hr); // 0.03..0.97
  const dxAt = (t) => 0.5 + 0.95 * Math.sin(L.d0 + (t / 1000) * L.dr); // centre x, sweeps fully off both sides
  const dLine = (cx) => [cx + L.dir * SLANT, cx - L.dir * SLANT]; // x at top (y=0) and bottom (y=1)
  const hits = (t) => {
    if (gapAt(t) < body) return 'sliced';
    const hy = hyAt(t);
    if (hy > by0 - 0.03 && hy < by1 + 0.03) return 'sliced';
    const [x0, x1] = dLine(dxAt(t));
    const xa = x0 + (x1 - x0) * by0, xb = x0 + (x1 - x0) * by1;
    if (Math.max(xa, xb) > bx0 - 0.02 && Math.min(xa, xb) < bx1 + 0.02) return 'sliced';
    return null;
  };
  g.loop((dt, t) => {
    const gap = gapAt(t);
    a.style.left = (0.5 - gap / 2) * 100 + '%';
    b.style.left = (0.5 + gap / 2) * 100 + '%';
    hb.style.top = hyAt(t) * 100 + '%';
    const [x0, x1] = dLine(dxAt(t));
    diag.setAttribute('x1', x0 * 100); diag.setAttribute('y1', 0);
    diag.setAttribute('x2', x1 * 100); diag.setAttribute('y2', 100);
  });
  const go = g.btn('DIVE!', () => {
    const why = hits(g.elapsed);
    if (why) return g.lose(why);
    passed++;
    roll();
    if (passed >= need) g.win();
    else g.dollar(go);
  }, 'good lt-go');
  g.stage.append(h('div', { class: 'lt-room' }, bodyEl, a, b, hb, svg), h('div', { class: 'lt-label' }, 'ESCAPE!'), go);
  return g.handle();
}
