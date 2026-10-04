// MG-07 Encryption Breaker, v2: centred and bigger, with a static cipher key (no rotation). Wrong letters reveal the right one; a clean decode rains Matrix code.
import { game, h, css, byD, SYMBOLS } from '../fx/kit.js';

export const meta = { id: 'encryption-breaker', name: 'Encryption Breaker', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-encryption', `
.eb-wrap{display:flex;flex-direction:column;justify-content:center;height:100%;gap:12px}
.eb-key{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.eb-key span{background:#000;border:2px solid var(--line,#2a3555);border-radius:10px;padding:5px 10px;font:800 22px ui-monospace,monospace}
.eb-key span em{font-style:normal;color:var(--gold,#ffd84d);margin-right:6px;font-size:24px}
.eb-word{display:flex;gap:10px;justify-content:center}
.eb-word span{width:58px;height:68px;border-radius:12px;background:var(--panel,#16213a);display:flex;align-items:center;justify-content:center;font-size:36px;border:3px solid var(--line,#2a3555)}
.eb-word span.now{border-color:var(--gold,#ffd84d)}.eb-word span.ok{border-color:#3dff9a;color:#3dff9a;font-family:ui-monospace,monospace}
.eb-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.eb-opts .hh-btn{font:900 30px ui-monospace,monospace;min-height:62px}
`);

export function mount(container, opts) {
  let optButtons = [], map = {}, word = [], i = 0;
  const right = () => optButtons.find((b) => b.dataset.l === map[word[i]]);
  const g = game(container, opts, {
    id: meta.id, title: meta.name, hint: 'Decode the highlighted symbol', timeMs: 13000,
    onTimeout: () => g.lose('timeout', null, { good: right() }),
  });
  const pairs = byD(g, 4, 5, 6);
  const syms = g.r.sample(SYMBOLS, pairs);
  const letters = g.r.sample('ABCDEFGHKMNPRSTUVWXZ'.split(''), pairs);
  map = Object.fromEntries(syms.map((s, k) => [s, letters[k]]));
  word = Array.from({ length: byD(g, 3, 4, 5) }, () => g.r.pick(syms));
  const keyBox = h('div', { class: 'eb-key' });
  const drawKey = () => keyBox.replaceChildren(...syms.map((s) => h('span', {}, h('em', {}, s), map[s])));
  const cells = word.map((s) => h('span', {}, s));
  const optsBox = h('div', { class: 'eb-opts' });
  const drawOpts = () => {
    cells.forEach((c, k) => { c.className = k < i ? 'ok' : k === i ? 'now' : ''; });
    optButtons = g.r.shuffle(Object.values(map)).map((L) => {
      const b = g.btn(L, () => {
        if (L !== map[word[i]]) return g.lose('decryption failed', null, { good: right(), bad: b });
        cells[i].textContent = L;
        i++;
        if (i >= word.length) return g.win(null, null, { matrix: true });
        drawOpts();
      }, 'alt');
      b.dataset.l = L;
      return b;
    });
    optsBox.replaceChildren(...optButtons);
  };
  // The cipher key and the symbol word stay static for the whole round; difficulty scales via key size and word length.
  drawKey();
  drawOpts();
  g.stage.append(h('div', { class: 'eb-wrap' }, keyBox, h('div', { class: 'eb-word' }, cells), optsBox));
  return g.handle();
}
