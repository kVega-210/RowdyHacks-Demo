// MG-39 Last Second Grab (push your luck): the pile grows the longer you wait, but the alarm can go off any moment.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'last-second-grab', name: 'Last Second Grab', tags: ['classic', 'push-luck'], baseDurationMs: 12000 };

css('mg-lsg', `
.lsg-pile{text-align:center;font-size:40px;line-height:1;margin-top:64px;min-height:120px;word-break:break-all}
.lsg-siren{width:70px;height:70px;border-radius:50%;margin:10px auto;background:#401018;border:4px solid #666}
.lsg-grab{display:block;margin:10px auto 0;width:84%;height:80px;font-size:30px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Wait for a bigger pile... then GRAB before the alarm', timeMs: 12000 });
  // The alarm goes off at a hidden, seeded moment.
  const alarmAt = g.r.float(byD(g, 5000, 4000, 3200), byD(g, 10500, 9500, 9000));
  const stake = h('div', { class: 'hh-stake' });
  const pile = h('div', { class: 'lsg-pile' });
  const siren = h('div', { class: 'lsg-siren' });
  const multAt = (t) => Math.min(3, 0.4 + (t / 1000) * 0.26);
  g.loop((dt, t) => {
    const m = multAt(t);
    stake.textContent = `AT STAKE x${m.toFixed(2)}`;
    pile.textContent = '💵'.repeat(Math.min(24, Math.floor(m * 8)));
    // Nervous flicker that gets busier as time passes (it is NOT an exact tell).
    const nerves = 0.15 + 0.6 * (t / 12000);
    siren.style.background = Math.random() < nerves * 0.2 ? '#ff2244' : '#401018';
    if (t >= alarmAt) return g.lose('ALARM! Caught with your hands in the pile');
  });
  const grab = g.btn('GRAB!', () => g.win(multAt(g.elapsed)), 'good lsg-grab');
  g.stage.append(stake, pile, siren, grab);
  return g.handle();
}
