// MG-17 Digital Wiretap: messages scroll by; tap the one containing the secret code.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'digital-wiretap', name: 'Digital Wiretap', tags: ['cyber'], baseDurationMs: 12000 };

const WHO = ['BOSS', 'GUARD', 'TELLER', 'JANITOR', 'MOM', 'IT DEPT', 'CHEF'];
const KEYS = ['FALCON', 'TANGO', 'MARLIN', 'PHOENIX', 'COBRA'];
const FILLER = ['lunch at noon?', 'did you feed the fish', 'printer is jammed again', 'shift ends at 6', 'coffee machine is broken',
  'meeting moved', 'who parked in my spot', 'reminder: smile at the cameras', 'new carpet looks great', 'call me back', 'the vault is so shiny today'];

css('mg-wiretap', `
.wt-goal{text-align:center;margin-bottom:8px}.wt-goal b{color:#ffd84d}
.wt-feed{position:absolute;left:0;right:0;top:44px;bottom:0;overflow:hidden;display:flex;flex-direction:column-reverse;gap:6px}
.wt-feed .hh-btn{text-align:left;font:600 15px ui-monospace,monospace;background:#0d1424;color:#bfe9ff;box-shadow:0 0 0 2px #2a3555 inset;min-height:48px;animation:wtIn .25s ease-out}
.wt-feed .hh-btn em{font-style:normal;color:#ffd84d;margin-right:6px}
@keyframes wtIn{from{transform:translateY(-20px);opacity:0}}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap the message carrying the secret code', timeMs: 13000 });
  const key = g.r.pick(KEYS);
  const code = `${key}-${g.r.range(10, 99)}`;
  const feed = h('div', { class: 'wt-feed' });
  g.stage.append(h('div', { class: 'wt-goal' }, 'Secret code = ', h('b', {}, key), ' + a number'), feed);
  const total = byD(g, 9, 11, 13);
  const at = g.r.range(3, total - 3);
  let i = 0;
  const msgs = [];
  const push = () => {
    if (i >= total) return g.lose('the code slipped by');
    const real = i === at;
    let text;
    if (real) text = `package ${code} is ready`;
    else if (g.d >= 2 && g.r.chance(0.35)) text = g.r.chance(0.5) ? `${key} says ${g.r.pick(FILLER)}` : `room ${g.r.range(10, 99)}: ${g.r.pick(FILLER)}`;
    else text = g.r.pick(FILLER);
    const b = g.btn('', () => (real ? g.win() : g.lose('wrong message')));
    b.append(h('em', {}, g.r.pick(WHO) + ':'), text);
    feed.prepend(b);
    msgs.push(b);
    if (msgs.length > 6) msgs.shift().remove();
    i++;
  };
  push();
  g.every(byD(g, 1000, 850, 700), push);
  return g.handle();
}
