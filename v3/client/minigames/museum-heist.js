// MG-26 Museum Heist: memorise the real artifact, then pick it out from the decoys.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'museum-heist', name: 'Museum Heist', tags: ['classic'], baseDurationMs: 12000 };

const ART = ['🏺', '🗿', '👑', '💎', '🖼️', '🦴', '⚱️', '🪆', '🎻', '🕰️'];
const TINTS = ['none', 'hue-rotate(120deg)', 'hue-rotate(220deg)', 'grayscale(1)', 'sepia(1)', 'invert(.85)'];

css('mg-museum', `
.mh-show{text-align:center;margin-top:20px}.mh-show .mh-art{font-size:110px;line-height:1.1}
.mh-remember{font:900 28px system-ui,sans-serif;letter-spacing:.14em;color:var(--gold,#ffd84d);text-shadow:0 0 10px var(--gold,#ffd84d)66;margin-top:14px}
.mh-grid{display:grid;gap:10px}
.mh-grid .hh-btn{font-size:46px;min-height:84px;background:#2a2116;box-shadow:0 0 0 3px #8a6a2b inset,0 4px 0 #120d07}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Memorise the real artifact', timeMs: 12000 });
  const n = byD(g, 6, 9, 12);
  const art = g.r.pick(ART);
  const tint = g.r.int(TINTS.length);
  const rot = g.d === 3 ? g.r.pick([0, 15, -15]) : 0;
  const show = h('div', { class: 'mh-show' }, h('div', { class: 'mh-art', style: { filter: TINTS[tint], transform: `rotate(${rot}deg)` } }, art),
    h('div', { class: 'mh-remember hh-label' }, 'REMEMBER!'));
  g.stage.append(show);
  g.after(byD(g, 2000, 1600, 1300), () => {
    show.remove();
    g.hint('Which one is real?');
    const items = [{ a: art, t: tint, r: rot, real: true }];
    const seen = new Set([art + tint + rot]);
    while (items.length < n) {
      const sameArt = g.d >= 2 ? g.r.chance(0.7) : g.r.chance(0.4);
      const it = { a: sameArt ? art : g.r.pick(ART), t: g.r.int(TINTS.length), r: g.d === 3 ? g.r.pick([0, 15, -15]) : 0, real: false };
      const k = it.a + it.t + it.r;
      if (!seen.has(k)) { seen.add(k); items.push(it); }
    }
    let realBtn = null;
    const grid = h('div', { class: 'mh-grid', style: { gridTemplateColumns: `repeat(3,1fr)` } }, g.r.shuffle(items).map((it) => {
      const b = g.btn('', () => {
        if (it.real) { g.dollar(b); g.win(); } else g.lose('stole a fake', null, { good: realBtn, bad: b });
      });
      b.append(h('span', { style: { filter: TINTS[it.t], display: 'inline-block', transform: `rotate(${it.r}deg)` } }, it.a));
      if (it.real) realBtn = b;
      return b;
    }));
    g.stage.append(grid);
  });
  return g.handle();
}
