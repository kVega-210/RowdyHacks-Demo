// Phone client entry. Holds the store, routes server messages to the screen modules, and sends intents.
import { HeistSocket } from '/shared/protocol.js';
import { h, toast, view, countdown, bigBtn, money } from './ui.js';
import * as join from './join/join.js';
import { Hud } from './hud/hud.js';
import { Runner } from './runner/runner.js';
import * as ov from './overlays/overlays.js';
import * as raid from './overlays/bankraid.js';
import * as between from './between/between.js';
import * as cards from './cards/cards.js';
import * as target from './target/target.js';
import * as final from './final/final.js';
import { openScanner } from './scanner/scanner.js';
import { sfx, unlockAudio } from '../fx/sfx.js';

const balance = await fetch('/shared/balance.json').then((r) => r.json());

const store = {
  room: null, playerId: null, token: null, name: null, phase: null, state: null, me: null,
  round: null, assign: null, votes: {}, between: null, sabotageSent: null, escaped: null, final: null, roast: null,
  virtualKeys: true, vaultName: null, keyCode: null, pending: null, hvh: null,
};

const sock = new HeistSocket({
  heartbeatMs: balance.net.heartbeatMs,
  onOpen() {
    const p = store.pending;
    if (store.token && store.room) sock.send({ t: 'resume', room: store.room, token: store.token });
    else if (p) sock.send({ t: 'join', room: p.room, name: p.name });
  },
  onStatus(s) { document.getElementById('net').hidden = s === 'open' || !store.room; },
  onMessage: (m) => { try { handle(m); } catch (e) { console.error(m.t, e); } },
});

const ctx = {
  store, sock, balance, toast,
  send: (m) => { if (!sock.send(m)) toast('Offline. Reconnecting...', 'bad'); },
  join(room, name) {
    unlockAudio();
    store.token = null;
    store.room = room;
    store.name = name;
    store.pending = { room, name };
    sock.ws && sock.ws.readyState === 1 ? sock.onOpen() : sock.connect();
  },
  resume(saved) {
    unlockAudio();
    Object.assign(store, { room: saved.room, token: saved.token, name: saved.name });
    sock.ws && sock.ws.readyState === 1 ? sock.onOpen() : sock.connect();
  },
};

const hud = new Hud(ctx);
const runner = new Runner(ctx);

function handle(m) {
  switch (m.t) {
    case 'welcome':
      Object.assign(store, { room: m.room, playerId: m.playerId, token: m.token, name: m.name, virtualKeys: m.virtualKeys,
        vaultName: m.vaultName, keyCode: m.keyCode, pending: null });
      join.saveSession({ room: m.room, token: m.token, name: m.name });
      if (m.resumed) toast('Back in the heist!', 'good');
      break;
    case 'error':
      if (m.code === 'bad_token' || m.code === 'no_room' || m.code === 'game_in_progress' || m.code === 'room_full' || m.code === 'bad_name') {
        join.clearSession();
        Object.assign(store, { token: null, room: null, playerId: null, pending: null });
        sock.close();
        hud.show(false);
        runner.hide();
        join.render(ctx, { error: m.message });
      } else if (m.code !== 'rate_limited') toast(m.message || m.code, 'bad');
      return;
    case 'kicked':
      join.clearSession();
      Object.assign(store, { token: null, room: null });
      sock.close();
      join.render(ctx, { error: 'You were removed from the room.' });
      return;
    case 'state':
      store.state = m;
      store.me = m.me || store.me;
      hud.update(m);
      if (store.phase === 'lobby') renderPhase();
      break;
    case 'phase_changed':
      onPhase(m);
      break;
    case 'round_start':
      store.round = m;
      store.escaped = null;
      if (store.phase === 'briefing') renderPhase();
      break;
    case 'minigame_assign':
      store.assign = m;
      if (store.phase === 'play') { view(); runner.run(m); }
      break;
    case 'minigame_ack':
      if (m.accepted === false) toast('Too fast! Nice try.', 'bad');
      else if (m.success) toast(`+${money(m.delta)}`, 'good', 1200);
      else toast(m.delta ? `${money(m.delta)}` : 'Fail!', 'bad', 1200);
      if (store.phase === 'play' && store.assign && store.assign.attemptId === m.attemptId) runner.waiting();
      break;
    case 'modifier_apply': runner.applyModifier(m); break;
    case 'steal_open': ov.steal(ctx, m); break;
    case 'steal_result': case 'steal_closed': ov.stealDone(ctx, m); break;
    case 'steal_reject': ov.stealReject(ctx, m); break;
    case 'freeze_start': ov.freeze(ctx, m); break;
    case 'freeze_end': ov.freezeEnd(ctx); break;
    case 'freeze_penalty': ov.freezePenalty(ctx, m); break;
    case 'bankraid_open': raid.raidOpen(ctx, m); break;
    case 'bankraid_ack': raid.raidAck(ctx, m); break;
    case 'bankraid_result': raid.raidResult(ctx, m); break;
    case 'bank_warning': toast(m.pct === 0 ? '🏦 THE BANK IS EMPTY!' : `🏦 Bank down to ${m.pct}%`, 'gold', 2500); break;
    case 'round_results': store.lastResults = m; if (store.phase === 'results') target.results(ctx, m); break;
    case 'between': store.between = m; store.sabotageSent = null; if (store.phase === 'between') renderPhase(); break;
    case 'sabotage_ack':
      store.sabotageSent = `${m.modifier} on ${m.targetName}`;
      toast(`Sabotage set on ${m.targetName}`, 'good');
      if (store.phase === 'between') renderPhase();
      break;
    case 'card_vote_open': store.votes[m.voteId] = m; cards.renderVotes(ctx, ctx.votesBox); sfx.play('tick'); break;
    case 'card_vote_result': delete store.votes[m.voteId]; cards.renderVotes(ctx, ctx.votesBox); cards.result(ctx, m); break;
    case 'teams_update': toast('Crew shake-up! Teams were swapped.', 'gold'); break;
    case 'hvh_start': toast(`💻 Hacker vs Hacker: ${m.hackerName} is gunning for ${m.victimName}`, 'gold', 3500); break;
    case 'hvh_power': showScramble(m); break;
    case 'hvh_ack': store.hvh && (store.hvh.uses = m.usesLeft); showScramble(store.hvh); break;
    case 'hvh_bonus': toast(`Scramble paid off: +${money(m.amount)}`, 'good'); break;
    case 'rival_start': store.rival = m; if (store.phase === 'play') renderPhase(); break;
    case 'rival_result':
      toast(m.winnerId === store.playerId ? `You won the showdown! +${money(m.amount)}` : `${m.winnerName} won the showdown`, m.winnerId === store.playerId ? 'good' : 'gold', 3500);
      break;
    case 'escape_open': if (store.phase === 'escape') final.escape(ctx); break;
    case 'escape_ack': final.escaped(ctx, m); break;
    case 'final_standings': store.final = m; if (store.phase === 'end') final.standings(ctx); break;
    case 'roast': final.roast(ctx, m); break;
    case 'key_claimed': store.vaultName = m.vaultName; toast(`Vault claimed: ${m.vaultName}`, 'good'); renderPhase(); break;
    default: break;
  }
}

function onPhase(m) {
  const prev = store.phase;
  store.phase = m.phase;
  if (store.state) Object.assign(store.state, { phase: m.phase, round: m.round, endsAt: m.endsAt });
  if (m.phase !== 'play') { runner.hide(); removeScramble(); }
  if (m.phase === 'play' && prev !== 'play') store.assign = null;
  if (m.phase === 'briefing') { store.rival = null; store.hvh = null; }
  if (m.phase !== 'between') store.votes = {};
  if (m.phase === 'escape') sfx.play('alarm');
  ov.close();
  renderPhase();
}

function renderPhase() {
  const s = store;
  hud.show(!!s.playerId && s.phase !== 'lobby' && s.phase !== 'end');
  switch (s.phase) {
    case 'lobby': return renderLobby();
    case 'briefing': return renderBriefing();
    case 'play':
      if (s.round && s.round.spectator) {
        runner.hide();
        const r = s.rival;
        return view(h('div', { class: 'wait' }, h('b', {}, '🍿 Rival Heist'),
          r ? `${r.a.name} vs ${r.b.name} on ${r.gameId}. Watch the big screen!` : 'Two crooks are dueling. Watch the big screen!'));
      }
      view();
      if (s.assign) runner.run(s.assign); else runner.waiting();
      return undefined;
    case 'results': return s.lastResults && s.lastResults.round === s.state.round ? target.results(ctx, s.lastResults) : view(h('div', { class: 'wait' }, h('b', {}, '💰'), 'Counting the loot...'));
    case 'between': return between.render(ctx);
    case 'escape': return final.escape(ctx);
    case 'end': return s.final ? final.standings(ctx) : view(h('div', { class: 'wait' }, h('b', {}, '🏁'), 'Tallying up...'));
    default: return undefined;
  }
}

function renderLobby() {
  const s = store;
  const st = s.state;
  const me = st && st.players.find((p) => p.id === s.playerId);
  const parts = [h('h1', {}, 'You\'re in!'), h('div', { class: 'center' }, h('span', { class: 'pill' }, `Room ${s.room}`), ' ', h('span', { class: 'pill' }, s.name))];
  if (me && me.vault) {
    parts.push(h('div', { class: 'card center' }, h('div', { class: 'muted' }, 'Your vault'), h('div', { style: { fontSize: '24px', fontWeight: 900, color: 'var(--gold)' } }, s.vaultName || `Vault ${me.vault}`),
      s.virtualKeys ? h('div', { class: 'muted' }, 'Virtual keys are on: steals happen on screen.') : h('div', { class: 'muted' }, 'Keep your key close. Rivals will try to scan it!')));
  } else if (!s.virtualKeys) {
    const holder = h('div', { style: { display: 'flex', justifyContent: 'center' } });
    parts.push(h('div', { class: 'card center' }, h('h2', {}, '🔑 Claim your vault'), h('div', { class: 'muted' }, 'Grab a key from the table and scan its tag.'),
      bigBtn('📷 SCAN MY KEY', () => {
        holder.replaceChildren();
        openScanner(holder, { title: 'Scan your key tag', onCode: (code) => ctx.send({ t: 'key_claim', code }) });
      }), holder));
  }
  if (st) parts.push(h('div', { class: 'card' }, h('h2', {}, `Crew (${st.players.length})`),
    h('ul', { class: 'roster' }, st.players.map((p) => h('li', { class: (p.id === s.playerId ? 'me ' : '') + (p.on ? '' : 'off') },
      h('span', {}, p.name + (p.bot ? ' 🤖' : '')), h('span', {}, p.vault ? '🔑' : '…'))))));
  parts.push(h('p', { class: 'center muted' }, 'Waiting for the host to start the heist...'),
    bigBtn('Leave room', () => { ctx.send({ t: 'leave' }); join.clearSession(); location.href = '/phone/'; }, 'dim'));
  view(...parts);
}

function renderBriefing() {
  const s = store;
  const r = s.round;
  const parts = [h('div', { class: 'banner' }, r ? `Round ${r.round}/${r.rounds}` : 'Get ready'),
    r ? h('div', { class: 'card center' }, h('b', {}, r.banner), h('div', { class: 'muted' }, `Speed x${r.speed} · Difficulty ${r.difficulty}`)) : null,
    target.briefingReveal(r)];
  if (r && r.modifiers && r.modifiers.length) parts.push(h('div', { class: 'card center', style: { borderColor: 'var(--red)' } }, '😈 Someone sabotaged you! Expect trouble.'));
  if (r && r.duel) parts.push(h('div', { class: 'card center', style: { borderColor: 'var(--gold)' } }, `⚔️ You're in the Rival Heist vs ${r.duel.opponentName}! First to crack it wins the pot.`));
  if (r && r.spectator) parts.push(h('div', { class: 'card center' }, '🍿 Rival Heist: you are spectating this round.'));
  if (r && r.hacker) parts.push(h('div', { class: 'card center', style: { borderColor: '#c77dff' } }, '💻 You have the SCRAMBLE power this round!'));
  if (s.state && s.state.endsAt > 0) parts.push(countdown(sock, s.state.endsAt));
  view(...parts);
}

function showScramble(p) {
  store.hvh = p;
  removeScramble();
  if (!p || p.uses <= 0) return;
  const b = h('button', { class: 'hvh', id: 'hvh', type: 'button' }, `SCRAMBLE ${p.victimName} (${p.uses})`);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); ctx.send({ t: 'hack_scramble' }); });
  document.getElementById('app').append(b);
}
function removeScramble() { const b = document.getElementById('hvh'); if (b) b.remove(); }

// Boot: rejoin silently if we have a session for this room, else show the join screen.
const saved = join.loadSession();
const wantRoom = new URLSearchParams(location.search).get('room');
if (saved && saved.token && (!wantRoom || wantRoom.toUpperCase() === saved.room)) {
  ctx.resume(saved);
  view(h('div', { class: 'wait' }, h('b', {}, '🔐'), 'Reconnecting to your heist...'));
  setTimeout(() => { if (!store.playerId) join.render(ctx); }, 4000);
} else {
  join.render(ctx);
}
window.__phone = { store, ctx };
