// CL-08 final results (stash reveal, podium, Gemini roast slot). v2: no escape button; wallets are banked automatically.
import { h, money, view } from '../ui.js';
import { sfx } from '../../fx/sfx.js';

export function standings(ctx) {
  const s = ctx.store;
  const f = s.final;
  if (!f) return;
  const rows = f.standings || [];
  const me = rows.find((r) => r.id === s.playerId);
  const top = [rows[1], rows[0], rows[2]];
  const roastBox = h('div', { class: 'card', id: 'roast' }, h('h2', {}, '🎤 The Mastermind roasts you'), h('div', { class: 'muted' }, 'Loading roast...'));
  view(
    h('div', { class: 'banner' }, f.winnerId === s.playerId ? '👑 YOU WIN! 👑' : `${f.winnerName} wins!`),
    me ? h('div', { class: 'card center' }, h('div', { class: 'muted' }, 'Your stash'), h('div', { class: 'payout' }, money(me.stash)),
      h('div', {}, `#${me.rank} of ${rows.length}`)) : null,
    h('div', { class: 'podium' }, top.map((r, i) => (r ? h('div', { class: ['p2', 'p1', 'p3'][i] }, h('div', {}, ['🥈', '🥇', '🥉'][i], ' ', r.face || ''), r.name, h('div', {}, money(r.stash))) : h('div', { style: { visibility: 'hidden' } })))),
    f.winningTeam ? h('div', { class: 'card center' }, `Winning crew: ${f.winningTeam}`) : null,
    h('div', { class: 'card' }, h('ul', { class: 'roster' }, rows.map((r) => h('li', { class: r.id === s.playerId ? 'me' : '' },
      h('span', {}, `#${r.rank} ${r.face || ''} ${r.name}`), h('span', {}, money(r.stash)))))),
    roastBox,
    h('p', { class: 'center' }, h('a', { href: `/replay/?room=${s.room}`, style: { color: 'var(--cyan)' } }, 'Watch the heist replay')),
  );
  if (s.roast) roast(ctx, { roast: s.roast });
  if (f.winnerId === s.playerId) sfx.play('win');
}

export function roast(ctx, msg) {
  ctx.store.roast = msg.roast;
  const box = document.getElementById('roast');
  if (!box || !msg.roast) return;
  const mine = (msg.roast.players || []).find((p) => p.name === ctx.store.name);
  const a = msg.roast.awards || {};
  box.replaceChildren(h('h2', {}, '🎤 The Mastermind roasts you'),
    ...(mine ? mine.lines.map((l) => h('div', { class: 'roast-line' }, l)) : [h('div', { class: 'muted' }, 'You escaped the roast. Lucky.')]),
    h('div', { class: 'muted', style: { marginTop: '10px' } },
      `🏆 Biggest Thief: ${a.biggestThief || '-'} · 🐔 Chicken: ${a.chicken || '-'} · 😬 Closest Call: ${a.closestCall || '-'}`));
}
