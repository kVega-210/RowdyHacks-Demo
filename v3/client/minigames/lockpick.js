// MG-19 Lockpick: one lock at a time - its key bobs up and down; tap SET while the 🔑 is on the 🔒.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'lockpick', name: 'Lockpick', tags: ['classic'], baseDurationMs: 12000 };

css('mg-lockpick', `
.lp-lock{position:absolute;top:0;right:0;bottom:116px;left:0;display:flex;gap:10px;justify-content:center;align-items:stretch;padding:10px}
.lp-pin{position:relative;flex:1;max-width:70px;background:var(--panel,#121a2e);border:3px solid var(--line,#2a3555);border-radius:12px;overflow:hidden;transition:opacity .2s,filter .2s}
.lp-pin.wait{opacity:.35;filter:grayscale(1) brightness(.7)}
.lp-pin.active{border-color:var(--gold,#ffd84d);box-shadow:0 0 12px var(--gold,#ffd84d)88}
.lp-pin.done{border-color:#3dff9a;background:#103322}
.lp-zone{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center;font-size:30px;line-height:1;border-top:1px dashed #ffffff22;border-bottom:1px dashed #ffffff22}
.lp-pick{position:absolute;left:0;right:0;height:30px;margin-top:-15px;text-align:center;font-size:28px;line-height:30px;filter:drop-shadow(0 0 4px var(--gold,#ffd84d))}
.lp-label{position:absolute;left:0;right:0;bottom:76px;text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;text-shadow:0 0 10px #ff224466}
.lp-set{position:absolute;left:12px;right:12px;bottom:6px;height:64px;font-size:26px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Tap SET when the 🔑 is on the 🔒', timeMs: 12000 });
  const pins = byD(g, 3, 4, 5);
  const zoneH = byD(g, 0.26, 0.2, 0.15);
  let misses = byD(g, 1, 0, 0);
  const state = [];
  const wrap = h('div', { class: 'lp-lock' });
  for (let i = 0; i < pins; i++) {
    const zoneTop = g.r.float(0.1, 0.9 - zoneH);
    const zone = h('div', { class: 'lp-zone', style: { top: zoneTop * 100 + '%', height: zoneH * 100 + '%' } }, '🔒');
    const pick = h('div', { class: 'lp-pick' }, '🔑');
    const el = h('div', { class: 'lp-pin wait' }, zone, pick);
    wrap.append(el);
    state.push({ el, zone, pick, zoneTop, start: 0, phase: g.r.float(0, Math.PI * 2), rate: g.r.float(2.2, 3.2) * byD(g, 0.8, 1, 1.15) });
  }
  let cur = 0;
  // Each lock's key only moves while that lock is active, starting from where it was paused.
  const posOf = (s, t) => 0.5 + 0.45 * Math.sin(s.phase + ((t - s.start) / 1000) * s.rate);
  const show = (s, p) => { s.pick.style.top = p * 100 + '%'; };
  const activate = (i, t) => {
    const s = state[i];
    if (!s) return;
    s.start = t;
    s.el.classList.remove('wait');
    s.el.classList.add('active');
  };
  state.forEach((s) => show(s, posOf(s, 0)));
  activate(0, 0);
  g.loop((dt, t) => {
    const s = state[cur];
    if (s) show(s, posOf(s, t));
  });
  const set = g.btn('SET', () => {
    const s = state[cur];
    const p = posOf(s, g.elapsed);
    if (p >= s.zoneTop && p <= s.zoneTop + zoneH) {
      s.el.classList.remove('active');
      s.el.classList.add('done');
      s.zone.textContent = '🔓';
      show(s, s.zoneTop + zoneH / 2);
      s.pick.style.visibility = 'hidden';
      g.dollar(s.zone);
      cur++;
      if (cur >= pins) g.win(undefined, undefined, { matrix: true });
      else activate(cur, g.elapsed);
    } else if (misses-- > 0) {
      g.status('Careful! One slip left.', '#ff9f43');
      g.penalize(1000);
    } else {
      g.lose('pick snapped');
    }
  }, 'lp-set');
  g.stage.append(wrap, h('div', { class: 'lp-label hh-label' }, 'UNLOCK!'), set);
  return g.handle();
}
