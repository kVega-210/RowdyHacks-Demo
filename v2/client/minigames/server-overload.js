// MG-12 Server Overload: keep every server meter out of the red until the timer runs out. Tap a meter to vent it.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'server-overload', name: 'Server Overload', tags: ['cyber'], baseDurationMs: 9000 };

css('mg-overload', `
.so2-wrap{display:flex;flex-direction:column;height:100%}
.so2-row{display:flex;gap:10px;justify-content:center;flex:1;min-height:0}
.so2-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:2px 0 8px;text-shadow:0 0 10px #ff224466}
.so2-m{position:relative;flex:1;max-width:80px;padding:0;border-radius:14px;background:#121a2e;box-shadow:0 0 0 3px #2a3555 inset;overflow:hidden}
.so2-m .red{position:absolute;left:0;right:0;top:0;height:15%;background:#ff224455;border-bottom:2px solid #ff2244}
.so2-m .fill{position:absolute;left:6px;right:6px;bottom:6px;border-radius:8px;background:linear-gradient(0deg,#3dff9a,#ffd84d 70%,#ff5c7a)}
.so2-m .lbl{position:absolute;bottom:4px;left:0;right:0;text-align:center;font:900 12px system-ui;color:#0b0f1a}
`);

export function mount(container, opts) {
  const g = game(container, opts, {
    id: meta.id, title: meta.name, hint: 'Tap a meter to vent it. Survive!', timeMs: 9000,
    onTimeout: () => g.win(null, null, { matrix: true }),
  });
  const n = byD(g, 2, 3, 4);
  const meters = [];
  for (let i = 0; i < n; i++) {
    const fill = h('div', { class: 'fill' });
    const b = g.btn('', () => { m.v = Math.max(0, m.v - 0.28); }, 'so2-m');
    b.append(h('div', { class: 'red' }), fill, h('div', { class: 'lbl' }, 'SRV' + (i + 1)));
    const m = { b, fill, v: g.r.float(0.15, 0.4), rate: g.r.float(0.1, 0.16) * byD(g, 0.9, 1, 1.1) };
    meters.push(m);
  }
  g.loop((dt, t) => {
    const ramp = 1 + t / 9000;
    for (const m of meters) {
      m.v += m.rate * ramp * dt * (0.6 + 0.8 * Math.abs(Math.sin(t / 700 + m.rate * 40)));
      m.fill.style.height = `calc(${Math.min(1, m.v) * 100}% - 12px)`;
      if (m.v >= 0.85) return g.lose('server melted');
    }
  });
  g.stage.append(h('div', { class: 'so2-wrap' }, h('div', { class: 'so2-label' }, 'MANAGE!'), h('div', { class: 'so2-row' }, meters.map((m) => m.b))));
  return g.handle();
}
