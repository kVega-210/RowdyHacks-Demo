// MG-32 Evidence Cleanup: wipe every clue marked with your crew colour; leave everyone else's mess alone.
import { game, h, css, byD, COLORS } from '../fx/kit.js';

export const meta = { id: 'evidence-cleanup', name: 'Evidence Cleanup', tags: ['classic'], baseDurationMs: 12000 };

const CLUES = ['🧤', '👣', '🔦', '🧾', '🔑', '🕶️', '📱', '🧢'];

css('mg-evidence', `
.ev-you{text-align:center;margin-bottom:6px;font:900 30px system-ui,sans-serif;letter-spacing:.14em;color:#ff5c7a;text-shadow:0 0 10px #ff224466}
.ev-you b{display:inline-block;width:30px;height:30px;border-radius:50%;vertical-align:-4px;margin-left:10px;box-shadow:0 0 0 3px #fff}
.ev-floor{position:absolute;left:0;right:0;top:50px;bottom:0;border-radius:12px;background:#2a2116;overflow:hidden}
.ev-item{position:absolute;width:64px;height:64px;padding:0;font-size:32px;border-radius:50%;background:#000a;margin:-32px 0 0 -32px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap only clues ringed in YOUR colour', timeMs: 12000 });
  const mine = g.r.int(COLORS.length);
  const others = COLORS.map((_, i) => i).filter((i) => i !== mine);
  const nMine = byD(g, 4, 5, 6), nOther = byD(g, 3, 5, 7);
  const floor = h('div', { class: 'ev-floor' });
  let left = nMine;
  const items = [];
  for (let i = 0; i < nMine + nOther; i++) {
    const own = i < nMine;
    const c = own ? mine : g.r.pick(g.d === 3 ? others.slice(0, 2) : others);
    const b = g.btn(g.r.pick(CLUES), () => {
      if (!own) return g.lose('wiped the wrong evidence');
      b.remove();
      if (--left === 0) g.win();
    }, 'ev-item');
    b.style.boxShadow = `0 0 0 4px ${COLORS[c]}`;
    const it = { b, x: g.r.float(0.12, 0.88), y: g.r.float(0.12, 0.88), vx: g.r.float(-1, 1) * 0.08 * (g.d - 1), vy: g.r.float(-1, 1) * 0.08 * (g.d - 1) };
    items.push(it);
    floor.append(b);
  }
  g.loop((dt) => {
    for (const it of items) {
      it.x += it.vx * dt; it.y += it.vy * dt;
      if (it.x < 0.1 || it.x > 0.9) it.vx *= -1;
      if (it.y < 0.1 || it.y > 0.9) it.vy *= -1;
      it.b.style.left = it.x * 100 + '%';
      it.b.style.top = it.y * 100 + '%';
    }
  });
  g.stage.append(h('div', { class: 'ev-you' }, 'DELETE!', h('b', { style: { background: COLORS[mine] } })), floor);
  return g.handle();
}
