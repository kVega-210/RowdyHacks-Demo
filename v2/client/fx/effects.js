// v2 shared effects:
//  - dollarPop(target):   a 💲 pops up over a button/element (or at x,y in a container), rises and quickly fades.
//  - answerReveal({good, bad}): correct buttons/pattern in bright green, the player's wrong input in bright red.
//  - matrixRain(container, ms): "Matrix digital rain" of slightly transparent green characters in vertical chains.
const STYLE = `
.hh-dollar{position:fixed;z-index:200;pointer-events:none;font-size:34px;line-height:1;margin:-17px 0 0 -17px;
  animation:hhDollar .75s cubic-bezier(.2,.7,.3,1) forwards;filter:drop-shadow(0 0 6px #3dff9a)}
@keyframes hhDollar{0%{transform:translateY(8px) scale(.4);opacity:0}15%{transform:translateY(0) scale(1.15);opacity:1}100%{transform:translateY(-80px) scale(1);opacity:0}}
.hh-ans-good{background:#14ff5a!important;color:#022a0d!important;box-shadow:0 0 0 4px #b9ffcf inset,0 0 22px #14ff5a!important;border-color:#14ff5a!important}
.hh-ans-bad{background:#ff1a3c!important;color:#fff!important;box-shadow:0 0 0 4px #ffc2cc inset,0 0 22px #ff1a3c!important;border-color:#ff1a3c!important}
.hh-matrix{position:absolute;top:0;right:0;bottom:0;left:0;z-index:60;pointer-events:none;width:100%;height:100%}
`;
function ensureStyle() {
  if (document.getElementById('css-hh-effects')) return;
  const s = document.createElement('style');
  s.id = 'css-hh-effects';
  s.textContent = STYLE;
  document.head.append(s);
}

/** Pop a dollar sign. `target` is an element (pops from its centre) or {x, y} in viewport pixels. */
export function dollarPop(target, { symbol = '💲', count = 1 } = {}) {
  ensureStyle();
  let x, y;
  if (target && target.getBoundingClientRect) {
    const r = target.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else {
    x = target ? target.x : innerWidth / 2;
    y = target ? target.y : innerHeight / 2;
  }
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className = 'hh-dollar';
    d.textContent = symbol;
    d.style.left = x + (count > 1 ? (i - (count - 1) / 2) * 26 : 0) + 'px';
    d.style.top = y + 'px';
    d.style.animationDelay = i * 60 + 'ms';
    document.body.append(d);
    setTimeout(() => d.remove(), 900 + i * 60);
  }
}

/** Highlight the right answer green and the player's wrong input red. Accepts elements or arrays of elements. */
export function answerReveal({ good = [], bad = [] } = {}) {
  ensureStyle();
  const arr = (x) => (Array.isArray(x) ? x : [x]).filter(Boolean);
  arr(good).forEach((el) => el.classList.add('hh-ans-good'));
  arr(bad).forEach((el) => { el.classList.remove('hh-ans-good'); el.classList.add('hh-ans-bad'); });
}

const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789$#@%&';

/** Matrix digital rain over `container` for `ms` milliseconds. Returns a stop() function. */
export function matrixRain(container, ms = 1300) {
  ensureStyle();
  const c = document.createElement('canvas');
  c.className = 'hh-matrix';
  container.append(c);
  const ctx = c.getContext('2d');
  const r = container.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.max(1, r.width * dpr);
  c.height = Math.max(1, r.height * dpr);
  ctx.scale(dpr, dpr);
  const size = 16;
  const cols = Math.ceil(r.width / size);
  const drops = Array.from({ length: cols }, () => -Math.random() * 20);
  const speeds = Array.from({ length: cols }, () => 0.6 + Math.random() * 0.8);
  let raf = 0, last = performance.now();
  const t0 = last;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000) * 60;
    last = now;
    // Fade previous frame for the trailing chains.
    ctx.fillStyle = 'rgba(0, 12, 4, 0.18)';
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.font = `${size}px ui-monospace, monospace`;
    for (let i = 0; i < cols; i++) {
      const y = drops[i] * size;
      ctx.fillStyle = 'rgba(200, 255, 210, 0.85)';
      ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * size, y);
      ctx.fillStyle = 'rgba(40, 255, 120, 0.55)';
      ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * size, y - size);
      drops[i] += speeds[i] * dt * 0.5;
      if (y > r.height && Math.random() > 0.9) drops[i] = -Math.random() * 5;
    }
    const k = (now - t0) / ms;
    c.style.opacity = String(k < 0.75 ? 0.85 : Math.max(0, 0.85 * (1 - (k - 0.75) / 0.25)));
    if (k < 1) raf = requestAnimationFrame(frame);
    else c.remove();
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); c.remove(); };
}
