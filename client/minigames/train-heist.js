// MG-34 Train Heist: run along the train roofs. JUMP the gaps between cars, DUCK under the bridges, grab the cash.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'train-heist', name: 'Train Heist', tags: ['classic'], baseDurationMs: 12000 };

css('mg-train', `
.th-world{position:absolute;left:0;right:0;top:0;bottom:76px;border-radius:12px;background:linear-gradient(#f39c6b,#5b3a70);overflow:hidden}
.th-o{position:absolute;bottom:30%;font-size:34px;margin-left:-17px}
.th-o.bridge{bottom:auto;top:0;height:52%;width:16%;margin-left:-8%;background:#3a2b1c;border-bottom:6px solid #1d140c;font-size:0}
.th-car{position:absolute;bottom:0;height:30%;left:0;right:0;background:repeating-linear-gradient(90deg,#6b2b2b 0 30%,#000 30% 33%)}
.th-you{position:absolute;left:20%;bottom:30%;font-size:38px;margin-left:-19px;line-height:1;transform-origin:bottom}
.th-you.duck{transform:scaleY(.5)}
.th-pad{position:absolute;left:0;right:0;bottom:4px;display:flex;gap:10px;padding:0 8px}
.th-pad .hh-btn{flex:1;height:64px;font-size:22px}
.th-left{position:absolute;top:6px;right:10px;font-weight:900;color:#fff}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'JUMP gaps, DUCK bridges', timeMs: 13000 });
  const count = byD(g, 4, 5, 6);
  const v = byD(g, 0.3, 0.34, 0.38);
  const world = h('div', { class: 'th-world' }, h('div', { class: 'th-car' }));
  const you = h('div', { class: 'th-you' }, '🦹');
  const leftEl = h('div', { class: 'th-left' });
  world.append(you, leftEl);
  const obs = [];
  let x = 0.9;
  for (let i = 0; i < count; i++) {
    const kind = g.r.chance(0.5) ? 'gap' : 'bridge';
    const el = h('div', { class: 'th-o ' + kind }, kind === 'gap' ? '🕳️' : '');
    world.append(el);
    obs.push({ x, kind, el });
    if (g.r.chance(0.5)) { const c = h('div', { class: 'th-o' }, '💰'); world.append(c); obs.push({ x: x + 0.22, kind: 'cash', el: c }); }
    x += g.r.float(0.4, 0.55);
  }
  let scroll = 0, y = 0, vy = 0, duckUntil = -1, cash = 0;
  const px = 0.2;
  g.loop((dt, t) => {
    scroll += v * dt;
    vy -= 3.2 * dt;
    y = Math.max(0, y + vy * dt);
    if (y === 0) vy = 0;
    const ducking = t < duckUntil;
    you.classList.toggle('duck', ducking);
    you.style.bottom = `calc(30% + ${y * 100}%)`;
    let left = 0;
    for (const o of obs) {
      const sx = o.x - scroll;
      o.el.style.left = sx * 100 + '%';
      if (o.kind !== 'cash' && sx > px - 0.03) left++;
      if (Math.abs(sx - px) < 0.04 && !o.hit) {
        if (o.kind === 'gap' && y < 0.05) return g.lose('fell between the cars');
        if (o.kind === 'bridge' && !ducking) return g.lose('bonked by a bridge');
        if (o.kind === 'cash' && y < 0.15) { o.hit = true; cash++; o.el.remove(); }
      }
    }
    leftEl.textContent = `Obstacles left ${left} · 💰${cash}`;
    if (scroll > x - 0.3) g.win(1 + cash * 0.15);
  });
  g.stage.append(world, h('div', { class: 'th-pad' },
    g.btn('JUMP', () => { if (y === 0) vy = 1.25; }, 'good'),
    g.btn('DUCK', () => { if (y === 0) duckUntil = g.elapsed + 700; }, 'alt')));
  return g.handle();
}
