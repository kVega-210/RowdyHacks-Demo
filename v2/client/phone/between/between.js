// CL-07 between-round screen: bank state, standings, optional card prompt (PH-04), the Sabotage picker
// (BE-11 / CT-02) and the next-round countdown.
import { h, money, view, countdown, bigBtn } from '../ui.js';
import * as cards from '../cards/cards.js';

let names = null;
async function modifierNames() {
  if (!names) names = fetch('/content/modifiers.json').then((r) => r.json()).then((j) => Object.fromEntries(j.modifiers.map((m) => [m.id, m]))).catch(() => ({}));
  return names;
}

export async function render(ctx) {
  const s = ctx.store;
  const st = s.state;
  const others = st ? st.players.filter((p) => p.id !== s.playerId) : [];
  const votesBox = h('div');
  const parts = [
    h('div', { class: 'banner' }, `Break before round ${(s.between && s.between.nextRound) || (st && st.round + 1)}`),
    st && st.endsAt > 0 ? countdown(ctx.sock, st.endsAt) : null,
    votesBox,
  ];
  if (s.between && s.between.sabotage && !s.sabotageSent) {
    const info = await modifierNames();
    let target = null, mod = null;
    const tBox = h('div'), mBox = h('div');
    const draw = () => {
      tBox.replaceChildren(...others.map((p) => {
        const b = h('button', { class: 'choice' + (target === p.id ? ' on' : ''), type: 'button' }, p.name);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); target = p.id; draw(); });
        return b;
      }));
      mBox.replaceChildren(...(s.between.modifiers || []).map((id) => {
        const m = info[id] || { name: id, pick: '' };
        const b = h('button', { class: 'choice' + (mod === id ? ' on' : ''), type: 'button' }, h('b', {}, m.name), h('div', { class: 'muted' }, m.pick || ''));
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); mod = id; draw(); });
        return b;
      }));
    };
    draw();
    parts.push(h('div', { class: 'card' },
      h('h2', {}, '😈 Sabotage someone'),
      h('div', { class: 'muted' }, 'One per round. It hits their next minigames.'),
      h('label', { class: 'lbl' }, 'Victim'), tBox,
      h('label', { class: 'lbl' }, 'Dirty trick'), mBox,
      bigBtn('SABOTAGE!', () => {
        if (!target || !mod) return ctx.toast('Pick a victim and a trick', 'bad');
        ctx.send({ t: 'sabotage', targetId: target, modifier: mod });
      }, 'red')));
  } else if (s.sabotageSent) {
    parts.push(h('div', { class: 'card center' }, `😈 Sabotage queued: ${s.sabotageSent}`));
  }
  parts.push(cards.entry(ctx));
  if (st) {
    const ranked = st.players.slice().sort((a, b) => (b.wallet + b.stash) - (a.wallet + a.stash));
    parts.push(h('div', { class: 'card' }, h('h2', {}, `Bank: ${money(st.bank)}`),
      h('ul', { class: 'roster' }, ranked.map((p) => h('li', { class: (p.id === s.playerId ? 'me ' : '') + (p.on ? '' : 'off') },
        h('span', {}, p.name + (p.team ? ` · ${p.team}` : '')), h('span', {}, `${money(p.wallet)} · 🏦${money(p.stash)}`))))));
  }
  view(...parts);
  cards.renderVotes(ctx, votesBox);
  ctx.votesBox = votesBox;
}
