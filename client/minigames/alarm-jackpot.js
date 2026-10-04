// MG-38 Alarm Jackpot (push your luck): every CRACK in the green raises the stake; one miss trips the alarm
// and the server applies the big push-your-luck penalty. CASH OUT any time to bank the multiplier.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'alarm-jackpot', name: 'Alarm Jackpot', tags: ['classic', 'push-luck'], baseDurationMs: 14000 };

css('mg-jackpot', `
.aj-track{position:relative;height:60px;border-radius:12px;background:#121a2e;border:2px solid #2a3555;overflow:hidden;margin:56px 0 12px}
.aj-zone{position:absolute;top:0;bottom:0;background:#3dff9a55;border-left:2px solid #3dff9a;border-right:2px solid #3dff9a}
.aj-cur{position:absolute;top:-4px;bottom:-4px;width:8px;margin-left:-4px;background:#ffd84d;box-shadow:0 0 10px #ffd84d;border-radius:4px}
.aj-risk{text-align:center;font-weight:800;color:#ff9f43}
.aj-row{display:flex;gap:10px;margin-top:10px}.aj-row .hh-btn{flex:1;height:68px;font-size:22px}
`);

export function mount(container, opts) {
  let mult = 0;
  const g = game(container, opts, {
    id: meta.id, title: meta.name, hint: 'CRACK in the green to raise the stake. CASH OUT before you slip.', timeMs: 15000,
    onTimeout: () => (mult > 0 ? g.win(mult) : g.lose('timeout')),
  });
  const stake = h('div', { class: 'hh-stake' });
  const zone = h('div', { class: 'aj-zone' });
  const cur = h('div', { class: 'aj-cur' });
  const risk = h('div', { class: 'aj-risk' });
  let cracks = 0, x = 0, dir = 1, width = byD(g, 0.3, 0.26, 0.22), zx = 0.35;
  const draw = () => {
    stake.textContent = mult > 0 ? `AT STAKE x${mult.toFixed(2)}` : 'AT STAKE x0';
    zone.style.left = zx * 100 + '%';
    zone.style.width = width * 100 + '%';
    risk.textContent = cracks === 0 ? 'First crack starts the jackpot' : `Next crack: zone shrinks, cursor speeds up`;
  };
  draw();
  g.loop((dt) => {
    const v = (0.55 + cracks * 0.12) * byD(g, 1, 1.1, 1.2);
    x += dir * v * dt;
    if (x > 1) { x = 1; dir = -1; } else if (x < 0) { x = 0; dir = 1; }
    cur.style.left = x * 100 + '%';
  });
  const crack = g.btn('CRACK', () => {
    if (x < zx || x > zx + width) return g.lose('ALARM! Jackpot lost');
    cracks++;
    mult = Math.min(3, 0.5 + cracks * 0.4);
    width = Math.max(0.06, width * 0.8);
    zx = g.r.float(0.05, 0.95 - width);
    draw();
  }, 'bad');
  const cash = g.btn('CASH OUT', () => (mult > 0 ? g.win(mult) : g.status('Crack at least once first!', '#ff9f43')), 'good');
  g.stage.append(stake, h('div', { class: 'aj-track' }, zone, cur), risk, h('div', { class: 'aj-row' }, crack, cash));
  return g.handle();
}
