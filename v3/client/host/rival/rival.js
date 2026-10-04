// MG-45 Rival Heist spectator view for the big screen: two duelists, one vault, everyone else watches.
import { money } from '/shared/protocol.js';

export function render(main, rival, result) {
  const card = (p) => {
    const d = document.createElement('div');
    d.className = 'side-card' + (result ? (result.winnerId === p.id ? ' win' : ' lose') : '');
    d.textContent = p.name;
    if (result && result.winnerId === p.id) { const s = document.createElement('div'); s.style.fontSize = '36px'; s.textContent = `+${money(result.amount)}`; d.append(s); }
    if (result && result.loserId === p.id && result.penalty) { const s = document.createElement('div'); s.style.fontSize = '30px'; s.style.color = 'var(--red)'; s.textContent = `-${money(result.penalty)}`; d.append(s); }
    return d;
  };
  const wrap = document.createElement('div');
  wrap.className = 'rival';
  const vs = document.createElement('div');
  vs.className = 'vs';
  vs.textContent = result ? '🏆' : 'VS';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = result ? `${result.winnerName} cracked it first!` : `Same vault, same seed: ${rival.gameId}. Pot: ${money(rival.pot)}. First to crack it wins.`;
  wrap.append(card(rival.a), vs, card(rival.b), meta);
  main.replaceChildren(wrap);
}
