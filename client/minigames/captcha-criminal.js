// MG-13 CAPTCHA Criminal: prove you're a robot... er, human. Select every matching picture, then VERIFY.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'captcha-criminal', name: 'CAPTCHA Criminal', tags: ['cyber'], baseDurationMs: 12000 };

const SETS = [
  ['SAFES', '🔒', ['🔑', '🚪', '🧳', '💼', '📦', '🗄️']],
  ['GUARDS', '💂', ['👮', '🕵️', '🧑‍🍳', '🤵', '👷', '🧙']],
  ['DIAMONDS', '💎', ['🔷', '🧊', '💠', '🔹', '🪩', '⭐']],
  ['MONEY BAGS', '💰', ['👜', '🎒', '🛍️', '💼', '🧺', '📦']],
  ['GETAWAY CARS', '🚗', ['🚕', '🚙', '🚓', '🚌', '🚑', '🛻']],
  ['DONUTS (for the guards)', '🍩', ['🥯', '🍪', '🥨', '🧁', '🍰', '🥐']],
];

css('mg-captcha', `
.cc-head{background:#4dd2ff;color:#0b0f1a;border-radius:10px 10px 0 0;padding:8px 12px;font-weight:800}
.cc-head b{display:block;font-size:22px}
.cc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:#e9f1ff;padding:4px}
.cc-grid .hh-btn{font-size:38px;min-height:70px;background:#fff;box-shadow:none;border-radius:4px}
.cc-grid .hh-btn.sel{outline:5px solid #4dd2ff;outline-offset:-5px;background:#d9f4ff}
.cc-foot{display:flex;justify-content:space-between;align-items:center;background:#e9f1ff;border-radius:0 0 10px 10px;padding:6px 8px;color:#0b0f1a;font-size:13px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'I am definitely not a robot', timeMs: 14000 });
  const rounds = byD(g, 1, 2, 2);
  const sets = g.r.sample(SETS, rounds);
  let r = 0;
  const box = h('div');
  g.stage.append(box);
  const next = () => {
    const [label, icon, decoys] = sets[r];
    const hits = byD(g, 3, 3, 4);
    const cells = g.r.shuffle([...Array(hits).fill(icon), ...g.r.sample(g.d === 3 ? decoys : decoys.slice(0, 4), 9 - hits).concat(decoys).slice(0, 9 - hits)]);
    const sel = new Set();
    const grid = h('div', { class: 'cc-grid' }, cells.map((c, i) => g.btn(c, (e, b) => {
      if (sel.has(i)) sel.delete(i); else sel.add(i);
      b.classList.toggle('sel');
    })));
    const verify = g.btn('VERIFY', () => {
      const ok = cells.every((c, i) => (c === icon) === sel.has(i));
      if (!ok) return g.lose('robot detected');
      r++;
      if (r >= rounds) g.win(); else { g.status('Hmm. One more, just to be sure.', '#4dd2ff'); next(); }
    }, 'alt');
    box.replaceChildren(h('div', { class: 'cc-head' }, 'Select all squares with', h('b', {}, label)), grid,
      h('div', { class: 'cc-foot' }, h('span', {}, '☑️ reCRAPTCHA'), verify));
  };
  next();
  return g.handle();
}
