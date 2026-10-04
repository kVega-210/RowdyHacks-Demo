// MG-14 Backdoor, v2: pick a door (big door tiles filled with the risk colour; deeper pays more and fails harder),
// then PICK each lock by stopping the 🔑 on the 🔒. Every opened lock pops up as 🔓 and floats away.
import { game, h, css, byD, tierOptions } from '../fx/kit.js';
import { choose } from '../wagers/chooser.js';

export const meta = { id: 'backdoor', name: 'Backdoor', tags: ['cyber', 'choice'], baseDurationMs: 14000 };

css('mg-backdoor', `
.bd-left{text-align:center;font-size:30px;letter-spacing:6px;min-height:40px;margin-top:6px}
.bd-track{position:relative;height:84px;border-radius:14px;background:var(--panel,#121a2e);border:2px solid var(--line,#2a3555);margin:18px 0;overflow:visible}
.bd-lock{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:46px;
  background:var(--gold,#ffd84d)1f;border-left:2px dashed var(--gold,#ffd84d)77;border-right:2px dashed var(--gold,#ffd84d)77}
.bd-key{position:absolute;top:50%;font-size:42px;line-height:1;transform:translate(-50%,-50%) rotate(-135deg);filter:drop-shadow(0 0 6px var(--gold,#ffd84d))}
/* The 🔑 glyph points down-left; -135deg lays it sideways with the blade pointing right, into the lock. */
.bd-open{position:absolute;top:50%;font-size:46px;transform:translate(-50%,-50%);pointer-events:none;animation:bdRise .9s ease-out forwards}
@keyframes bdRise{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-180%) scale(1.3);opacity:0}}
.bd-hit{display:block;margin:0 auto;width:80%;height:66px;font-size:26px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Pick a door', timeMs: 15000 });
  let wager = null;
  const chooser = choose(g.stage, {
    title: 'Backdoor', prompt: 'Deeper doors hide more cash', timeoutMs: 5000, layout: 'tiles',
    options: tierOptions(opts, [
      { tier: '1', label: 'Service door', icon: '🚪', cash: '$', risk: 'safe' },
      { tier: '2', label: 'Server room', icon: '🚪🚪', cash: '$$', risk: 'risky' },
      { tier: '3', label: 'The core', icon: '🚪🚪🚪', cash: '$$$', risk: 'wild' },
    ]),
    onPick(o) { wager = { tier: o.tier }; start(Number(o.tier)); },
  });
  function start(tier) {
    let locks = tier;
    const width = [0.24, 0.16, 0.11][tier - 1] * byD(g, 1.15, 1, 0.9);
    const lock = h('div', { class: 'bd-lock' }, '🔒');
    const key = h('div', { class: 'bd-key' }, '🔑');
    const track = h('div', { class: 'bd-track' }, lock, key);
    const left = h('div', { class: 'bd-left' }, '🔒'.repeat(locks));
    let zx = g.r.float(0.1, 0.9 - width), x = 0, dir = 1;
    const v = byD(g, 0.6, 0.75, 0.9) * (1 + (tier - 1) * 0.15);
    const place = () => { lock.style.left = zx * 100 + '%'; lock.style.width = width * 100 + '%'; };
    place();
    g.loop((dt) => {
      x += dir * v * dt;
      if (x > 1) { x = 1; dir = -1; } else if (x < 0) { x = 0; dir = 1; }
      key.style.left = x * 100 + '%';
    });
    const pick = g.btn('Pick', () => {
      if (x < zx || x > zx + width) return g.lose('wrong pin, alarm!', { wager });
      locks--;
      // The opened lock unlocks and floats up out of the track.
      const open = h('div', { class: 'bd-open', style: { left: (zx + width / 2) * 100 + '%' } }, '🔓');
      track.append(open);
      setTimeout(() => open.remove(), 950);
      left.textContent = '🔓'.repeat(tier - locks) + '🔒'.repeat(locks);
      if (locks === 0) { lock.style.visibility = 'hidden'; return g.win(null, { wager }); }
      zx = g.r.float(0.1, 0.9 - width);
      place();
    }, 'good bd-hit');
    g.stage.append(left, track, pick);
    g.hint('Stop the 🔑 on the 🔒, then Pick');
  }
  return { destroy() { chooser.destroy(); g.destroy(); } };
}
