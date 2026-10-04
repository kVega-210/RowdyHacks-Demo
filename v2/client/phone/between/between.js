// CL-07 between-round screen: next-round countdown, the Sabotage picker (BE-11 / CT-02) and standings.
// v2: the card deck is gone. v2: victims are picked by animal face in a compact grid, side by side with the tricks,
// so nothing has to scroll; players hit last round are shielded and can't be picked.
import { h, money, view, countdown, bigBtn } from '../ui.js';

let names = null;
async function modifierNames() {
  if (!names) names = fetch('/content/modifiers.json').then((r) => r.json()).then((j) => Object.fromEntries(j.modifiers.map((m) => [m.id, m]))).catch(() => ({}));
  return names;
}

const CSS = `
.sab{padding:10px 10px 12px}
.sab h2{margin:0 0 6px;font-size:18px;display:flex;justify-content:space-between;align-items:baseline}
.sab h2 small{font-size:12px;color:var(--dim);font-weight:600}
.sab-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sab-col small{display:block;font-size:10px;letter-spacing:.12em;color:var(--dim);text-transform:uppercase;margin-bottom:4px}
.sab-faces{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:6px}
.sab-face{position:relative;aspect-ratio:1;border-radius:12px;border:2px solid var(--line);background:#0b1120;font-size:28px;line-height:1;padding:0;color:inherit}
.sab-face.on{border-color:var(--red);background:#3a1220;box-shadow:0 0 10px #ff224466}
.sab-face[disabled]{opacity:.35}
.sab-face[disabled]::after{content:'🛡️';position:absolute;right:-4px;bottom:-4px;font-size:16px}
.sab-mods{display:grid;gap:6px}
.sab-mod{display:flex;align-items:center;gap:6px;min-height:40px;padding:4px 8px;border-radius:12px;border:2px solid var(--line);background:#0b1120;color:var(--ink);font-weight:800;font-size:14px;text-align:left}
.sab-mod span{font-size:20px}
.sab-mod.on{border-color:var(--gold);background:#2b2410}
.sab-pick{margin-top:6px;font-size:13px;color:var(--dim);min-height:17px;text-align:center}
.sab .big-btn{min-height:52px;margin-top:6px;font-size:20px}
.face-name{font-size:20px;margin-right:6px}
`;
let styled = false;

export async function render(ctx) {
  if (!styled) { styled = true; document.head.append(h('style', {}, CSS)); }
  const s = ctx.store;
  const st = s.state;
  const others = st ? st.players.filter((p) => p.id !== s.playerId) : [];
  const nextRound = (s.between && s.between.nextRound) || (st && st.round + 1);
  const ot = s.between && s.between.overtime;
  const parts = [
    h('div', { class: 'banner' }, ot ? `Overtime ${ot} up next` : `Break before round ${nextRound}`),
    st && st.endsAt > 0 ? countdown(ctx.sock, st.endsAt) : null,
  ];
  if (s.between && s.between.sabotage && !s.sabotageSent) {
    const info = await modifierNames();
    const immune = new Set(s.between.immune || []);
    let target = null, mod = null;
    const fBox = h('div', { class: 'sab-faces' }), mBox = h('div', { class: 'sab-mods' }), pick = h('div', { class: 'sab-pick' });
    const draw = () => {
      fBox.replaceChildren(...others.map((p) => {
        const b = h('button', { class: 'sab-face' + (target === p.id ? ' on' : ''), type: 'button', title: p.name, disabled: immune.has(p.id) }, p.face || '🐾');
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (b.disabled) return; target = p.id; draw(); });
        return b;
      }));
      mBox.replaceChildren(...(s.between.modifiers || []).map((id) => {
        const m = info[id] || { name: id };
        const b = h('button', { class: 'sab-mod' + (mod === id ? ' on' : ''), type: 'button' }, h('span', {}, m.icon || '😈'), m.name);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); mod = id; draw(); });
        return b;
      }));
      const t = others.find((p) => p.id === target);
      pick.textContent = t || mod ? `${t ? `${t.face} ${t.name}` : 'pick a face'} · ${mod ? (info[mod] || { name: mod }).name : 'pick a trick'}`
        : immune.size ? '🛡️ = hit last round, safe for now' : 'One per round. It hits one of their next jobs.';
    };
    draw();
    parts.push(h('div', { class: 'card sab' },
      h('h2', {}, '😈 Sabotage', h('small', {}, 'one per break')),
      h('div', { class: 'sab-cols' },
        h('div', { class: 'sab-col' }, h('small', {}, 'Victim'), fBox),
        h('div', { class: 'sab-col' }, h('small', {}, 'Dirty trick'), mBox)),
      pick,
      bigBtn('SABOTAGE!', () => {
        if (!target || !mod) return ctx.toast('Pick a face and a trick', 'bad');
        ctx.send({ t: 'sabotage', targetId: target, modifier: mod });
      }, 'red')));
  } else if (s.sabotageSent) {
    parts.push(h('div', { class: 'card center' }, `😈 Sabotage queued: ${s.sabotageSent}`));
  }
  if (st) {
    const ranked = st.players.slice().sort((a, b) => (b.wallet + b.stash) - (a.wallet + a.stash));
    parts.push(h('div', { class: 'card' }, h('h2', {}, `Bank: ${money(st.bank)}`),
      h('ul', { class: 'roster' }, ranked.map((p) => h('li', { class: (p.id === s.playerId ? 'me ' : '') + (p.on ? '' : 'off') },
        h('span', {}, h('span', { class: 'face-name' }, p.face || ''), p.name + (p.team ? ` · ${p.team}` : '')), h('span', {}, money(p.wallet + p.stash)))))));
  }
  view(...parts);
}
