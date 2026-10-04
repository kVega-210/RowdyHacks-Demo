// MG-14 Backdoor: choose a door (deeper pays more, fails harder), then crack its lock by timing taps.
import { game, h, css, byD, tierOptions } from '../fx/kit.js';
import { choose } from '../wagers/chooser.js';

export const meta = { id: 'backdoor', name: 'Backdoor', tags: ['cyber', 'choice'], baseDurationMs: 14000 };

css('mg-backdoor', `
.bd-track{position:relative;height:56px;border-radius:12px;background:#121a2e;border:2px solid #2a3555;margin:16px 0;overflow:hidden}
.bd-zone{position:absolute;top:0;bottom:0;background:#3dff9a55;border-left:2px solid #3dff9a;border-right:2px solid #3dff9a}
.bd-cur{position:absolute;top:-4px;bottom:-4px;width:8px;margin-left:-4px;background:#ffd84d;box-shadow:0 0 10px #ffd84d;border-radius:4px}
.bd-door{text-align:center;font-size:64px}
.bd-hit{display:block;margin:0 auto;width:80%;height:64px;font-size:24px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Pick a door', timeMs: 15000 });
  let wager = null;
  const chooser = choose(g.stage, {
    title: 'Backdoor', prompt: 'Deeper doors hide more cash', timeoutMs: 5000,
    options: tierOptions(opts, [
      { tier: '1', label: '🚪 Service door', blurb: 'One lock, wide window.', risk: 'safe' },
      { tier: '2', label: '🚪🚪 Server room', blurb: 'Two locks, tighter window.', risk: 'risky' },
      { tier: '3', label: '🚪🚪🚪 The core', blurb: 'Three locks, razor thin.', risk: 'wild' },
    ]),
    onPick(o) { wager = { tier: o.tier }; start(Number(o.tier)); },
  });
  function start(tier) {
    let locks = tier;
    const width = [0.24, 0.16, 0.11][tier - 1] * byD(g, 1.15, 1, 0.9);
    const zone = h('div', { class: 'bd-zone' });
    const cur = h('div', { class: 'bd-cur' });
    const door = h('div', { class: 'bd-door' }, '🔒'.repeat(locks));
    let zx = g.r.float(0.1, 0.9 - width), x = 0, dir = 1;
    const v = byD(g, 0.6, 0.75, 0.9) * (1 + (tier - 1) * 0.15);
    const place = () => { zone.style.left = zx * 100 + '%'; zone.style.width = width * 100 + '%'; };
    place();
    g.loop((dt) => {
      x += dir * v * dt;
      if (x > 1) { x = 1; dir = -1; } else if (x < 0) { x = 0; dir = 1; }
      cur.style.left = x * 100 + '%';
    });
    const hit = g.btn('HACK', () => {
      if (x < zx || x > zx + width) return g.lose('access denied', { wager });
      locks--;
      door.textContent = '🔓'.repeat(tier - locks) + '🔒'.repeat(locks);
      if (locks === 0) return g.win(null, { wager });
      zx = g.r.float(0.1, 0.9 - width);
      place();
    }, 'good bd-hit');
    g.stage.append(door, h('div', { class: 'bd-track' }, zone, cur), hit);
    g.hint('Tap HACK when the cursor is in the green');
  }
  return { destroy() { chooser.destroy(); g.destroy(); } };
}
