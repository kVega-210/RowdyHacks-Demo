// MG-04 Code Injection: punch in the shown command sequence, in order, fast.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'code-injection', name: 'Code Injection', tags: ['cyber'], baseDurationMs: 12000 };

const WORDS = ['SUDO', 'PING', 'EXEC', 'GREP', 'KILL', 'ROOT', 'CHMOD', 'CURL', 'SSH', 'DROP', 'PIPE', 'FORK'];

css('mg-code-injection', `
.ci-seq{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:12px}
.ci-seq span{font:800 18px ui-monospace,monospace;padding:6px 10px;border-radius:8px;background:#000;border:2px solid #2a3555;color:#9fb0d6}
.ci-seq span.now{border-color:#ffd84d;color:#ffd84d}.ci-seq span.ok{border-color:#3dff9a;color:#3dff9a}
.ci-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ci-keys .hh-btn{font:800 17px ui-monospace,monospace;min-height:58px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Enter the commands in order', timeMs: 12000 });
  const n = byD(g, 3, 4, 5);
  const keys = g.r.sample(WORDS, byD(g, 6, 9, 9));
  const seq = Array.from({ length: n }, () => g.r.pick(keys));
  const chips = seq.map((w) => h('span', {}, w));
  let i = 0;
  const mark = () => chips.forEach((c, k) => { c.className = k < i ? 'ok' : k === i ? 'now' : ''; });
  mark();
  let order = keys;
  const grid = h('div', { class: 'ci-keys' });
  const render = () => {
    grid.replaceChildren(...order.map((w) => g.btn(w, () => {
      if (w !== seq[i]) return g.lose('syntax error');
      i++;
      mark();
      if (i >= n) return g.win();
      if (g.d === 3) { order = g.r.shuffle(order); render(); }
    }, 'alt')));
  };
  render();
  g.stage.append(h('div', { class: 'ci-seq' }, chips), grid);
  return g.handle();
}
