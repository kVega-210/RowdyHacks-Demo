// MG-21 Guard Patrol: learn the guard's patrol, then SNEAK across the doorway while his flashlight is off the door.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'guard-patrol', name: 'Guard Patrol', tags: ['classic'], baseDurationMs: 12000 };

css('mg-guard-patrol', `
.gp-hall{position:relative;height:150px;border-radius:12px;background:linear-gradient(#1a2440,#0d1424);border:2px solid #2a3555;margin:10px 0 4px;overflow:hidden}
.gp-door{position:absolute;left:4%;width:16%;top:0;bottom:0;background:#ffd84d22;border-left:2px dashed #ffd84d;border-right:2px dashed #ffd84d;text-align:center;font-size:34px;line-height:1;padding-top:6px}
.gp-guard{position:absolute;bottom:14px;font-size:54px;line-height:1;margin-left:-27px;transition:opacity .2s}
.gp-cone{position:absolute;bottom:22px;height:60px;transition:opacity .2s}
.gp-cone.r{background:linear-gradient(90deg,#ffd84d88,transparent);clip-path:polygon(0 38%,100% 0,100% 100%,0 62%)}
.gp-cone.l{background:linear-gradient(270deg,#ff3355aa,transparent);clip-path:polygon(0 0,100% 38%,100% 62%,0 100%)}
.gp-you{position:absolute;bottom:14px;left:12%;margin-left:-20px;font-size:40px;line-height:1;transition:bottom .3s}
.gp-dark .gp-guard,.gp-dark .gp-cone{opacity:0}
.gp-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:6px 0 4px;text-shadow:0 0 10px #ff224466}
.gp-go{display:block;margin:6px auto 0;width:80%;height:64px;font-size:26px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Sneak through the door when the flashlight is off it', timeMs: 13000 });
  // Patrol: waypoints across the hall with pauses; it loops. The guard faces the way he last walked.
  const pts = [0.2, 0.9, 0.5, 0.95, 0.3];
  const legs = g.r.shuffle(pts).slice(0, byD(g, 3, 4, 5));
  const speedX = byD(g, 0.35, 0.45, 0.55);
  const pause = 600;
  const sched = [];
  let tt = 0, from = 0.9, face = -1;
  for (const to of legs.concat([0.9])) {
    const dur = (Math.abs(to - from) / speedX) * 1000;
    if (to !== from) face = to < from ? -1 : 1;
    sched.push({ t0: tt, t1: tt + dur, a: from, b: to, face });
    tt += dur;
    sched.push({ t0: tt, t1: tt + pause, a: to, b: to, face });
    tt += pause;
    from = to;
  }
  const loopMs = tt;
  const at = (t) => {
    const m = t % loopMs;
    for (const s of sched) if (m >= s.t0 && m < s.t1) return [s.a + (s.b - s.a) * ((m - s.t0) / Math.max(1, s.t1 - s.t0)), s.face];
    return [0.9, sched[sched.length - 1].face];
  };
  // Detection (what the cone shows): the flashlight beam reaches BEAM of the hall in the direction he faces.
  // Facing left (red light) and reaching the door edge = spotted. Standing right in the doorway = bumped into.
  const BEAM = 0.24, DOOR_EDGE = 0.2;
  const spots = (x, f) => (f < 0 && x - BEAM <= DOOR_EDGE) || x < DOOR_EDGE + 0.06;
  const guard = h('div', { class: 'gp-guard' }, '👮');
  const cone = h('div', { class: 'gp-cone', style: { width: BEAM * 100 + '%' } });
  const you = h('div', { class: 'gp-you' }, '🥷');
  const hall = h('div', { class: 'gp-hall' }, h('div', { class: 'gp-door' }, '🚪'), cone, guard, you);
  let sneakStart = -1;
  const sneakMs = 1000;
  g.loop((dt, t) => {
    const [x, f] = at(t);
    guard.style.left = x * 100 + '%';
    cone.className = 'gp-cone ' + (f < 0 ? 'l' : 'r');
    cone.style.left = (f < 0 ? x - BEAM : x) * 100 + '%';
    if (g.d >= 2 && t > loopMs) hall.classList.toggle('gp-dark', g.d === 3 || Math.floor(t / 400) % 3 !== 0);
    if (sneakStart >= 0) {
      if (spots(x, f)) return g.lose('spotted at the door');
      you.style.bottom = 14 + ((t - sneakStart) / sneakMs) * 100 + 'px';
      if (t - sneakStart >= sneakMs) g.win();
    }
  });
  if (g.d >= 2) g.after(loopMs, () => g.hint(g.d === 3 ? 'Lights out! Trust your memory.' : 'The lights are flickering...'));
  const go = g.btn('SNEAK', () => { if (sneakStart < 0) sneakStart = g.elapsed; }, 'good gp-go');
  g.stage.append(hall, h('div', { class: 'gp-label' }, 'ESCAPE!'), go);
  return g.handle();
}
