// MG-02 Password Cracker: read the clues, tap the only password that satisfies all of them.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'password-cracker', name: 'Password Cracker', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-password-cracker', `
.pc-clues{background:#000;border:2px solid #2a3555;border-radius:12px;padding:10px 14px;margin-bottom:12px;font:600 16px ui-monospace,monospace;color:#3dff9a}
.pc-clues div:before{content:'> ';color:#4dd2ff}
.pc-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:0 0 10px;text-shadow:0 0 10px #ff224466}
.pc-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.pc-opts .hh-btn{font:900 26px ui-monospace,monospace;letter-spacing:.15em;min-height:62px}
`);

const CLUES = [
  ['starts with an even digit', (p) => +p[0] % 2 === 0],
  ['starts with an odd digit', (p) => +p[0] % 2 === 1],
  ['contains a 7', (p) => p.includes('7')],
  ['has no 7 in it', (p) => !p.includes('7')],
  ['ends with a digit above 4', (p) => +p[p.length - 1] > 4],
  ['ends with a digit of 4 or less', (p) => +p[p.length - 1] <= 4],
  ['digits add up to an even number', (p) => [...p].reduce((a, c) => a + +c, 0) % 2 === 0],
  ['digits add up to an odd number', (p) => [...p].reduce((a, c) => a + +c, 0) % 2 === 1],
  ['has a repeated digit', (p) => new Set(p).size < p.length],
  ['every digit is different', (p) => new Set(p).size === p.length],
  ['first digit is bigger than the last', (p) => +p[0] > +p[p.length - 1]],
  ['first digit is smaller than the last', (p) => +p[0] < +p[p.length - 1]],
];

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Only one password matches every clue', timeMs: 15000,
    onTimeout: () => g.lose('timeout', null, { good: answerBtn }) });
  // v2: easier than v1 (was 3/4/4 digits, 3/4/6 options, 2/3/3 clues, 13s).
  const len = byD(g, 3, 3, 4), nOpts = byD(g, 3, 4, 4), nClues = byD(g, 2, 2, 3);
  let answerBtn = null;
  const mk = () => Array.from({ length: len }, () => g.r.int(10)).join('');
  let answer, cands, clues;
  for (let tries = 0; tries < 500; tries++) {
    answer = mk();
    clues = g.r.shuffle(CLUES.filter(([, f]) => f(answer))).slice(0, nClues);
    const decoys = [];
    for (let k = 0; k < 400 && decoys.length < nOpts - 1; k++) {
      const d = mk();
      if (d !== answer && !decoys.includes(d) && !clues.every(([, f]) => f(d)) && clues.filter(([, f]) => f(d)).length >= nClues - 1) decoys.push(d);
    }
    if (decoys.length === nOpts - 1) { cands = g.r.shuffle([answer, ...decoys]); break; }
  }
  const btns = cands.map((c) => {
    const b = g.btn(c, () => (c === answer ? g.win(null, null, { matrix: true }) : g.lose('wrong password', null, { good: answerBtn, bad: b })), 'alt');
    if (c === answer) answerBtn = b;
    return b;
  });
  g.stage.append(
    h('div', { class: 'pc-clues' }, clues.map(([t]) => h('div', {}, 'The password ' + t))),
    h('div', { class: 'pc-label' }, 'HACK!'),
    h('div', { class: 'pc-opts' }, btns),
  );
  return g.handle();
}
