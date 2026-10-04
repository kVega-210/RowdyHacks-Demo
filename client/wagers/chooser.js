// CL-10 reusable pick-a-tier / briefcase chooser. Used by Password Roulette, Backdoor, Black Market Deal
// and the wager wrappers. choose(container, {...}) -> {destroy}. Calls onPick exactly once.
import { h, css } from '../fx/kit.js';

css('hh-chooser', `
.hh-choose{position:absolute;inset:0;display:flex;flex-direction:column;gap:10px;padding:12px;background:#070a12ee;z-index:20;
  color:#e9f1ff;font:16px system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none}
.hh-choose h2{margin:4px 0 0;text-align:center;color:#ffd84d;font-size:22px;letter-spacing:.05em;text-transform:uppercase}
.hh-choose p{margin:0;text-align:center;opacity:.85}
.hh-choose .opts{flex:1;display:grid;gap:10px;grid-auto-rows:1fr}
.hh-choose .opt{border:3px solid #2a3555;border-radius:16px;background:#121a2e;color:inherit;font:inherit;text-align:left;padding:12px 14px;
  display:flex;flex-direction:column;justify-content:center;gap:4px;touch-action:manipulation}
.hh-choose .opt b{font-size:22px}
.hh-choose .opt.safe{border-color:#3dff9a}.hh-choose .opt.risky{border-color:#ff9f43}.hh-choose .opt.wild{border-color:#ff5c7a}
.hh-choose .opt .mult{font-weight:900;color:#ffd84d}
.hh-choose .opt.picked{transform:scale(1.03);background:#22304f}
.hh-choose .bar{height:6px;background:#1e2840;border-radius:3px;overflow:hidden}.hh-choose .bar i{display:block;height:100%;background:#ffd84d;transform-origin:left}
`);

/**
 * options: [{tier, label, blurb, risk:'safe'|'risky'|'wild', payoutMult?, failPenaltyMult?}]
 * timeoutMs: real milliseconds before the default (first) option is picked automatically.
 */
export function choose(container, { title = 'Choose', prompt = '', options, timeoutMs = 8000, onPick }) {
  let done = false;
  const bar = h('i');
  const pick = (opt, el) => {
    if (done) return;
    done = true;
    clearInterval(iv);
    if (el) el.classList.add('picked');
    setTimeout(() => { root.remove(); onPick(opt); }, 250);
  };
  const cards = options.map((o) => {
    const el = h('button', { class: 'opt hh-ctl ' + (o.risk || 'safe'), type: 'button' },
      h('b', {}, o.label),
      o.blurb ? h('span', {}, o.blurb) : null,
      o.payoutMult ? h('span', { class: 'mult' }, `x${o.payoutMult} cash · fail x${o.failPenaltyMult || 1}`) : null);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); pick(o, el); });
    return el;
  });
  const root = h('div', { class: 'hh-choose' }, h('h2', {}, title), prompt ? h('p', {}, prompt) : null,
    h('div', { class: 'opts' }, cards), h('div', { class: 'bar' }, bar));
  container.append(root);
  const t0 = performance.now();
  const iv = setInterval(() => {
    const f = Math.max(0, 1 - (performance.now() - t0) / timeoutMs);
    bar.style.transform = `scaleX(${f})`;
    if (f <= 0) pick(options[0], cards[0]);
  }, 100);
  return { destroy() { done = true; clearInterval(iv); root.remove(); } };
}
