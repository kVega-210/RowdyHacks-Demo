// MG-17 Digital Wiretap, v2: the newest message lands in the middle of the screen and older ones slide down.
// Bigger target prompt and a DECYPHER! label; wrong picks reveal the right message.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'digital-wiretap', name: 'Digital Wiretap', tags: ['cyber'], baseDurationMs: 12000 };

const WHO = ['BOSS', 'GUARD', 'TELLER', 'JANITOR', 'MOM', 'IT DEPT', 'CHEF'];
const KEYS = ['FALCON', 'TANGO', 'MARLIN', 'PHOENIX', 'COBRA'];
const FILLER = ['lunch at noon?', 'did you feed the fish', 'printer is jammed again', 'shift ends at 6', 'coffee machine is broken',
  'meeting moved', 'who parked in my spot', 'reminder: smile at the cameras', 'new carpet looks great', 'call me back', 'the vault is so shiny today'];

css('mg-wiretap', `
.wt-wrap{display:flex;flex-direction:column;height:100%}
.wt-top{height:42%;display:flex;flex-direction:column;justify-content:center}
.wt-goal{text-align:center;font-size:20px;font-weight:700}.wt-goal b{color:var(--gold,#ffd84d);font-size:28px;letter-spacing:.05em}
.wt-label{text-align:center;font:900 26px system-ui,sans-serif;letter-spacing:.14em;color:var(--cyan,#4dd2ff);margin:6px 0;text-shadow:0 0 10px var(--cyan,#4dd2ff)66}
.wt-feed{position:relative;height:58%;flex:none;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:6px;padding-top:4px}
.wt-feed .hh-btn{text-align:left;font:600 15px ui-monospace,monospace;background:var(--panel2,#0d1424);color:#bfe9ff;box-shadow:0 0 0 2px var(--line,#2a3555) inset;min-height:46px;flex:none;animation:wtIn .25s ease-out}
.wt-feed .hh-btn em{font-style:normal;color:var(--gold,#ffd84d);margin-right:6px}
@keyframes wtIn{from{transform:translateY(-14px);opacity:0}}
`);

export function mount(container, opts) {
  let realBtn = null;
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap the message carrying the secret code', timeMs: 13000 });
  const key = g.r.pick(KEYS);
  const code = `${key}-${g.r.range(10, 99)}`;
  const feed = h('div', { class: 'wt-feed' });
  g.stage.append(h('div', { class: 'wt-wrap' },
    h('div', { class: 'wt-top' },
      h('div', { class: 'wt-goal' }, 'Secret code = ', h('b', {}, key), ' + a number'),
      h('div', { class: 'wt-label hh-label' }, 'DECYPHER!')),
    feed));
  const total = byD(g, 9, 11, 13);
  const at = g.r.range(3, total - 3);
  let i = 0;
  const msgs = [];
  const push = () => {
    if (i >= total) return g.lose('the code slipped by', null, { good: realBtn && realBtn.isConnected ? realBtn : null });
    const real = i === at;
    let text;
    if (real) text = `package ${code} is ready`;
    else if (g.d >= 2 && g.r.chance(0.35)) text = g.r.chance(0.5) ? `${key} says ${g.r.pick(FILLER)}` : `room ${g.r.range(10, 99)}: ${g.r.pick(FILLER)}`;
    else text = g.r.pick(FILLER);
    const b = g.btn('', () => (real ? g.win(null, null, { matrix: true }) : g.lose('wrong message', null, { good: realBtn && realBtn.isConnected ? realBtn : null, bad: b })));
    b.append(h('em', {}, g.r.pick(WHO) + ':'), text);
    if (real) realBtn = b;
    // Newest on top of the feed (which starts mid-screen); older messages are pushed down and off the bottom.
    feed.prepend(b);
    msgs.push(b);
    if (msgs.length > 6) msgs.shift().remove();
    i++;
  };
  push();
  g.every(byD(g, 1000, 850, 700), push);
  return g.handle();
}
