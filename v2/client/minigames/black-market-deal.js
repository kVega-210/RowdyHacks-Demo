// MG-40 Black Market Deal, v2: pick a briefcase (big case tiles filled with the risk colour), then close the deal with
// the Buyer: remember the price, shake on the right one. Wrong answers reveal the right price.
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
    title: 'Black Market Deal', prompt: 'Three briefcases. Mystery contents.', timeoutMs: 5000, layout: 'tiles',
    options: tierOptions(opts, [
      { tier: '1', label: 'Battered case', icon: '💼', iconStyle: 'sepia(.9) brightness(.75)', cash: '$', risk: 'safe' },
      { tier: '2', label: 'Chrome case', icon: '💼', iconStyle: 'grayscale(1) brightness(1.5) contrast(1.2)', cash: '$$', risk: 'risky' },
      { tier: '3', label: 'Gold case', icon: '💼', iconStyle: 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.15)', cash: '$$$', risk: 'wild' },
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
    g.stage.append(h('div', { class: 'bmd-dealer' }, h('div', {}, '🕴️'), 'Buyer: "My price is..."'), priceEl);
    g.hint('Remember the price!');
    g.after([1800, 1400, 1000][tier - 1] * byD(g, 1.1, 1, 0.9), () => {
      priceEl.textContent = '$???';
      g.hint('Shake on the right price');
      const buttons = [];
      const grid = h('div', { class: 'bmd-opts' }, g.r.shuffle([...set]).map((p) => {
        const b = g.btn('$' + p, () => {
          if (p === price) { g.dollar(b); return g.win(null, { wager }); }
          const right = buttons.find((x) => x.dataset.p === String(price));
          priceEl.textContent = '$' + price;
          g.lose('the buyer walked', { wager }, { good: right, bad: b });
        }, 'alt');
        b.dataset.p = String(p);
        buttons.push(b);
        return b;
      }));
      g.stage.append(grid);
    });
  }
  return { destroy() { chooser.destroy(); g.destroy(); } };
}
