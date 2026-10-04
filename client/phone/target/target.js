// MG-44 Bounty Hunter (player side): the target is only ever shown to its hunter (hold the HUD 🎯 box);
// at round end this screen compares your haul against your target's and animates the bounty payout.
import { h, money, view, countdown } from '../ui.js';
import { sfx } from '../../fx/sfx.js';

export function briefingReveal(round) {
  if (!round || !round.target) return null;
  return h('div', { class: 'card center' },
    h('div', { class: 'muted' }, 'SECRET TARGET (only you can see this)'),
    h('div', { style: { fontSize: '28px', fontWeight: 900, color: 'var(--red)' } }, '🎯 ' + round.target.name),
    h('div', { class: 'muted' }, 'Out-earn them this round for a bounty. Hold the 🎯 box on your HUD to peek again.'));
}

export function results(ctx, msg) {
  const b = msg.bounty;
  const table = (msg.table || []).slice().sort((x, y) => y.earned - x.earned);
  const parts = [h('div', { class: 'banner' }, `Round ${msg.round} loot`)];
  if (b) {
    const max = Math.max(1, Math.abs(b.mine), Math.abs(b.theirs));
    const mineBar = h('div', { class: 'bar me' }, money(b.mine));
    const theirBar = h('div', { class: 'bar' }, money(b.theirs));
    const payout = h('div', { class: 'payout', style: { visibility: 'hidden' } }, b.won ? `BOUNTY +${money(b.amount)}` : 'No bounty');
    parts.push(h('div', { class: 'card bounty' },
      h('div', { class: 'muted' }, 'BOUNTY HUNT'),
      h('div', { class: 'vs' }, mineBar, theirBar),
      h('div', { class: 'names' }, h('span', {}, 'You'), h('span', {}, '🎯 ' + b.targetName)),
      payout));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      mineBar.style.height = Math.max(4, (Math.max(0, b.mine) / max) * 150) + 'px';
      theirBar.style.height = Math.max(4, (Math.max(0, b.theirs) / max) * 150) + 'px';
    }));
    setTimeout(() => {
      payout.style.visibility = 'visible';
      if (!b.won) payout.style.color = 'var(--dim)';
      else sfx.play('coin');
    }, 900);
  }
  if (msg.teamDelta) parts.push(h('div', { class: 'card center' }, `Crew split: ${msg.teamDelta >= 0 ? '+' : ''}${money(msg.teamDelta)}`));
  parts.push(h('div', { class: 'card' }, h('ul', { class: 'roster' }, table.map((r) =>
    h('li', { class: r.id === ctx.store.playerId ? 'me' : '' }, h('span', {}, r.name), h('span', {}, (r.earned >= 0 ? '+' : '') + money(r.earned)))))));
  if (ctx.store.state && ctx.store.state.endsAt > 0) parts.push(h('div', { class: 'center muted' }, 'Next up in'), countdown(ctx.sock, ctx.store.state.endsAt));
  view(...parts);
}
