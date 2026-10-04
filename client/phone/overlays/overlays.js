// CL-05 Steal! and Freeze! overlays. While an overlay is up the minigame underneath is paused (kit timescale 0).
// Freeze is an honour system: any touch during the window is reported once as a violation.
import { h, money, bigBtn } from '../ui.js';
import { openScanner } from '../scanner/scanner.js';
import { sfx } from '../../fx/sfx.js';

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

export function steal(ctx, msg) {
  sfx.play('steal');
  const s = ctx.store;
  const me = s.playerId;
  const [t, stopT] = timer(ctx, msg.endsAt);
  const el = h('div', { class: 'ov steal' }, h('h1', {}, 'STEAL!'), h('p', {}, 'Grab a rival key and SCAN IT!'), t);
  let scanner = null;
  const scan = (code) => ctx.send({ t: 'key_scan', code });
  const victims = (s.state ? s.state.players : []).filter((p) => p.id !== me && p.key === 'held' && (s.virtualKeys || p.bot));
  if (victims.length) {
    el.append(h('p', { class: 'muted' }, s.virtualKeys ? 'Virtual keys: tap a vault to swipe it' : 'Bot vaults (no physical key):'),
      h('div', { class: 'victims' }, victims.map((p) => {
        const b = h('button', { type: 'button' }, `🔑 ${p.name}`);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); ctx.send({ t: 'key_scan', victim: p.id }); });
        return b;
      })));
  }
  if (!s.virtualKeys) {
    el.append(bigBtn('📷 SCAN KEY', () => {
      if (scanner) return;
      const holder = h('div', { style: { width: '100%', display: 'flex', justifyContent: 'center', marginTop: '10px' } });
      el.append(holder);
      scanner = openScanner(holder, { title: 'Scan their key!', onCode: (c) => { scanner = null; scan(c); } });
    }, 'red'));
  }
  show(el, () => { stopT(); if (scanner) scanner.close(); });
}

export function stealDone(ctx, msg) {
  if (msg.t === 'steal_result') {
    const me = ctx.store.playerId;
    if (msg.thiefId === me) ctx.toast(msg.blocked ? `Blocked by ${msg.victimName}'s shield!` : `You robbed ${msg.victimName}: +${money(msg.amount)}`, 'good', 3500);
    else if (msg.victimId === me) ctx.toast(msg.blocked ? 'Your shield blocked the thief!' : `${msg.thiefName} robbed you: -${money(msg.amount)}`, 'bad', 3500);
    else ctx.toast(`${msg.thiefName} robbed ${msg.victimName}`, 'gold');
  }
  if (current && current.el.classList.contains('steal')) close();
}

export function stealReject(ctx, msg) {
  const why = { own_key: "That's your own key!", unknown_key: 'Not a valid key', key_already_stolen: 'Already stolen', already_won: 'Too slow! Someone beat you', closed: 'Window closed', no_window: 'No steal right now' };
  ctx.toast(why[msg.reason] || 'Steal failed', 'bad');
}

export function freeze(ctx, msg) {
  sfx.play('freeze');
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
  show(el, stopT);
}

export function freezeEnd() {
  if (current && current.el.classList.contains('freeze')) close();
}

export function freezePenalty(ctx, msg) {
  ctx.toast(`Freeze violation: -${money(msg.amount)}`, 'bad', 3000);
}

export function isOpen() { return !!current; }
export { show, pauseGame };
