// MG-38 Alarm Jackpot (push your luck), v2: steal from the money bag by stopping the 🫱 hand on 💰.
// Every STEAL! adds the same chunk of cash (shown up front); one miss trips the alarm and the server applies the
// big push-your-luck penalty. ESCAPE! banks what you've stolen so far.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'alarm-jackpot', name: 'Alarm Jackpot', tags: ['classic', 'push-luck'], baseDurationMs: 14000 };

css('mg-jackpot', `
.aj-track{position:relative;height:70px;border-radius:14px;background:var(--panel,#121a2e);border:2px solid var(--line,#2a3555);overflow:hidden;margin:56px 0 12px}
.aj-bag{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:44px;
  background:var(--gold,#ffd84d)22;border-left:2px dashed var(--gold,#ffd84d)88;border-right:2px dashed var(--gold,#ffd84d)88}
.aj-hand{position:absolute;top:50%;z-index:2;font-size:40px;line-height:1;transform:translate(-100%,-50%);filter:drop-shadow(0 0 6px var(--gold,#ffd84d))}
/* Faint yellow grab line under the hand: marks exactly where the fingertips grab. */
.aj-line{position:absolute;top:0;bottom:0;z-index:1;width:4px;margin-left:-2px;background:var(--gold,#ffd84d);opacity:.4;box-shadow:0 0 8px var(--gold,#ffd84d)88;border-radius:2px;pointer-events:none}
.aj-note{text-align:center;font-weight:800;color:var(--gold,#ffd84d);font-size:18px}
.aj-row{display:flex;gap:10px;margin-top:10px}.aj-row .hh-btn{flex:1;height:68px;font-size:24px}
`);

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

export function mount(container, opts) {
  // Each successful steal adds STEP to the score multiplier, so each one is worth the same cash.
  const STEP = 0.45;
  const per = Math.round((opts.basePayout || 100) * STEP);
  let cracks = 0;
  const mult = () => Math.min(3, cracks * STEP);
  const g = game(container, opts, {
    id: meta.id, title: meta.name, hint: 'STEAL $$$!', timeMs: 15000,
    onTimeout: () => (cracks > 0 ? g.win(mult()) : g.lose('timeout')),
  });
  const stake = h('div', { class: 'hh-stake' });
  const bag = h('div', { class: 'aj-bag' }, '💰');
  const hand = h('div', { class: 'aj-hand' }, '🫱');
  const line = h('div', { class: 'aj-line' });
  const note = h('div', { class: 'aj-note' });
  let x = 0, dir = 1, width = byD(g, 0.3, 0.26, 0.22), zx = 0.35;
  const draw = () => {
    stake.textContent = `+${money(per)} PER STEAL`;
    bag.style.left = zx * 100 + '%';
    bag.style.width = width * 100 + '%';
    note.textContent = cracks ? `Stolen so far: ${money(per * cracks)}` : 'Stop the hand on the money bag';
  };
  draw();
  g.loop((dt) => {
    const v = (0.55 + cracks * 0.12) * byD(g, 1, 1.1, 1.2);
    x += dir * v * dt;
    if (x > 1) { x = 1; dir = -1; } else if (x < 0) { x = 0; dir = 1; }
    // The fingertip is the hand's right edge; the faint line sits right under it.
    hand.style.left = x * 100 + '%';
    line.style.left = x * 100 + '%';
  });
  const steal = g.btn('Steal!', () => {
    if (x < zx || x > zx + width) return g.lose('ALARM! Jackpot lost');
    cracks++;
    g.dollar(bag);
    if (mult() >= 3) return g.win(mult());
    width = Math.max(0.06, width * 0.8);
    zx = g.r.float(0.05, 0.95 - width);
    draw();
  }, 'bad');
  const escape = g.btn('Escape!', () => (cracks > 0 ? g.win(mult()) : g.status('Steal at least once first!', '#ff9f43')), 'good');
  g.stage.append(stake, h('div', { class: 'aj-track' }, bag, line, hand), note, h('div', { class: 'aj-row' }, steal, escape));
  return g.handle();
}
