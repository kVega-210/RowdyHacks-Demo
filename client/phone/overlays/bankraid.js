// BE-13 Bank Raid overlay: one giant GRAB button for the raid window; first N tappers (server receive order) win.
import { h, money } from '../ui.js';
import { show, close } from './overlays.js';
import { sfx } from '../../fx/sfx.js';

let open = false;

export function raidOpen(ctx, msg) {
  sfx.play('raid');
  open = true;
  const btn = h('button', { class: 'grab', type: 'button' }, 'GRAB!');
  const info = h('p', {}, `First ${msg.winners} to grab split ${money(msg.bonus || 0)}`);
  const t = h('div', { class: 'timer' });
  const iv = setInterval(() => { t.textContent = (ctx.sock.msUntil(msg.endsAt) / 1000).toFixed(1) + 's'; }, 100);
  let grabbed = false;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (grabbed) return;
    grabbed = true;
    btn.textContent = '...';
    ctx.send({ t: 'bankraid_grab' });
  });
  show(h('div', { class: 'ov raid' }, h('h1', {}, 'BANK RAID!'), info, btn, t), () => { clearInterval(iv); open = false; });
}

export function raidAck(ctx, msg) {
  if (!open) return;
  const btn = document.querySelector('.ov.raid .grab');
  if (btn) btn.textContent = msg.position > 0 ? `#${msg.position}!` : 'MISSED';
}

export function raidResult(ctx, msg) {
  const mine = (msg.winners || []).find((w) => w.id === ctx.store.playerId);
  if (mine) ctx.toast(`Bank raid: +${money(mine.amount)}`, 'good', 3000);
  else ctx.toast(`Raid over: ${(msg.winners || []).map((w) => w.name).join(', ') || 'nobody'} got the cash`, 'gold');
  if (open) close();
}
