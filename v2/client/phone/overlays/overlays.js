// CL-05 Freeze! overlay (v2: the Steal overlay is gone). While an overlay is up the minigame underneath is paused
// (kit timescale 0). Freeze is an honour system: any touch during the window is reported once as a violation.
import { h, money } from '../ui.js';
import { freezeAudio } from '../../fx/sfx.js';
import { setFrozen } from '../../fx/screen.js';

const layer = () => document.getElementById('overlay');
let current = null;

function pauseGame(on) {
  const box = document.getElementById('game');
  if (on) box.dataset.hhTimescale = '0'; else delete box.dataset.hhTimescale;
}

export function close() {
  if (current) { current.cleanup && current.cleanup(); current.el.remove(); }
  current = null;
  pauseGame(false);
}

function show(el, cleanup) {
  close();
  current = { el, cleanup };
  layer().append(el);
  pauseGame(true);
}

function timer(ctx, endsAt) {
  const t = h('div', { class: 'timer' });
  const iv = setInterval(() => { t.textContent = (ctx.sock.msUntil(endsAt) / 1000).toFixed(1) + 's'; }, 100);
  return [t, () => clearInterval(iv)];
}

export function freeze(ctx, msg) {
  // v2: the phone goes silent (the host plays the only sound, a siren) and the whole screen stops moving.
  freezeAudio.start(Math.max(500, ctx.sock.msUntil(msg.endsAt)), { siren: false });
  setFrozen(true);
  const [t, stopT] = timer(ctx, msg.endsAt);
  let reported = false;
  const el = h('div', { class: 'ov freeze' }, h('h1', {}, 'FREEZE!'), h('p', { style: { fontSize: '22px', fontWeight: 900 } }, 'HANDS OFF YOUR PHONE'), t);
  const onTouch = (e) => {
    e.preventDefault();
    if (reported) return;
    reported = true;
    ctx.send({ t: 'freeze_violation' });
    el.classList.add('violated');
    el.querySelector('p').textContent = 'YOU MOVED! Penalty incoming...';
  };
  el.addEventListener('pointerdown', onTouch);
  show(el, () => { stopT(); freezeAudio.end(); setFrozen(false); });
}

export function freezeEnd() {
  if (current && current.el.classList.contains('freeze')) close();
}

export function freezePenalty(ctx, msg) {
  ctx.toast(`Freeze violation: -${money(msg.amount)}`, 'bad', 3000);
}

export function isOpen() { return !!current; }
export { show, pauseGame };
