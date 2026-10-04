// MG-40 Black Market Deal: pick a briefcase (riskier pays more), then close the deal: remember the dealer's price.
import { game, h, css, byD, tierOptions } from '../fx/kit.js';
import { choose } from '../wagers/chooser.js';

export const meta = { id: 'black-market-deal', name: 'Black Market Deal', tags: ['classic', 'choice'], baseDurationMs: 14000 };

css('mg-bmd', `
.bmd-dealer{text-align:center;margin-top:10px}.bmd-dealer div{font-size:80px}
.bmd-price{text-align:center;font:900 40px ui-monospace,monospace;color:#3dff9a;min-height:50px}
.bmd-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px}
.bmd-opts .hh-btn{font:900 24px ui-monospace,monospace;min-height:60px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Choose a briefcase', timeMs: 15000 });
  let wager = null;
  const chooser = choose(g.stage, {
    title: 'Black Market Deal', prompt: 'Three briefcases. Mystery contents.', timeoutMs: 5000,
    options: tierOptions(opts, [
      { tier: '1', label: '💼 Battered case', blurb: 'Small deal. Easy haggle.', risk: 'safe' },
      { tier: '2', label: '💼 Chrome case', blurb: 'Serious buyer. Sharper memory needed.', risk: 'risky' },
      { tier: '3', label: '💼 Gold case', blurb: 'Kingpin deal. One look, no mistakes.', risk: 'wild' },
    ]),
    onPick(o) { wager = { tier: o.tier }; start(Number(o.tier)); },
  });
  function start(tier) {
    const digits = [3, 4, 5][tier - 1];
    const lo = 10 ** (digits - 1);
    const price = g.r.range(lo, lo * 10 - 1);
    const nOpts = [4, 4, 6][tier - 1];
    const set = new Set([price]);
    while (set.size < nOpts) {
      const s = String(price).split('');
      const i = g.r.int(s.length);
      s[i] = String((+s[i] + 1 + g.r.int(8)) % 10);
      if (s[0] !== '0') set.add(+s.join(''));
    }
    const priceEl = h('div', { class: 'bmd-price' }, '$' + price);
    g.stage.append(h('div', { class: 'bmd-dealer' }, h('div', {}, '🕴️'), 'Dealer: "My price is..."'), priceEl);
    g.hint('Remember the price!');
    g.after([1800, 1400, 1000][tier - 1] * byD(g, 1.1, 1, 0.9), () => {
      priceEl.textContent = '$???';
      g.hint('Shake on the right price');
      g.stage.append(h('div', { class: 'bmd-opts' }, g.r.shuffle([...set]).map((p) =>
        g.btn('$' + p, () => (p === price ? g.win(null, { wager }) : g.lose('the dealer walked', { wager })), 'alt'))));
    });
  }
  return { destroy() { chooser.destroy(); g.destroy(); } };
}
