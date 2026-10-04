// v3 rival duel runner (phone). Opens a duel panel over the game area (the minigame underneath is paused), shows who
// your opponent is, runs a 3-2-1 countdown, mounts the duel game from /rival/<kind>.js and shows the result.
// The server is the referee: games only send inputs (duel_input) and draw the live state (duel_state).
//
// Duel game module contract:  export const meta = { id, name, label }
//   export function mount(stage, api) -> { state(st), end(), destroy() }
//   api = { setup, me: 'a'|'b', opponent: {name, face}, myFace, startsAt, endsAt, now(), started(), send(obj), h, css, sfx }
//   st  = { rope?, a: {progress?, level?}, b: {...}, bar }   (use mine(st) / theirs(st) to read it from your side)
import { h, css, dollarPop } from '../../fx/kit.js';
import { sfx } from '../../fx/sfx.js';
import { show, close, isOpen } from '../overlays/overlays.js';
import { money } from '../ui.js';

css('hh-duel', `
.ov.duel{justify-content:flex-start;align-items:stretch;padding:0;bottom:var(--term-h,0);background:radial-gradient(circle at 50% 0%,var(--heat-top,#2a0a10),var(--heat-bot,#090304) 75%);animation:none}
.duel-head{padding:8px 12px 4px;text-align:center}
.duel-title{font:900 13px var(--font-display,system-ui);letter-spacing:.2em;color:var(--dim)}
.duel-vs{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:4px}
.duel-side{display:flex;flex-direction:column;align-items:center;min-width:0;flex:1}
.duel-side b{font-size:34px;line-height:1}.duel-side span{font:800 14px var(--font-display,system-ui);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.duel-side.me span{color:var(--gold)}.duel-side.them span{color:var(--cyan)}
.duel-x{font:900 22px var(--font-display,system-ui);color:var(--label,#ff5c7a);text-shadow:0 0 10px var(--label-glow,transparent)}
.duel-meta{font-size:13px;color:var(--dim);margin-top:2px}
.duel-timer{height:6px;margin:4px 12px 0;background:var(--line);border-radius:3px;overflow:hidden}
.duel-timer i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff4d4d,var(--gold) 40%,#3dff9a);transform-origin:left}
.duel-stage{position:relative;flex:1;min-height:0;margin:6px 8px 8px}
.duel-count{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;z-index:5;pointer-events:none;
  font:900 110px var(--font-display,system-ui);color:var(--gold);text-shadow:0 6px 0 #000,0 0 30px var(--label-glow,transparent);background:#0008}
.duel-count.go{color:#3dff9a;font-size:90px;background:transparent;animation:duelGo .6s ease-out forwards}
@keyframes duelGo{to{transform:scale(1.6);opacity:0}}
.duel-result{position:absolute;top:0;right:0;bottom:0;left:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  background:#000c;text-align:center;animation:duelIn .25s ease-out}
.duel-result h1{margin:0;font:900 64px var(--font-display,system-ui)}.duel-result.win h1{color:#3dff9a}.duel-result.lose h1{color:#ff4d6d}.duel-result.draw h1{color:var(--gold)}
.duel-result p{margin:0;font-size:18px;color:var(--ink)}.duel-result .amt{font:900 34px var(--font-display,system-ui)}
@keyframes duelIn{from{transform:scale(1.2);opacity:0}}
.duel-label{text-align:center;font:900 26px var(--font-display,system-ui);letter-spacing:.14em;color:var(--label,#ff5c7a);text-shadow:0 0 10px var(--label-glow,transparent),0 2px 0 #000}
.duel-big{width:100%;border:0;border-radius:18px;font:900 34px var(--font-display,system-ui);letter-spacing:.08em;color:var(--on-accent,#000);
  background:var(--gold);box-shadow:0 6px 0 var(--gold-dark,#a07800);touch-action:manipulation;-webkit-user-select:none;user-select:none}
.duel-big:active,.duel-big.hit{transform:translateY(4px);box-shadow:0 2px 0 var(--gold-dark,#a07800)}
.duel-bar{position:relative;height:16px;border-radius:8px;background:var(--panel2);overflow:hidden;border:2px solid var(--line)}
.duel-bar i{position:absolute;top:0;bottom:0;left:0;background:var(--cyan);transition:width .15s}
.duel-bar.me i{background:var(--gold)}
`);

let cur = null; // { id, m, game, el, stage, timers }

export function active() { return cur ? cur.m : null; }

/** duel_start from the server. */
export async function start(ctx, m) {
  if (cur && cur.id === m.duelId) return; // resync of the duel we're already in
  stop();
  const s = ctx.sock;
  const timerBar = h('i');
  const stage = h('div', { class: 'duel-stage' });
  const count = h('div', { class: 'duel-count' }, '3');
  const meFace = (ctx.store.me && ctx.store.me.face) || ctx.store.face || '🙂';
  const opp = m.opponent || { name: '?', face: '❓' };
  const rec = m.record || { you: 0, them: 0 };
  const el = h('div', { class: 'ov duel' },
    h('div', { class: 'duel-head' },
      h('div', { class: 'duel-title' }, `⚔️ ${m.event ? 'RIVAL EVENT' : 'RIVAL DUEL'} · ${String(m.name).toUpperCase()}`),
      h('div', { class: 'duel-vs' },
        h('div', { class: 'duel-side me' }, h('b', {}, meFace), h('span', {}, 'YOU')),
        h('div', { class: 'duel-x' }, 'VS'),
        h('div', { class: 'duel-side them' }, h('b', {}, opp.face), h('span', {}, opp.name))),
      h('div', { class: 'duel-meta' }, `Winner takes ${money(m.pot || 0)}${rec.you || rec.them ? ` · duels won ${rec.you}-${rec.them}` : ''}`)),
    h('div', { class: 'duel-timer' }, timerBar), stage);
  stage.append(count);
  const c = { id: m.duelId, m, el, stage, timers: [], game: null, ended: false };
  cur = c;
  show(el, () => { c.timers.forEach(clearInterval); if (c.game) try { c.game.destroy(); } catch (_) { /* ignore */ } });
  const tick = setInterval(() => {
    const now = s.serverNow();
    const left = m.startsAt - now;
    if (left > 0) count.textContent = String(Math.ceil(left / 1000));
    else if (!count.classList.contains('go') && count.isConnected) {
      count.textContent = 'GO!';
      count.classList.add('go');
      sfx.play('click');
      setTimeout(() => count.remove(), 650);
    }
    const total = m.endsAt - m.startsAt;
    timerBar.style.transform = `scaleX(${Math.max(0, Math.min(1, (m.endsAt - Math.max(now, m.startsAt)) / total))})`;
  }, 100);
  c.timers.push(tick);
  try {
    const mod = await import(m.file);
    if (cur !== c) return;
    c.game = mod.mount(stage, {
      setup: m.setup || {}, me: m.you, opponent: opp, myFace: meFace, startsAt: m.startsAt, endsAt: m.endsAt,
      now: () => s.serverNow(), started: () => s.serverNow() >= m.startsAt && !c.ended,
      send: (obj) => { if (!c.ended) ctx.send(Object.assign({ t: 'duel_input', duelId: m.duelId }, obj)); },
      h, css, sfx,
    });
    if (c.pending) { c.game.state(c.pending); c.pending = null; }
  } catch (e) {
    console.error('duel load failed', e);
    ctx.toast('Could not load the duel', 'bad');
  }
}

/** duel_state: forward the live state to the game. */
export function state(m) {
  if (!cur || cur.id !== m.duelId) return;
  if (cur.game) cur.game.state(m); else cur.pending = m;
}

/** duel_end: show the result, then close (calls done() once the result has been shown). */
export function end(ctx, m, done) {
  if (!cur || cur.id !== m.duelId) { if (done) done(); return; }
  const c = cur;
  c.ended = true;
  if (m.aborted) { stop(); if (done) done(); return; }
  if (c.game && c.game.end) try { c.game.end(m); } catch (_) { /* ignore */ }
  const me = ctx.store.playerId;
  const kind = m.draw || !m.winnerId ? 'draw' : m.winnerId === me ? 'win' : 'lose';
  const why = { pulled: 'Rope dragged over the line', typed: 'Password typed first', slipped: 'Sequence slipped', 'perfect memory': 'Perfect memory',
    foul: 'Shot too early!', 'fastest draw': 'Fastest draw', time: 'Time ran out', forfeit: 'Opponent left' }[m.reason] || '';
  const box = h('div', { class: 'duel-result ' + kind },
    h('h1', {}, kind === 'win' ? 'YOU WIN!' : kind === 'lose' ? 'YOU LOSE' : 'DRAW'),
    h('p', {}, why),
    kind === 'win' ? h('div', { class: 'amt', style: { color: '#3dff9a' } }, '+' + money(m.amount)) : null,
    kind === 'lose' && m.penalty ? h('div', { class: 'amt', style: { color: '#ff4d6d' } }, '-' + money(m.penalty)) : null);
  c.stage.append(box);
  sfx.play(kind === 'win' ? 'success' : kind === 'lose' ? 'fail' : 'click');
  if (kind === 'win') dollarPop(box, { count: 4 });
  setTimeout(() => { if (cur === c) stop(); if (done) done(); }, 2300);
}

/** Close the duel panel (phase change, abort, or after the result). */
export function stop() {
  if (!cur) return;
  cur = null;
  if (isOpen()) close();
}

/** Helpers for duel games: read the live state from your side. */
export const mine = (st, me) => (st && st[me]) || {};
export const theirs = (st, me) => (st && st[me === 'a' ? 'b' : 'a']) || {};
