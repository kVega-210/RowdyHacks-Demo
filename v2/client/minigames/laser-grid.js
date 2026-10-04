// MG-20 Laser Grid: drag the thief from the bottom to the vault at the top without touching a beam.
import { game, h, css, byD, drag } from '../fx/kit.js';

export const meta = { id: 'laser-grid', name: 'Laser Grid', tags: ['classic'], baseDurationMs: 12000 };

css('mg-laser-grid', `
.lg-field{position:absolute;inset:0 0 40px;background:#05070d;border:2px solid #2a3555;border-radius:12px;overflow:hidden;touch-action:none}
.lg-goal{position:absolute;left:0;right:0;top:0;height:9%;background:#3dff9a33;border-bottom:2px dashed #3dff9a;display:flex;align-items:center;justify-content:center;font-size:28px;line-height:1}
.lg-beam{position:absolute;height:6px;background:#ff2244;box-shadow:0 0 10px #ff2244,0 0 2px #fff;border-radius:3px}
.lg-dot{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;font-size:30px;line-height:34px;text-align:center;filter:drop-shadow(0 0 6px #ffd84d)}
.lg-label{position:absolute;left:0;right:0;bottom:0;height:34px;line-height:34px;text-align:center;font:900 24px/34px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;text-shadow:0 0 10px #ff224466}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Drag to the vault. Do not touch the lasers!', timeMs: 12000 });
  const field = h('div', { class: 'lg-field hh-ctl' }, h('div', { class: 'lg-goal', text: '💰' }));
  const dot = h('div', { class: 'lg-dot' }, '🥷');
  field.append(dot);
  g.stage.append(field, h('div', { class: 'lg-label' }, 'ESCAPE!'));
  const rows = byD(g, 3, 4, 5);
  const gapW = byD(g, 0.34, 0.28, 0.24);
  const beams = [];
  for (let i = 0; i < rows; i++) {
    const y = 0.2 + (0.62 * (i + 0.5)) / rows;
    const gap = g.r.float(0.05, 0.95 - gapW);
    const moving = g.d === 3 || (g.d === 2 && i % 2 === 1);
    const a = h('div', { class: 'lg-beam' }), b = h('div', { class: 'lg-beam' });
    field.append(a, b);
    beams.push({ y, gap, a, b, moving, dir: g.r.chance(0.5) ? 1 : -1, v: g.r.float(0.08, 0.16) });
  }
  let x = 0.5, y = 0.94, holding = false;
  const place = () => { dot.style.left = x * 100 + '%'; dot.style.top = y * 100 + '%'; };
  place();
  drag(g, field, {
    onStart(px, py) { const r = field.getBoundingClientRect(); holding = Math.hypot(px / r.width - x, py / r.height - y) < 0.2; },
    onMove(px, py) {
      if (!holding) return;
      const r = field.getBoundingClientRect();
      x = Math.max(0.03, Math.min(0.97, px / r.width));
      y = Math.max(0.02, Math.min(0.98, py / r.height));
      place();
    },
    onEnd() { holding = false; },
  });
  g.loop((dt) => {
    const r = field.getBoundingClientRect();
    const rx = 14 / Math.max(1, r.width), ry = 14 / Math.max(1, r.height);
    for (const bm of beams) {
      if (bm.moving) {
        bm.gap += bm.dir * bm.v * dt;
        if (bm.gap < 0.02 || bm.gap > 0.98 - gapW) bm.dir *= -1;
      }
      bm.a.style.cssText = `left:0;top:${bm.y * 100}%;width:${bm.gap * 100}%`;
      bm.b.style.cssText = `left:${(bm.gap + gapW) * 100}%;top:${bm.y * 100}%;right:0`;
      const by = bm.y + 3 / Math.max(1, r.height);
      if (Math.abs(y - by) < ry + 3 / Math.max(1, r.height) && (x - rx < bm.gap || x + rx > bm.gap + gapW)) return g.lose('zapped');
    }
    if (y < 0.09) g.win();
  });
  return g.handle();
}
