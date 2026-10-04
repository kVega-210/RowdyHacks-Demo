// v3 rival duel: MEMORY DUEL. Both crooks watch the same flashing sequence, which grows by one every level.
// Repeat it exactly; the first to slip loses (reach the last level for a perfect win). At the buzzer, the higher level wins.
import { css, h } from '../fx/kit.js';
import { theirs } from '../phone/duel/duel.js';

export const meta = { id: 'memory-duel', name: 'Memory Duel' };

const PADS = [
  { icon: '💎', color: '#4dd2ff' }, { icon: '🔑', color: '#ffcc1a' }, { icon: '💰', color: '#3dff9a' }, { icon: '🚨', color: '#ff4d6d' },
];

css('duel-mem', `
.md{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;gap:6px}
.md-top{display:flex;justify-content:space-between;align-items:center;font:800 16px var(--font-display,system-ui)}
.md-top .them{color:var(--cyan)}.md-top .me{color:var(--gold)}
.md-pads{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:10px}
.md-pads button{border:0;border-radius:18px;font-size:46px;opacity:.45;filter:saturate(.6);transition:opacity .08s,transform .08s;touch-action:manipulation}
.md-pads button.lit{opacity:1;filter:none;transform:scale(1.05);box-shadow:0 0 26px currentColor}
.md-pads.input button{opacity:.85;filter:none}
.md-pads.input button:active{opacity:1;transform:scale(.97)}
.md-dots{display:flex;justify-content:center;gap:5px;min-height:12px}.md-dots i{width:10px;height:10px;border-radius:50%;background:var(--line)}.md-dots i.on{background:var(--gold)}
`);

export function mount(stage, api) {
  const seq = api.setup.seq || [];
  const start = api.setup.startLength || 3;
  const max = api.setup.maxLevel || 8;
  let level = 1, entered = [], mode = 'wait', alive = true, timers = [];
  const label = h('div', { class: 'duel-label' }, 'WATCH');
  const meLvl = h('span', { class: 'me' }), themLvl = h('span', { class: 'them' });
  const dots = h('div', { class: 'md-dots' });
  const grid = h('div', { class: 'md-pads' });
  const pads = PADS.map((p, i) => {
    const b = h('button', { type: 'button', style: { background: p.color + '33', color: p.color } }, p.icon);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(i); });
    grid.append(b);
    return b;
  });
  stage.append(h('div', { class: 'md' }, h('div', { class: 'md-top' }, meLvl, themLvl), label, grid, dots));
  const later = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); };
  const len = () => start + level - 1;
  const setLevels = (them) => { meLvl.textContent = `${api.myFace} LEVEL ${level}/${max}`; if (them != null) themLvl.textContent = `${api.opponent.face} ${them} done`; };
  const paintDots = () => dots.replaceChildren(...Array.from({ length: len() }, (_, i) => h('i', { class: i < entered.length ? 'on' : '' })));
  const flash = (i, ms) => { pads[i].classList.add('lit'); later(ms, () => pads[i].classList.remove('lit')); };

  function play() {
    if (!alive) return;
    mode = 'show';
    entered = [];
    label.textContent = 'WATCH';
    grid.classList.remove('input');
    setLevels();
    paintDots();
    const n = len();
    for (let k = 0; k < n; k++) later(250 + k * 560, () => { flash(seq[k], 400); api.sfx.play('tick'); });
    later(250 + n * 560, () => { mode = 'input'; label.textContent = 'REPEAT!'; grid.classList.add('input'); });
  }

  function press(i) {
    if (mode !== 'input' || !alive) return;
    flash(i, 150);
    entered.push(i);
    paintDots();
    const k = entered.length - 1;
    if (entered[k] !== seq[k]) { // wrong: the server will call it, but show it right away
      mode = 'out';
      label.textContent = 'WRONG!';
      pads[seq[k]].classList.add('lit');
      api.send({ level, keys: entered.concat(Array(Math.max(0, len() - entered.length)).fill(entered[k])) });
      return;
    }
    if (entered.length === len()) {
      api.send({ level, keys: entered.slice() });
      if (level >= max) { mode = 'done'; label.textContent = 'PERFECT!'; return; }
      level++;
      mode = 'wait';
      label.textContent = 'NICE!';
      later(500, play);
    }
  }

  // Start showing the first sequence when the countdown ends.
  const wait = setInterval(() => { if (api.started()) { clearInterval(wait); play(); } }, 50);
  setLevels(0);
  return {
    state(st) { const t = theirs(st, api.me).level; if (t != null) setLevels(t); },
    end() { alive = false; mode = 'done'; },
    destroy() { alive = false; clearInterval(wait); timers.forEach(clearTimeout); },
  };
}
