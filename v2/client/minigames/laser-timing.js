// MG-27 Laser Timing: two lasers slide back and forth; tap DIVE when the opening is wider than you.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'laser-timing', name: 'Laser Timing', tags: ['classic'], baseDurationMs: 12000 };

css('mg-laser-timing', `
.lt-room{position:relative;height:180px;border-radius:12px;background:#05070d;border:2px solid #2a3555;overflow:hidden;margin:6px 0 10px}
.lt-beam{position:absolute;top:0;bottom:0;width:6px;margin-left:-3px;background:#ff2244;box-shadow:0 0 14px #ff2244}
.lt-body{position:absolute;bottom:6px;height:22px;border-radius:6px;background:#3dff9a44;border:2px dashed #3dff9a}
.lt-count{text-align:center;font-weight:900;font-size:20px}
.lt-go{display:block;margin:6px auto 0;width:80%;height:64px;font-size:26px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'DIVE when the gap is wider than the green box', timeMs: 12000 });
  const need = byD(g, 1, 2, 3);
  const body = byD(g, 0.24, 0.26, 0.28);
  const a = h('div', { class: 'lt-beam' }), b = h('div', { class: 'lt-beam' });
  const bodyEl = h('div', { class: 'lt-body', style: { left: (0.5 - body / 2) * 100 + '%', width: body * 100 + '%' } });
  const count = h('div', { class: 'lt-count' });
  let passed = 0, t0 = g.r.float(0, 6);
  const rate = byD(g, 1.6, 1.9, 2.2);
  const gapAt = (t) => 0.06 + 0.5 * (0.5 + 0.5 * Math.sin(t0 + (t / 1000) * rate)); // 0.06..0.56
  g.loop((dt, t) => {
    const gap = gapAt(t);
    a.style.left = (0.5 - gap / 2) * 100 + '%';
    b.style.left = (0.5 + gap / 2) * 100 + '%';
    count.textContent = `Rooms cleared ${passed}/${need}`;
  });
  const go = g.btn('DIVE', () => {
    if (gapAt(g.elapsed) < body) return g.lose('sliced');
    passed++;
    t0 = g.r.float(0, 6);
    if (passed >= need) g.win();
  }, 'good lt-go');
  g.stage.append(count, h('div', { class: 'lt-room' }, a, b, bodyEl), go);
  return g.handle();
}
