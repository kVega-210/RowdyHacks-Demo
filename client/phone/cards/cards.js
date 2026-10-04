// PH-04 card draw and group vote (phone side). Enter the number on a physical card -> everyone sees the card ->
// the other phones vote pass/fail for 10s -> the server applies the majority result. Opt-out button for the drawer.
import { h, money, bigBtn, tap } from '../ui.js';

export function entry(ctx) {
  const input = h('input', { class: 'field code', inputmode: 'numeric', maxlength: 2, placeholder: '#', style: { letterSpacing: '.1em' } });
  return h('div', { class: 'card' },
    h('h2', {}, '🃏 Drew a card?'),
    h('div', { class: 'muted' }, 'Type the number on the card. The crew votes on whether you pulled it off.'),
    input,
    bigBtn('PLAY CARD', () => {
      const n = parseInt(input.value, 10);
      if (!n) return ctx.toast('Enter the card number', 'bad');
      ctx.send({ t: 'card_play', number: n });
      input.value = '';
    }, 'alt'));
}

/** Render every open vote into `box` (called whenever votes change). */
export function renderVotes(ctx, box) {
  if (!box) return;
  const votes = Object.values(ctx.store.votes);
  box.replaceChildren(...votes.map((v) => {
    const mine = v.playerId === ctx.store.playerId;
    const left = h('span', { class: 'pill' });
    const iv = setInterval(() => { if (!left.isConnected) return clearInterval(iv); left.textContent = Math.ceil(ctx.sock.msUntil(v.endsAt) / 1000) + 's'; }, 250);
    const card = h('div', { class: 'card', style: { borderColor: 'var(--gold)' } },
      h('div', { class: 'row', style: { alignItems: 'center' } }, h('b', {}, `${v.playerName} drew #${v.card.number}: ${v.card.title}`), left),
      h('p', {}, v.card.text));
    if (mine) {
      card.append(h('div', { class: 'muted' }, 'Do it now! The crew is voting.'),
        bigBtn(v.card.physical ? 'OPT OUT (free)' : 'OPT OUT (fee)', () => ctx.send({ t: 'card_optout', voteId: v.voteId }), 'dim'));
    } else if (v.voted) {
      card.append(h('div', { class: 'center muted' }, `You voted ${v.voted}`));
    } else {
      card.append(h('div', { class: 'grid2' },
        bigBtn('👍 PASS', () => { v.voted = 'pass'; ctx.send({ t: 'card_vote', voteId: v.voteId, pass: true }); renderVotes(ctx, box); }, 'green'),
        bigBtn('👎 FAIL', () => { v.voted = 'fail'; ctx.send({ t: 'card_vote', voteId: v.voteId, pass: false }); renderVotes(ctx, box); }, 'red')));
    }
    return card;
  }));
}

export function result(ctx, msg) {
  const me = msg.playerId === ctx.store.playerId;
  const verdict = msg.optOut ? 'opted out' : msg.passed ? 'PASSED' : 'FAILED';
  const delta = msg.delta ? ` (${msg.delta > 0 ? '+' : ''}${money(msg.delta)})` : '';
  ctx.toast(`${me ? 'You' : msg.playerName}: card ${verdict}${delta}. ${msg.note || ''}`, msg.passed && !msg.optOut ? 'good' : 'bad', 3500);
}
export { tap };
