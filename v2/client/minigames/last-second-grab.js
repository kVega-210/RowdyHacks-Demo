// MG-39 Last Second Grab (push your luck): the pile grows while the timer bar runs down. The alarm trips exactly
// when the bar runs out, so grab as late as you dare - the marked last stretch of the bar pays the most.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'last-second-grab', name: 'Last Second Grab', tags: ['classic', 'push-luck'], baseDurationMs: 12000 };

css('mg-lsg', `
.lsg-pile{text-align:center;font-size:40px;line-height:1;margin-top:12px;min-height:120px;word-break:break-all}
.lsg-siren{width:70px;height:70px;border-radius:50%;margin:10px auto;background:#401018;border:4px solid #666}
.lsg-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:6px 0 4px;text-shadow:0 0 10px #ff224466}
.lsg-grab{display:block;margin:6px auto 0;width:84%;height:80px;font-size:30px}
.lsg-zone{position:absolute;left:0;top:0;bottom:0;box-sizing:border-box;border:2px solid #fff;border-radius:4px;background:#ff224455;pointer-events:none}
`);

const TIME_MS = 12000;

export function mount(container, opts) {
  const g = game(container, opts, {
    id: meta.id, title: meta.name, hint: 'Wait while the pile grows... GRAB before the bar runs out!', timeMs: TIME_MS,
    // The alarm is the timer bar itself: it trips the moment the bar visually reaches zero.
    onTimeout: () => g.lose('ALARM! Caught with your hands in the pile'),
  });
  // Mark the "last second" stretch at the end of the bar (it shrinks toward the left edge).
  const lastMs = byD(g, 1500, 1200, 1000);
  const bar = g.root.querySelector('.hh-timer');
  if (bar) { bar.style.position = 'relative'; bar.append(h('div', { class: 'lsg-zone', style: { width: (lastMs / TIME_MS) * 100 + '%' } })); }
  const pile = h('div', { class: 'lsg-pile' });
  const siren = h('div', { class: 'lsg-siren' });
  // x0.4 at the start, x2 entering the last stretch, x3 right at the buzzer.
  const multAt = (t) => {
    const edge = TIME_MS - lastMs;
    if (t < edge) return 0.4 + 1.6 * (t / edge);
    return Math.min(3, 2 + (t - edge) / lastMs);
  };
  g.loop((dt, t) => {
    const m = multAt(t);
    pile.textContent = '💵'.repeat(Math.min(24, Math.floor(m * 8)));
    // Siren flickers busier as the bar runs down, and glows solid in the final stretch.
    const nerves = 0.15 + 0.6 * (t / TIME_MS);
    siren.style.background = t >= TIME_MS - lastMs ? '#ff2244' : Math.random() < nerves * 0.2 ? '#ff2244' : '#401018';
  });
  const grab = g.btn('GRAB!', () => g.win(multAt(g.elapsed)), 'good lsg-grab');
  g.stage.append(pile, siren, h('div', { class: 'lsg-label' }, 'STEAL!'), grab);
  return g.handle();
}
