// MG-08 Password Roulette: type the password shown before time runs out (longer at higher difficulty).
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'password-roulette', name: 'Password Roulette', tags: ['cyber', 'choice'], baseDurationMs: 14000 };

css('mg-password-roulette', `
.pr-show{text-align:center;font:900 30px ui-monospace,monospace;letter-spacing:.12em;color:var(--gold,#ffd84d);margin:6px 0}
.pr-typed{text-align:center;font:900 26px ui-monospace,monospace;letter-spacing:.12em;min-height:34px;color:#3dff9a;margin-bottom:10px}
.pr-pad{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.pr-pad .hh-btn{font:900 22px ui-monospace,monospace}
`);

const CHARS = 'AB3XK7Q#9!ZM'.split('');

export function mount(container, opts) {
  // v2: no tier chooser any more; the password length follows the difficulty and the target always stays visible.
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Type the password', timeMs: 15000,
    onTimeout: () => g.lose('timeout', { wager }, { good: nextKey() }) });
  const tier = g.d;
  const wager = { tier: String(tier) };
  const len = [3, 5, 7][tier - 1];
  const keys = g.r.sample(CHARS, byD(g, 8, 8, 12));
  const pw = Array.from({ length: len }, () => g.r.pick(keys)).join('');
  let typed = '';
  const show = h('div', { class: 'pr-show' }, pw);
  const out = h('div', { class: 'pr-typed' }, '_'.repeat(len));
  const btns = new Map();
  const nextKey = () => btns.get(pw[typed.length]);
  const pad = h('div', { class: 'pr-pad' }, (g.d === 3 ? g.r.shuffle(keys) : keys).map((c) => {
    const b = g.btn(c, () => {
      if (c !== pw[typed.length]) return g.lose('wrong password', { wager }, { good: nextKey(), bad: b });
      typed += c;
      out.textContent = typed + '_'.repeat(len - typed.length);
      if (typed.length === len) g.win(null, { wager }, { matrix: true });
    }, 'alt');
    btns.set(c, b);
    return b;
  }));
  g.stage.append(show, out, pad);
  return g.handle();
}
