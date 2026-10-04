// MG-19 Lockpick: each pin bobs up and down; tap SET while the pick is inside the green sweet spot.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'lockpick', name: 'Lockpick', tags: ['classic'], baseDurationMs: 12000 };

css('mg-lockpick', `
.lp-lock{position:absolute;inset:0 0 80px;display:flex;gap:10px;justify-content:center;align-items:stretch;padding:10px}
.lp-pin{position:relative;flex:1;max-width:70px;background:#121a2e;border:3px solid #2a3555;border-radius:12px;overflow:hidden}
.lp-pin.done{border-color:#3dff9a;background:#103322}
.lp-zone{position:absolute;left:0;right:0;background:#3dff9a55;border-top:2px solid #3dff9a;border-bottom:2px solid #3dff9a}
.lp-pick{position:absolute;left:10%;right:10%;height:10px;border-radius:5px;background:#ffd84d;box-shadow:0 0 8px #ffd84d}
.lp-pin.active{border-color:#ffd84d}
.lp-set{position:absolute;left:12px;right:12px;bottom:6px;height:64px;font-size:26px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap SET when the pick is in the green', timeMs: 12000 });
  const pins = byD(g, 3, 4, 5);
  const zoneH = byD(g, 0.26, 0.2, 0.15);
  let misses = byD(g, 1, 0, 0);
  const state = [];
  const wrap = h('div', { class: 'lp-lock' });
  for (let i = 0; i < pins; i++) {
    const zoneTop = g.r.float(0.1, 0.9 - zoneH);
    const zone = h('div', { class: 'lp-zone', style: { top: zoneTop * 100 + '%', height: zoneH * 100 + '%' } });
    const pick = h('div', { class: 'lp-pick' });
    const el = h('div', { class: 'lp-pin' }, zone, pick);
    wrap.append(el);
    state.push({ el, pick, zoneTop, phase: g.r.float(0, Math.PI * 2), rate: g.r.float(2.2, 3.2) * byD(g, 0.8, 1, 1.15) });
  }
  let cur = 0;
  const posOf = (s, t) => 0.5 + 0.45 * Math.sin(s.phase + (t / 1000) * s.rate);
  g.loop((dt, t) => {
    state.forEach((s, i) => {
      s.el.classList.toggle('active', i === cur);
      if (i >= cur) s.pick.style.top = `calc(${posOf(s, t) * 100}% - 5px)`;
    });
  });
  const set = g.btn('SET', () => {
    const s = state[cur];
    const p = posOf(s, g.elapsed);
    if (p >= s.zoneTop && p <= s.zoneTop + zoneH) {
      s.el.classList.add('done');
      s.pick.style.top = `calc(${(s.zoneTop + zoneH / 2) * 100}% - 5px)`;
      cur++;
      if (cur >= pins) g.win();
    } else if (misses-- > 0) {
      g.status('Careful! One slip left.', '#ff9f43');
      g.penalize(1000);
    } else {
      g.lose('pick snapped');
    }
  }, 'lp-set');
  g.stage.append(wrap, set);
  return g.handle();
}
