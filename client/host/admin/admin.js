// TL-02 hidden host-only debug/admin panel. Open with ?admin=1, the backtick key, or triple-click the logo.
const ACTIONS = [
  ['force_steal', 'Force STEAL'], ['force_freeze', 'Force FREEZE'], ['force_bankraid', 'Force BANK RAID'],
  ['skip_round', 'Skip phase'], ['end_game', 'End game'],
];

export function installAdmin(ctx) {
  let panel = null;
  const toggle = () => {
    if (panel) { panel.remove(); panel = null; return; }
    panel = document.createElement('div');
    panel.id = 'admin';
    panel.innerHTML = '<h4>🛠 Admin</h4>';
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const [action, label] of ACTIONS) {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => { if (action !== 'end_game' || confirm('End the game now?')) ctx.send({ t: 'admin', action }); };
      grid.append(b);
    }
    const bank = document.createElement('input');
    bank.type = 'number';
    bank.placeholder = 'Set bank $';
    const setBank = document.createElement('button');
    setBank.textContent = 'Set bank';
    setBank.onclick = () => bank.value && ctx.send({ t: 'admin', action: 'set_bank', amount: Number(bank.value) });
    const who = document.createElement('select');
    (ctx.store.state ? ctx.store.state.players : []).forEach((p) => who.append(new Option(p.name, p.id)));
    const amt = document.createElement('input');
    amt.type = 'number';
    amt.placeholder = 'Grant $ (neg = fine)';
    const grant = document.createElement('button');
    grant.textContent = 'Grant cash';
    grant.onclick = () => amt.value && ctx.send({ t: 'admin', action: 'grant', playerId: who.value, amount: Number(amt.value) });
    const kick = document.createElement('button');
    kick.textContent = 'Kick player';
    kick.onclick = () => who.value && confirm('Kick this player?') && ctx.send({ t: 'admin', action: 'kick', playerId: who.value });
    grid.append(bank, setBank, who, amt, grant, kick);
    panel.append(grid);
    document.body.append(panel);
  };
  if (new URLSearchParams(location.search).get('admin') === '1') toggle();
  document.addEventListener('keydown', (e) => { if (e.key === '`') toggle(); });
  let clicks = 0, t = 0;
  document.getElementById('logo').addEventListener('click', () => {
    clicks++;
    clearTimeout(t);
    t = setTimeout(() => { clicks = 0; }, 600);
    if (clicks >= 3) { clicks = 0; toggle(); }
  });
  return { refresh() { if (panel) { toggle(); toggle(); } } };
}
