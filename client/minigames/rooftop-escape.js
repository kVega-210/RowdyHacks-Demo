// MG-25 Rooftop Escape: auto-run across the rooftops; JUMP each gap. Gold rooftops are risky shortcuts worth more.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'rooftop-escape', name: 'Rooftop Escape', tags: ['classic'], baseDurationMs: 12000 };

css('mg-rooftop', `
.re-sky{position:absolute;left:0;right:0;top:0;bottom:76px;border-radius:12px;background:linear-gradient(#0b1430,#26345e);overflow:hidden}
.re-roof{position:absolute;bottom:0;height:34%;background:#141a2b;border-top:4px solid #4dd2ff}
.re-roof.gold{border-top-color:#ffd84d;background:#2b2410}
.re-you{position:absolute;left:18%;font-size:40px;margin-left:-20px;line-height:1}
.re-jump{position:absolute;left:12px;right:12px;bottom:4px;height:64px;font-size:28px}
.re-left{position:absolute;top:6px;right:10px;font-weight:900}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'JUMP over every gap', timeMs: 14000 });
  const gaps = byD(g, 4, 5, 6);
  const v = byD(g, 0.32, 0.36, 0.4); // screen widths per second
  const gapW = byD(g, 0.12, 0.14, 0.16);
  const sky = h('div', { class: 're-sky' });
  const you = h('div', { class: 're-you' }, '🏃');
  const leftEl = h('div', { class: 're-left' });
  sky.append(you, leftEl);
  const roofs = [];
  let x = 0;
  for (let i = 0; i <= gaps; i++) {
    const w = i === 0 ? 0.6 : g.r.float(0.35, 0.55);
    const gold = i > 0 && i < gaps && g.r.chance(0.3);
    const el = h('div', { class: 're-roof' + (gold ? ' gold' : '') });
    sky.append(el);
    roofs.push({ x, w: i === gaps ? 2 : w, el, gold });
    x += (i === gaps ? 2 : w) + gapW;
  }
  const endX = roofs[gaps].x + 0.1;
  let scroll = 0, y = 0, vy = 0, bonus = 0, cleared = 0;
  const playerX = 0.18;
  g.loop((dt) => {
    scroll += v * dt;
    vy -= 3.2 * dt;
    y = Math.max(0, y + vy * dt);
    const wx = scroll + playerX;
    const roof = roofs.find((r) => wx >= r.x && wx <= r.x + r.w);
    if (y === 0) {
      vy = 0;
      if (!roof) return g.lose('fell off the roof');
    }
    cleared = roofs.filter((r, i) => i > 0 && r.x < wx).length;
    if (roof && roof.gold && y === 0 && !roof.counted) { roof.counted = true; bonus += 0.25; }
    roofs.forEach((r) => { r.el.style.left = (r.x - scroll) * 100 + '%'; r.el.style.width = r.w * 100 + '%'; });
    you.style.bottom = `calc(34% + ${y * 100}%)`;
    leftEl.textContent = `Gaps ${cleared}/${gaps}`;
    if (wx > endX) g.win(1 + bonus);
  });
  g.stage.append(sky, g.btn('JUMP', () => { if (y === 0) vy = 1.25; }, 'good re-jump'));
  return g.handle();
}
