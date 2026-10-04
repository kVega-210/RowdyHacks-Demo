// MG-28 Disguise Check: memorise the guard's uniform, then pick the matching disguise.
import { game, h, css, byD, COLORS } from '../fx/kit.js';

export const meta = { id: 'disguise-check', name: 'Disguise Check', tags: ['classic'], baseDurationMs: 12000 };

const HATS = ['🎩', '🧢', '👒', '⛑️', '🪖'];
const FACES = ['😎', '🧐', '🥸', '😐', '🤠'];

css('mg-disguise', `
.dc-card{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;padding:4px 8px;line-height:1}
.dc-card .hat{font-size:30px}.dc-card .face{font-size:38px}.dc-card .suit{width:44px;height:22px;border-radius:10px 10px 4px 4px;margin-top:2px}
.dc-show{text-align:center;margin-top:16px}.dc-show .dc-card{transform:scale(1.6);margin:30px}
.dc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.dc-grid .hh-btn{min-height:110px;background:#16213a;box-shadow:0 0 0 2px #2a3555 inset,0 4px 0 #0a0f1c}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Memorise the guard', timeMs: 12000 });
  const card = (o) => h('div', { class: 'dc-card' }, h('div', { class: 'hat' }, HATS[o.h]), h('div', { class: 'face' }, FACES[o.f]),
    h('div', { class: 'suit', style: { background: COLORS[o.c] } }));
  const guard = { h: g.r.int(HATS.length), f: g.r.int(FACES.length), c: g.r.int(COLORS.length) };
  const show = h('div', { class: 'dc-show' }, card(guard), h('div', {}, 'THE GUARD'));
  g.stage.append(show);
  g.after(byD(g, 2200, 1800, 1400), () => {
    show.remove();
    g.hint('Which disguise gets you in?');
    const n = byD(g, 3, 6, 6);
    const opts2 = [guard];
    const key = (o) => `${o.h}${o.f}${o.c}`;
    const seen = new Set([key(guard)]);
    while (opts2.length < n) {
      const o = { ...guard };
      const changes = g.d === 1 ? 2 : 1;
      for (let k = 0; k < changes; k++) {
        const f = g.r.pick(['h', 'f', 'c']);
        o[f] = (o[f] + 1 + g.r.int(4)) % (f === 'c' ? COLORS.length : 5);
      }
      if (!seen.has(key(o))) { seen.add(key(o)); opts2.push(o); }
    }
    g.stage.append(h('div', { class: 'dc-grid' }, g.r.shuffle(opts2).map((o) => {
      const b = g.btn('', () => (o === guard ? g.win() : g.lose('busted by the real guard')));
      b.append(card(o));
      return b;
    })));
  });
  return g.handle();
}
