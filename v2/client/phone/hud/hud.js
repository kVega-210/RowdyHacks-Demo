// CL-04 phone HUD: wallet, stash, bank remaining, countdown, hold-to-reveal secret target, key status.
import { h, money, tap } from '../ui.js';
import { setHeat } from '../../fx/screen.js';

export class Hud {
  constructor(ctx) {
    this.ctx = ctx;
    this.el = document.getElementById('hud');
    this.wallet = h('b', {}, '$0');
    this.stash = h('b', {}, '$0');
    this.key = h('b', {}, '-');
    this.keyCell = h('div', { class: 'cell key' }, h('small', {}, 'Key'), this.key);
    this.meter = h('i', { style: { width: '100%' } });
    this.bank = h('span', {}, '');
    this.clock = h('span', { class: 'clock' }, '');
    this.targetName = h('b', {}, '🎯 hold');
    this.target = h('button', { class: 'cell target', type: 'button' }, h('small', {}, 'Target'), this.targetName);
    const reveal = (on) => {
      const t = ctx.store.me && ctx.store.me.target;
      this.target.classList.toggle('revealed', on && !!t);
      this.targetName.textContent = on ? (t ? t.name : 'none yet') : '🎯 hold';
    };
    this.target.addEventListener('pointerdown', (e) => { e.preventDefault(); reveal(true); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => this.target.addEventListener(ev, () => reveal(false)));
    this.el.append(
      h('div', { class: 'cell wallet' }, h('small', {}, 'Wallet'), this.wallet),
      h('div', { class: 'cell stash' }, h('small', {}, 'Stash'), this.stash),
      this.target,
      this.keyCell,
      h('div', { class: 'cell bank' }, h('small', {}, 'Bank'), h('div', { class: 'meter' }, this.meter), this.bank, this.clock),
    );
    tap(this.keyCell, () => {
      const s = ctx.store;
      ctx.toast(s.vaultName ? `Your vault: ${s.vaultName}${s.keyCode ? ' · ' + s.keyCode : ''}` : 'No vault yet', 'gold', 3000);
    });
    setInterval(() => this.tick(), 250);
  }

  show(on) { this.el.hidden = !on; }

  update(state) {
    const me = state.players.find((p) => p.id === this.ctx.store.playerId);
    if (me) {
      this.wallet.textContent = money(me.wallet);
      this.stash.textContent = money(me.stash);
      this.key.textContent = me.key === 'stolen' ? 'STOLEN' : me.key === 'held' ? 'HELD' : 'NONE';
      this.keyCell.classList.toggle('stolen', me.key === 'stolen');
    }
    if (state.bank != null && state.bankStart) {
      this.meter.style.width = Math.max(0, (state.bank / state.bankStart) * 100) + '%';
      this.bank.textContent = money(state.bank);
    }
  }

  /** Remaining phase time; frozen while a Freeze is running (the server pushes the round end back by the freeze). */
  remaining() {
    const { store, sock } = this.ctx;
    const s = store.state;
    if (!s || !s.endsAt || s.endsAt < 0) return -1;
    const now = sock.serverNow();
    if (store.freezeEndsAt > now) return Math.max(0, s.endsAt - store.freezeEndsAt);
    return Math.max(0, s.endsAt - now);
  }

  tick() {
    const { store, balance } = this.ctx;
    const ms = this.remaining();
    setHeat(store.phase === 'play' && ms >= 0 ? 1 - ms / balance.rounds.playMs : 0);
    if (ms < 0) { this.clock.textContent = ''; return; }
    this.clock.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  }
}
