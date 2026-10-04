// MG-07 Encryption Breaker: use the cipher key to decode each symbol before the cipher rotates.
import { game, h, css, byD, SYMBOLS } from '../fx/kit.js';

export const meta = { id: 'encryption-breaker', name: 'Encryption Breaker', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-encryption', `
.eb-key{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:10px}
.eb-key span{background:#000;border:2px solid #2a3555;border-radius:8px;padding:4px 8px;font:800 18px ui-monospace,monospace}
.eb-key span em{font-style:normal;color:#ffd84d;margin-right:6px}
.eb-word{display:flex;gap:8px;justify-content:center;margin:6px 0 12px}
.eb-word span{width:48px;height:56px;border-radius:10px;background:#16213a;display:flex;align-items:center;justify-content:center;font-size:28px;border:2px solid #2a3555}
.eb-word span.now{border-color:#ffd84d}.eb-word span.ok{border-color:#3dff9a;color:#3dff9a;font-family:ui-monospace,monospace}
.eb-opts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.eb-opts .hh-btn{font:900 24px ui-monospace,monospace}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Decode the highlighted symbol', timeMs: 13000 });
  const pairs = byD(g, 4, 5, 6);
  const syms = g.r.sample(SYMBOLS, pairs);
  const letters = g.r.sample('ABCDEFGHKMNPRSTUVWXZ'.split(''), pairs);
  let map = Object.fromEntries(syms.map((s, i) => [s, letters[i]]));
  const word = Array.from({ length: byD(g, 3, 4, 5) }, () => g.r.pick(syms));
  const keyBox = h('div', { class: 'eb-key' });
  const drawKey = () => keyBox.replaceChildren(...syms.map((s) => h('span', {}, h('em', {}, s), map[s])));
  const cells = word.map((s) => h('span', {}, s));
  let i = 0;
  const optsBox = h('div', { class: 'eb-opts' });
  const drawOpts = () => {
    cells.forEach((c, k) => { c.className = k < i ? 'ok' : k === i ? 'now' : ''; });
    optsBox.replaceChildren(...g.r.shuffle(Object.values(map)).map((L) =>
      g.btn(L, () => {
        if (L !== map[word[i]]) return g.lose('decryption failed');
        cells[i].textContent = L;
        i++;
        if (i >= word.length) return g.win();
        drawOpts();
      }, 'alt')));
  };
  drawKey();
  drawOpts();
  if (g.d >= 2) {
    g.every(byD(g, 0, 5000, 3500), () => {
      const vals = g.r.shuffle(Object.values(map));
      map = Object.fromEntries(syms.map((s, k) => [s, vals[k]]));
      drawKey();
      drawOpts();
      g.status('CIPHER ROTATED', '#ff9f43');
    });
  }
  g.stage.append(keyBox, h('div', { class: 'eb-word' }, cells), optsBox);
  return g.handle();
}
