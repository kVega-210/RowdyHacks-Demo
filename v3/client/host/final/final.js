// CL-08 host final results: podium, stash reveal, awards and the Gemini roast (AI-02).
import { money } from '/shared/protocol.js';
import { esc } from '../fx/fx.js';

export function render(main, f, roast, room) {
  const rows = f.standings || [];
  const top = [rows[1], rows[0], rows[2]];
  const medals = ['🥈', '🥇', '🥉'];
  main.innerHTML = `
    <div class="center-stage" style="justify-content:flex-start">
      <h1>${esc(f.winnerName || '?')} WINS!</h1>
      ${f.winningTeam ? `<h2>Winning crew: ${esc(f.winningTeam)}</h2>` : ''}
      <div class="podium">${top.map((r, i) => (r ? `<div class="step p${[2, 1, 3][i]}"><div class="medal">${medals[i]} ${esc(r.face || '')}</div>${esc(r.name)}<div style="color:var(--gold)">${money(r.stash)}</div></div>` : '<div class="step" style="visibility:hidden"></div>')).join('')}</div>
      <div class="awards" id="awards"></div>
      <div class="roast" id="roast"><div class="panel">🎤 The Mastermind is preparing the roast...</div></div>
      <div class="final-foot">Replay: ${esc(location.origin)}/replay/?room=${esc(room)} · <a href="/host/" style="color:var(--cyan)">New heist</a></div>
    </div>`;
  if (roast) renderRoast(roast);
}

export function renderRoast(roast) {
  const a = roast.awards || {};
  const aw = document.getElementById('awards');
  if (aw) aw.innerHTML = `<span>🏆 Biggest Thief: <b>${esc(a.biggestThief || '-')}</b></span><span>🐔 Chicken: <b>${esc(a.chicken || '-')}</b></span><span>😬 Closest Call: <b>${esc(a.closestCall || '-')}</b></span>`;
  const box = document.getElementById('roast');
  if (box) box.innerHTML = (roast.players || []).map((p) => `<div class="panel"><h3>${esc(p.name)}</h3>${p.lines.slice(0, 2).map((l) => `<div>${esc(l)}</div>`).join('')}</div>`).join('');
  // v2: only keep roast cards that fit fully above the terminal (the terminal has every line anyway).
  if (box) requestAnimationFrame(() => {
    const limit = box.getBoundingClientRect().bottom;
    [...box.children].forEach((c) => { if (c.getBoundingClientRect().bottom > limit + 1) c.remove(); });
  });
}
