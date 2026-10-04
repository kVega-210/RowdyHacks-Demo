// MG-08 Password Roulette: pick a password tier (harder pays more, fails harder), then type it in time.
import { game, h, css, byD, tierOptions } from '../fx/kit.js';
import { choose } from '../wagers/chooser.js';

export const meta = { id: 'password-roulette', name: 'Password Roulette', tags: ['cyber', 'choice'], baseDurationMs: 14000 };

css('mg-password-roulette', `
.pr-show{text-align:center;font:900 30px ui-monospace,monospace;letter-spacing:.12em;color:#ffd84d;margin:6px 0}
.pr-typed{text-align:center;font:900 26px ui-monospace,monospace;letter-spacing:.12em;min-height:34px;color:#3dff9a;margin-bottom:10px}
.pr-pad{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.pr-pad .hh-btn{font:900 22px ui-monospace,monospace}
`);

const CHARS = 'AB3XK7Q#9!ZM'.split('');

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Pick your password. Harder pays more.', timeMs: 15000 });
  const options = tierOptions(opts, [
    { tier: '1', label: 'Weak: 3 chars', blurb: 'Easy money.', risk: 'safe' },
    { tier: '2', label: 'Strong: 5 chars', blurb: 'Bigger cut, bigger fine.', risk: 'risky' },
    { tier: '3', label: 'Paranoid: 7 chars', blurb: 'Jackpot or jail.', risk: 'wild' },
  ]);
  let wager = null;
  const chooser = choose(g.stage, {
    title: 'Password Roulette', prompt: 'Choose your password', options, timeoutMs: 5000,
    onPick(o) {
      wager = { tier: o.tier };
      start(Number(o.tier));
    },
  });
  function start(tier) {
    const len = [3, 5, 7][tier - 1];
    const keys = g.r.sample(CHARS, byD(g, 8, 8, 12));
    const pw = Array.from({ length: len }, () => g.r.pick(keys)).join('');
    let typed = '';
    const show = h('div', { class: 'pr-show' }, pw);
    const out = h('div', { class: 'pr-typed' }, '_'.repeat(len));
    const pad = h('div', { class: 'pr-pad' }, (g.d === 3 ? g.r.shuffle(keys) : keys).map((c) => g.btn(c, () => {
      if (c !== pw[typed.length]) return g.lose('wrong password', { wager });
      typed += c;
      out.textContent = typed + '_'.repeat(len - typed.length);
      if (typed.length === len) g.win(null, { wager });
    }, 'alt')));
    g.stage.append(show, out, pad);
    g.hint('Type the password');
    if (g.d >= 2) g.after(byD(g, 0, 2500, 1600), () => { show.textContent = '•'.repeat(len); g.hint('From memory!'); });
  }
  return { destroy() { chooser.destroy(); g.destroy(); } };
}
