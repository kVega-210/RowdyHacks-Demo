// MG-22 Safecracker: the dial spins; tap STOP on each of the three combination numbers.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'safecracker', name: 'Safecracker', tags: ['classic'], baseDurationMs: 12000 };

css('mg-safecracker', `
.sc-combo{display:flex;gap:10px;justify-content:center;margin-bottom:6px}
.sc-combo span{min-width:54px;padding:4px 8px;border-radius:8px;background:#000;border:2px solid #2a3555;font:900 24px ui-monospace,monospace;text-align:center}
.sc-combo span.now{border-color:#ffd84d;color:#ffd84d}.sc-combo span.ok{border-color:#3dff9a;color:#3dff9a}
.sc-dial{position:relative;width:min(62vw,230px);aspect-ratio:1;margin:6px auto;border-radius:50%;background:radial-gradient(#3b4154,#1a1e29);border:6px solid #8a91a6}
.sc-face{position:absolute;top:0;right:0;bottom:0;left:0}
.sc-face i{position:absolute;left:50%;top:4px;width:2px;height:10px;background:#cfd6e6;transform-origin:50% calc(min(62vw,230px)/2 - 10px)}
.sc-num{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;font:900 44px ui-monospace,monospace;color:#ffd84d}
.sc-mark{position:absolute;left:50%;top:-14px;margin-left:-8px;border:8px solid transparent;border-top:12px solid #ff5c7a}
.sc-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:8px 0 2px;text-shadow:0 0 10px #ff224466}
.sc-stop{display:block;margin:6px auto 0;width:80%;height:64px;font-size:26px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'STOP the dial on each number', timeMs: 13000 });
  const N = 40;
  const tol = 5; // v2: stopping within 5 numbers of the target counts at every difficulty
  const combo = [g.r.range(5, 35), g.r.range(5, 35), g.r.range(5, 35)];
  let step = 0, angle = g.r.float(0, N), dir = 1, retries = byD(g, 1, 0, 0);
  const rate = byD(g, 5.8, 7, 8.5); // numbers per second (v2: ~35% slower than the original 9/11/13)
  const face = h('div', { class: 'sc-face' });
  for (let i = 0; i < N; i += 2) face.append(h('i', { style: { transform: `rotate(${(i / N) * 360}deg)` } }));
  const num = h('div', { class: 'sc-num' });
  const chips = combo.map((c) => h('span', {}, String(c)));
  const mark = () => chips.forEach((c, k) => { c.className = k < step ? 'ok' : k === step ? 'now' : ''; });
  mark();
  g.loop((dt) => {
    angle = (angle + dir * rate * dt + N) % N;
    face.style.transform = `rotate(${-(angle / N) * 360}deg)`;
    num.textContent = String(Math.round(angle) % N);
  });
  const stop = g.btn('STOP', () => {
    const cur = Math.round(angle) % N;
    const diff = Math.min(Math.abs(cur - combo[step]), N - Math.abs(cur - combo[step]));
    if (diff <= tol) {
      step++;
      mark();
      dir = -dir;
      if (step >= 3) g.win();
    } else if (retries-- > 0) {
      g.status('Click... wrong number. One more try.', '#ff9f43');
      g.penalize(1200);
    } else g.lose('alarm triggered');
  }, 'bad sc-stop');
  g.stage.append(h('div', { class: 'sc-combo' }, chips), h('div', { class: 'sc-dial' }, face, num, h('div', { class: 'sc-mark' })),
    h('div', { class: 'sc-label' }, 'UNLOCK!'), stop);
  return g.handle();
}
