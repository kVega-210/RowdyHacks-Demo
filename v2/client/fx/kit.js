// Shared minigame kit. Every minigame in /client/minigames builds on this so each file stays small.
// No external assets, no storage APIs, touch-first (pointer events), and exactly-once results.
import { playFail, playWin } from './fail.js';
import { sfx } from './sfx.js';
import { matrixRain, answerReveal, dollarPop } from './effects.js';
export { matrixRain, answerReveal, dollarPop };

/** Deterministic RNG (mulberry32). Same seed => same puzzle, which Rival Heist relies on. */
export function rng(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (n) => Math.floor(next() * n),
    range: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    float: (lo, hi) => lo + next() * (hi - lo),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample: (arr, n) => r.shuffle(arr).slice(0, n),
  };
  return r;
}

/** Tiny DOM helper: h('div', {class:'x', style:{...}, on:{pointerdown: fn}}, child, 'text'). */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

const injected = new Set();
/** Inject a stylesheet once per id. */
export function css(id, text) {
  if (injected.has(id) || document.getElementById('css-' + id)) return;
  injected.add(id);
  document.head.append(h('style', { id: 'css-' + id }, text));
}

css('hh-kit', `
.hh-game{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;
  background:radial-gradient(circle at 50% 0%,rgb(calc(24 + 206*var(--heat,0)) calc(34 - 24*var(--heat,0)) calc(61 - 45*var(--heat,0))),rgb(calc(7 + 128*var(--heat,0)) calc(10 - 6*var(--heat,0)) calc(18 - 12*var(--heat,0))) 70%);
  transition:background .8s linear;
  color:#e9f1ff;font:16px/1.25 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;user-select:none;-webkit-user-select:none;
  -webkit-touch-callout:none;touch-action:none;overflow:hidden;-webkit-tap-highlight-color:transparent}
.hh-head{padding:10px 14px 6px;text-align:center}
.hh-title{font-weight:900;letter-spacing:.06em;text-transform:uppercase;font-size:18px;color:#ffd84d;text-shadow:0 2px 0 #000}
.hh-hint{font-size:14px;opacity:.85;margin-top:2px;min-height:18px}
.hh-timer{height:8px;margin:4px 14px 0;background:#1e2840;border-radius:4px;overflow:hidden}
.hh-timer>i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff4d4d,#ffd84d 40%,#3dff9a);transform-origin:left}
.hh-stage{position:relative;flex:1;margin:8px;min-height:0}
.hh-status{text-align:center;font-weight:700;min-height:28px;padding:2px 10px 10px;font-size:18px}
.hh-btn{appearance:none;border:0;border-radius:14px;min-width:56px;min-height:56px;padding:8px 12px;font:800 20px system-ui,sans-serif;
  color:#0b0f1a;background:#ffd84d;box-shadow:0 4px 0 #a8861a;touch-action:manipulation;cursor:pointer;transition:transform .06s}
.hh-btn:active,.hh-btn.hh-pressed{transform:translateY(3px);box-shadow:0 1px 0 #a8861a}
.hh-btn.alt{background:#4dd2ff;box-shadow:0 4px 0 #1f7fa3}
.hh-btn.bad{background:#ff5c7a;box-shadow:0 4px 0 #a32a42;color:#fff}
.hh-btn.good{background:#3dff9a;box-shadow:0 4px 0 #1f9a5a}
.hh-btn.dim{background:#2a3555;color:#9fb0d6;box-shadow:0 4px 0 #141b2e}
.hh-btn[disabled]{opacity:.45}
.hh-grid{display:grid;gap:10px;width:100%;height:100%}
.hh-center{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px}
.hh-big{font-size:42px;font-weight:900;letter-spacing:.05em}
.hh-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.hh-row{display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap}
.hh-stake{position:absolute;top:6px;right:10px;background:#000a;border:2px solid #ffd84d;border-radius:10px;padding:4px 10px;font-weight:900;color:#ffd84d;font-size:20px;z-index:5}
`);

/** Effective time multiplier from ancestors' data-hh-timescale (0 while a Freeze/Steal overlay pauses the game). */
export function timeScaleOf(el) {
  let s = 1;
  for (let n = el; n && n.dataset; n = n.parentElement) if (n.dataset.hhTimescale) s *= Number(n.dataset.hhTimescale) || 1;
  return s;
}

/**
 * Create a minigame shell.
 * game(container, opts, {id, title, hint, timeMs}) => g
 *  g.stage      play area element
 *  g.r          seeded rng
 *  g.d, g.speed difficulty (1-3) and speed (>=1)
 *  g.loop(fn)   per-frame fn(dtSeconds, gameMs) with speed + sabotage applied
 *  g.after(ms, fn) / g.every(ms, fn)   game-time timers
 *  g.btn(label, onTap, cls)  touch button (pointerdown)
 *  g.win(scoreMultiplier?, extra?, {matrix})        exactly-once success (optional Matrix rain)
 *  g.lose(reason, extra?, {good, bad})              exactly-once fail (optional answer reveal first)
 *  g.dollar(el)  dollar pop over an element
 *  g.handle()   => {destroy}
 */
export function game(container, opts, cfg) {
  const d = Math.max(1, Math.min(3, Math.round(opts.difficulty || 1)));
  const speed = Math.max(1, Number(opts.speed) || 1);
  const timerBar = h('i');
  const hint = h('div', { class: 'hh-hint', text: cfg.hint || '' });
  const status = h('div', { class: 'hh-status' });
  const stage = h('div', { class: 'hh-stage' });
  const root = h('div', { class: 'hh-game', 'data-game': cfg.id },
    h('div', { class: 'hh-head' }, h('div', { class: 'hh-title', text: cfg.title }), hint),
    cfg.timeMs ? h('div', { class: 'hh-timer' }, timerBar) : null,
    stage, status);
  container.append(root);

  const loops = new Set();
  const timers = [];
  const cleanups = [];
  let raf = 0, last = 0, gameMs = 0, done = false, destroyed = false;
  const limit = cfg.timeMs || 0;

  const g = {
    id: cfg.id, root, stage, d, speed, r: rng(opts.seed), opts,
    get done() { return done; },
    get elapsed() { return gameMs; },
    get timeLeft() { return limit ? Math.max(0, limit - gameMs) : Infinity; },
    hint(text) { hint.textContent = text; },
    /** Burn game time as a penalty (the timer bar jumps). */
    penalize(ms) { gameMs += ms; root.classList.remove('hh-shake'); void root.offsetWidth; root.classList.add('hh-shake'); },
    status(text, color) { status.textContent = text; status.style.color = color || ''; },
    loop(fn) { loops.add(fn); return () => loops.delete(fn); },
    after(ms, fn) { const t = { at: gameMs + ms, fn }; timers.push(t); return () => { t.fn = null; }; },
    every(ms, fn) {
      const t = { at: gameMs + ms, fn: null };
      t.fn = () => { fn(); t.at = gameMs + ms; timers.push(t); };
      timers.push(t);
      return () => { t.fn = null; };
    },
    on(target, ev, fn, o) { target.addEventListener(ev, fn, o); cleanups.push(() => target.removeEventListener(ev, fn, o)); },
    btn(label, onTap, cls = '') {
      const b = h('button', { class: 'hh-btn ' + cls, type: 'button' }, label);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (done || b.disabled) return;
        b.classList.add('hh-pressed');
        setTimeout(() => b.classList.remove('hh-pressed'), 90);
        sfx.play('click');
        onTap(e, b);
      });
      return b;
    },
    dollar(el, opts) { dollarPop(el, opts); },
    win(scoreMultiplier, extra, fx = {}) {
      if (done) return;
      done = true;
      stop();
      sfx.play('success'); // soundboard: cash register / coin / jingle
      playWin(root);
      if (fx.matrix) matrixRain(root, 1300);
      setTimeout(() => {
        if (destroyed) return;
        const res = Object.assign({}, extra || {});
        if (scoreMultiplier != null) res.scoreMultiplier = scoreMultiplier;
        opts.onSuccess && opts.onSuccess(res);
      }, fx.matrix ? 1350 : 450);
    },
    lose(reason = 'fail', extra, fx = {}) {
      if (done) return;
      done = true;
      stop();
      sfx.play('fail'); // soundboard: siren / handcuffs
      const reveal = fx.good || fx.bad;
      if (reveal) answerReveal(fx);
      setTimeout(() => {
        if (destroyed) return;
        playFail(root, { gameId: cfg.id, reason }).then(() => {
          if (destroyed) return;
          opts.onFail && opts.onFail(Object.assign({ reason }, extra || {}));
        });
      }, reveal ? 1100 : 0);
    },
    handle() { return { destroy: g.destroy }; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      done = true;
      stop();
      cleanups.forEach((c) => c());
      root.remove();
    },
  };

  function stop() { cancelAnimationFrame(raf); raf = 0; }

  function frame(now) {
    if (destroyed || done) return;
    const realDt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    const dt = realDt * speed * timeScaleOf(root);
    gameMs += dt * 1000;
    if (limit) {
      timerBar.style.transform = `scaleX(${Math.max(0, 1 - gameMs / limit)})`;
      if (gameMs >= limit) { if (cfg.onTimeout) cfg.onTimeout(); else g.lose('timeout'); if (done) return; }
    }
    for (let i = timers.length - 1; i >= 0; i--) {
      const t = timers[i];
      if (gameMs >= t.at) { timers.splice(i, 1); if (t.fn) t.fn(); if (done) return; }
    }
    for (const fn of loops) { fn(dt, gameMs); if (done) return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return g;
}

/** Drag helper: calls onMove(x, y) in stage-relative pixels while a pointer is down. */
export function drag(g, el, { onStart, onMove, onEnd } = {}) {
  let active = null;
  const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  g.on(el, 'pointerdown', (e) => { e.preventDefault(); active = e.pointerId; el.setPointerCapture && el.setPointerCapture(e.pointerId); onStart && onStart(...pos(e)); });
  g.on(el, 'pointermove', (e) => { if (active === e.pointerId) onMove && onMove(...pos(e)); });
  const end = (e) => { if (active === e.pointerId) { active = null; onEnd && onEnd(...pos(e)); } };
  g.on(el, 'pointerup', end);
  g.on(el, 'pointercancel', end);
}

/**
 * Choice/push-your-luck helper: the tier table comes from balance.json (wager.tiers), handed in by the
 * runner/sandbox as opts.tiers. Returns chooser options with the multipliers filled in when known.
 */
export function tierOptions(opts, defs) {
  const tiers = opts.tiers || {};
  return defs.map((d) => Object.assign({}, d, tiers[d.tier] || {}));
}

/** Pick by difficulty: byD(g, easy, medium, hard). */
export const byD = (g, a, b, c) => [a, b, c][g.d - 1];

/** Little coloured glyph tile used by several games. */
export const SYMBOLS = ['▲', '■', '●', '◆', '★', '✚', '♥', '☾', '⚡', '☂', '♣', '✿'];
export const COLORS = ['#ff5c7a', '#4dd2ff', '#3dff9a', '#ffd84d', '#c77dff', '#ff9f43'];
