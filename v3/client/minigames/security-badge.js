// MG-24 Security Badge: match each stolen badge to the door with the same lock.
import { game, h, css, byD, SYMBOLS, COLORS } from '../fx/kit.js';

export const meta = { id: 'security-badge', name: 'Security Badge', tags: ['classic'], baseDurationMs: 12000 };

css('mg-badge', `
.sb-badge{margin:0 auto 14px;width:150px;padding:10px;border-radius:12px;background:var(--ink,#e9f1ff);color:var(--on-accent,#0b0f1a);text-align:center;font-weight:800;box-shadow:0 6px 0 var(--dim,#9fb0d6)}
.sb-badge b{display:block;font-size:46px;line-height:1.1}
.sb-doors{display:grid;gap:10px}
.sb-doors .hh-btn{min-height:84px;font-size:36px;background:#3b2a1a;box-shadow:0 0 0 3px #8a5a2b inset,0 4px 0 #1d140c;color:#fff}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap the door that matches the badge', timeMs: 12000 });
  const doorsN = byD(g, 3, 4, 6), matches = byD(g, 3, 4, 5);
  const keys = [];
  for (let i = 0; i < doorsN; i++) keys.push({ s: SYMBOLS[i], c: COLORS[i % COLORS.length] });
  // At difficulty 3 decoy doors share the symbol but not the colour.
  if (g.d === 3) { keys[4] = { s: keys[0].s, c: COLORS[3] }; keys[5] = { s: keys[1].s, c: COLORS[4] }; }
  const badge = h('div', { class: 'sb-badge' });
  const doors = h('div', { class: 'sb-doors', style: { gridTemplateColumns: `repeat(${doorsN > 3 ? 3 : doorsN},1fr)` } });
  let done = 0, want;
  const next = () => {
    want = g.r.int(doorsN);
    badge.replaceChildren('EMPLOYEE', h('b', { style: { color: keys[want].c } }, keys[want].s), 'ACCESS');
    const order = g.r.shuffle([...keys.keys()]);
    const btns = [];
    doors.replaceChildren(...order.map((k) => {
      const b = g.btn(keys[k].s, () => {
        if (k !== want) return g.lose('wrong door, alarm!', null, { good: btns[want], bad: b });
        done++;
        if (done >= matches) g.win(null, null, { matrix: true }); else next();
      });
      b.style.color = keys[k].c;
      btns[k] = b;
      return b;
    }));
  };
  next();
  g.stage.append(badge, doors);
  return g.handle();
}
