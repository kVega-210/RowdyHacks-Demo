// v3 host view of live rival duels (rival rounds and rival events): one card per pair with both faces, the game,
// a live bar showing who is ahead, and the result. update() patches a card in place for the ~12Hz duel_state stream.
import { money } from '/shared/protocol.js';
import { esc } from '../fx/fx.js';

let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.duels{height:100%;display:flex;flex-direction:column;gap:min(14px,2cqh)}
.duels h1{margin:0;text-align:center;font:900 min(64px,10cqh) var(--font-display);color:var(--title);letter-spacing:.06em}
.duels h2{margin:0;text-align:center;font-size:min(26px,4cqh);color:var(--dim)}
.duel-grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(520px,100%),1fr));gap:min(14px,2cqh);align-content:center}
.dcard{background:var(--panel);border:3px solid var(--line);border-radius:22px;padding:min(14px,2cqh) 20px;display:flex;flex-direction:column;gap:min(10px,1.4cqh)}
.dcard.done{border-color:var(--gold)}
.dcard .row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px}
.dcard .p{display:flex;align-items:center;gap:10px;font:900 min(28px,4.4cqh) var(--font-display);min-width:0}
.dcard .p span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dcard .p b{font-size:1.5em;line-height:1}
.dcard .p.b{justify-content:flex-end;text-align:right}
.dcard .p.win span{color:#3dff9a}.dcard .p.lose{opacity:.45}
.dcard .vs{font:900 min(18px,2.8cqh) var(--font-display);color:var(--label);text-align:center;letter-spacing:.1em}
.dcard .bar{position:relative;height:min(18px,2.6cqh);border-radius:9px;background:linear-gradient(90deg,var(--gold) 0 50%,var(--cyan) 50% 100%);opacity:.9;overflow:hidden}
.dcard .bar i{position:absolute;top:-2px;bottom:-2px;width:8px;margin-left:-4px;background:#fff;box-shadow:0 0 12px #fff;border-radius:4px;transition:left .15s linear}
.dcard .st{text-align:center;font:800 min(22px,3.4cqh) var(--font-display);color:var(--dim);min-height:1.2em}
.dcard.done .st{color:var(--gold)}
/* big crews: up to 15 duels at once */
.duel-grid.many{grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr));gap:8px}
.duel-grid.many .dcard{padding:6px 12px;gap:4px;border-width:2px;border-radius:14px}
.duel-grid.many .dcard .p{font-size:min(18px,2.6cqh)}.duel-grid.many .dcard .vs{font-size:min(12px,1.8cqh)}
.duel-grid.many .dcard .bar{height:8px}.duel-grid.many .dcard .st{font-size:min(14px,2.1cqh)}
.duel-grid.huge{grid-template-columns:repeat(3,1fr)}
`;
  document.head.append(s);
}

const pct = (bar) => 50 - Math.max(-1, Math.min(1, bar || 0)) * 46; // a (left) ahead -> marker moves left... toward a

function card(d) {
  const res = d.result;
  const aCls = res && res.winnerId ? (res.winnerId === d.a.id ? 'win' : 'lose') : '';
  const bCls = res && res.winnerId ? (res.winnerId === d.b.id ? 'win' : 'lose') : '';
  const status = res ? (res.draw || !res.winnerId ? 'DRAW' : `${esc(res.winnerName)} WINS +${money(res.amount || 0)}`) : esc(d.status || 'GET READY...');
  return `<div class="dcard${res ? ' done' : ''}" data-duel="${esc(d.duelId)}">
    <div class="row"><div class="p a ${aCls}"><b>${esc(d.a.face)}</b><span>${esc(d.a.name)}</span></div>
      <div class="vs">⚔️ ${esc(String(d.name).toUpperCase())}</div>
      <div class="p b ${bCls}"><span>${esc(d.b.name)}</span><b>${esc(d.b.face)}</b></div></div>
    <div class="bar"><i style="left:${pct(d.bar)}%"></i></div>
    <div class="st">${status}</div></div>`;
}

/** Full render. store.duels: id -> duel (from duel_start, patched by duel_state / duel_end). */
export function render(main, store) {
  style();
  const list = Object.values(store.duels || {});
  main.innerHTML = `<div class="duels"><h1>${store.rivalEvent ? '⚔️ RIVAL EVENT' : '⚔️ RIVAL ROUND'}</h1>
    <h2>${store.rivalEvent ? 'Jobs paused. Everyone duels a random rival.' : 'Everyone vs their rival. Every duel pays the winner.'}</h2>
    <div class="duel-grid${list.length > 9 ? ' many huge' : list.length > 4 ? ' many' : ''}">${list.map(card).join('') || '<div class="dcard"><div class="st">Pairing up the crew...</div></div>'}</div></div>`;
}

/** Patch one card from duel_state without re-rendering the page. */
export function update(m) {
  const el = document.querySelector(`.dcard[data-duel="${CSS.escape ? CSS.escape(m.duelId) : m.duelId}"]`);
  if (!el) return false;
  const i = el.querySelector('.bar i');
  if (i) i.style.left = pct(m.bar) + '%';
  const st = el.querySelector('.st');
  if (st && !el.classList.contains('done')) st.textContent = 'LIVE';
  return true;
}
