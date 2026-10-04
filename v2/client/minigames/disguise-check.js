// MG-28 Disguise Check, v2: the guard is shown near the centre with REMEMBER!, then two rows of near-identical
// candidates (no repeats, the real uniform appears exactly once). Wrong picks reveal the right disguise.
import { game, h, css, byD, COLORS } from '../fx/kit.js';

export const meta = { id: 'disguise-check', name: 'Disguise Check', tags: ['classic'], baseDurationMs: 12000 };

const HATS = ['🎩', '🧢', '👒', '⛑️', '🪖'];
const FACES = ['😎', '🧐', '🥸', '😐', '😏'];

css('mg-disguise', `
.dc-card{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;padding:4px 8px;line-height:1}
.dc-card .hat{font-size:28px}.dc-card .face{font-size:34px}.dc-card .suit{width:40px;height:20px;border-radius:10px 10px 4px 4px;margin-top:2px}
.dc-show{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
.dc-show .dc-card{transform:scale(1.7);margin:34px}
.dc-remember{font:900 28px system-ui,sans-serif;letter-spacing:.14em;color:#ffd84d;text-shadow:0 0 10px #ffd84d66}
.dc-pick{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center}
.dc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%}
.dc-grid .hh-btn{min-height:0;height:96px;padding:2px;background:#16213a;box-shadow:0 0 0 2px #2a3555 inset,0 4px 0 #0a0f1c}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Memorise the guard', timeMs: 12000 });
  const card = (o) => h('div', { class: 'dc-card' }, h('div', { class: 'hat' }, HATS[o.h]), h('div', { class: 'face' }, FACES[o.f]),
    h('div', { class: 'suit', style: { background: COLORS[o.c] } }));
  const guard = { h: g.r.int(HATS.length), f: g.r.int(FACES.length), c: g.r.int(COLORS.length) };
  const show = h('div', { class: 'dc-show' }, card(guard), h('div', { class: 'dc-remember' }, 'REMEMBER!'));
  g.stage.append(show);
  g.after(byD(g, 2200, 1800, 1400), () => {
    show.remove();
    g.hint('Which disguise gets you in?');
    // v2: one extra row of similar candidates (6 / 9 / 9).
    const n = byD(g, 6, 9, 9);
    const cands = [guard];
    const key = (o) => `${o.h}${o.f}${o.c}`;
    const seen = new Set([key(guard)]);
    for (let tries = 0; cands.length < n && tries < 2000; tries++) {
      const o = { ...guard };
      const changes = g.d === 1 ? 2 : 1;
      for (let k = 0; k < changes; k++) {
        const f = g.r.pick(['h', 'f', 'c']);
        o[f] = (o[f] + 1 + g.r.int(4)) % (f === 'c' ? COLORS.length : 5);
      }
      if (!seen.has(key(o))) { seen.add(key(o)); cands.push(o); }
    }
    const buttons = [];
    let right = null;
    for (const o of g.r.shuffle(cands)) {
      const b = g.btn('', () => (o === guard ? g.win() : g.lose('busted by the real guard', null, { good: right, bad: b })));
      b.append(card(o));
      if (o === guard) right = b;
      buttons.push(b);
    }
    g.stage.append(h('div', { class: 'dc-pick' }, h('div', { class: 'dc-grid' }, buttons)));
  });
  return g.handle();
}
