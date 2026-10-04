// CL-02 host screen entry: lobby with huge room code + join QR, then the live game board.
import { HeistSocket, money } from '/shared/protocol.js';
import { Narrator } from './audio/player.js';
import { shake, bankDrain, esc } from './fx/fx.js';
import { createTerminal } from '../fx/terminal.js';
import { sirenRise, sirenClear } from '../fx/siren.js';
import { fadeSwap, setHeat } from '../fx/screen.js';
import { banner, flash, clearFlash } from './overlays/overlays.js';
import { installAdmin } from './admin/admin.js';
import * as rivalView from './rival/rival.js';
import * as finalView from './final/final.js';
import { sfx, music, unlockAudio } from '../fx/sfx.js';

const balance = await fetch('/shared/balance.json').then((r) => r.json());
const info = await fetch('/api/info').then((r) => r.json()).catch(() => ({ publicUrl: location.origin }));
const KEY = 'hh.host';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { /* ok */ } };

const store = { room: null, hostToken: null, settings: null, state: null, phase: 'lobby', round: 0, rounds: balance.rounds.count,
  roundType: null, banner: '', rival: null, rivalResult: null, results: null, votes: {}, final: null, roast: null, prevBank: null, escaped: [] };
const $ = (id) => document.getElementById(id);
const main = $('main');
const narrator = new Narrator();
const termEl = $('terminal');
const term = createTerminal(termEl, { title: 'VAULT-TEC HEIST TERMINAL · ALL CREW' });
const L = (text, kind) => term.log(text, kind);
L('HEIST CONTROL ONLINE', 'dim');

const params = new URLSearchParams(location.search);
const sock = new HeistSocket({
  heartbeatMs: balance.net.heartbeatMs,
  onOpen() {
    const saved = params.get('new') ? null : load();
    if (store.room && store.hostToken) sock.send({ t: 'host_resume', room: store.room, hostToken: store.hostToken });
    else if (saved) sock.send({ t: 'host_resume', room: saved.room, hostToken: saved.hostToken });
    else sock.send({ t: 'create_room', settings: { virtualKeys: params.get('keys') !== 'physical' } });
  },
  onMessage: (m) => { try { handle(m); } catch (e) { console.error(m.t, e); } },
});
const ctx = { store, send: (m) => sock.send(m) };
const admin = installAdmin(ctx);

document.addEventListener('click', () => {
  unlockAudio();
  narrator.unlock();
  $('unlock').remove();
}, { once: true });

function handle(m) {
  switch (m.t) {
    case 'welcome':
      Object.assign(store, { room: m.room, hostToken: m.hostToken, settings: m.settings });
      save({ room: m.room, hostToken: m.hostToken });
      $('roomTag').textContent = m.room;
      L(`ROOM ${m.room} OPEN. WAITING FOR CREW.`, 'good');
      break;
    case 'error':
      if (m.code === 'bad_token' || m.code === 'no_room') {
        localStorage.removeItem(KEY);
        Object.assign(store, { room: null, hostToken: null });
        sock.send({ t: 'create_room', settings: {} });
      } else {
        banner('info', m.message || m.code, '', 2500);
      }
      break;
    case 'settings': store.settings = m.settings; if (store.phase === 'lobby') render(); break;
    case 'state': onState(m); break;
    case 'phase_changed': onPhase(m); break;
    case 'round_results': {
      store.results = m;
      const rows = (m.table || []).slice().sort((a, b) => b.earned - a.earned);
      L(`ROUND ${m.round} RESULTS: ${rows.map((r) => `${r.name} ${r.earned >= 0 ? '+' : ''}${money(r.earned)}`).join(' · ')}`, 'warn');
      if (m.bounties) L(`${m.bounties} BOUNTY HUNTER${m.bounties === 1 ? '' : 'S'} PAID`, 'good');
      if (store.phase === 'results') render();
      break;
    }
    case 'steal_open': flash('steal', 2500); banner('steal', 'STEAL!', 'Scan a rival key NOW', 2500); sfx.play('steal'); shake(); L('STEAL WINDOW OPEN', 'warn'); break;
    case 'steal_result':
      banner('steal', m.blocked ? 'BLOCKED!' : `${m.thiefName} ROBBED ${m.victimName}`, m.blocked ? 'A shield ate the steal' : `-${money(m.amount)}`, 2600);
      L(m.blocked ? `${m.thiefName}'S STEAL ON ${m.victimName} BLOCKED BY A SHIELD` : `${m.thiefName} ROBBED ${m.victimName} FOR ${money(m.amount)}`, 'bad');
      shake();
      break;
    case 'steal_closed': if (!m.winnerId) L('STEAL WINDOW CLOSED. NOBODY SCORED.', 'dim'); clearFlash(); break;
    case 'freeze_warning':
      sirenRise(termEl, Math.max(300, (m.startsAt || 0) - sock.serverNow()));
      L('WARNING: FREEZE IMMINENT', 'warn');
      break;
    case 'freeze_start':
      sirenClear();
      store.freezeEndsAt = m.endsAt;
      if (m.roundEndsAt) store.endsAt = m.roundEndsAt;
      flash('freeze', balance.freeze.windowMs); banner('freeze', 'FREEZE!', 'HANDS OFF YOUR PHONES', balance.freeze.windowMs); sfx.play('freeze');
      L('FREEZE! ALL CLOCKS PAUSED.', 'warn');
      break;
    case 'freeze_end': clearFlash(); store.freezeEndsAt = 0; L('FREEZE LIFTED', 'dim'); break;
    case 'bankraid_open': flash('raid', 2500); banner('raid', 'BANK RAID!', `First ${m.winners} to GRAB split ${money(m.bonus)}`, 2500); sfx.play('raid'); shake(); L('BANK RAID OPEN', 'warn'); break;
    case 'bankraid_result':
      L(`BANK RAID: ${(m.winners || []).map((w) => `${w.name} +${money(w.amount)}`).join(', ') || 'NOBODY GRABBED'}`, 'good');
      break;
    case 'bank_warning':
      banner('info', m.pct === 0 ? 'THE BANK IS EMPTY!' : `BANK AT ${m.pct}%`, m.pct === 0 ? 'Everybody run!' : '', 2200);
      L(m.pct === 0 ? 'BANK EMPTY. EVERYBODY RUN!' : `BANK RESERVES AT ${m.pct}%`, 'warn');
      shake();
      break;
    case 'fx': onFx(m); break;
    case 'narrate': narrator.say(m.key, m.vars || {}); break;
    case 'card_vote_open': store.votes[m.voteId] = m; L(`${m.playerName} DREW CARD #${m.card.number}: ${m.card.title}`, 'warn'); if (store.phase === 'between') render(); break;
    case 'card_vote_result':
      delete store.votes[m.voteId];
      L(`${m.playerName} CARD #${m.card}: ${m.optOut ? 'OPTED OUT' : m.passed ? 'PASSED' : 'FAILED'} ${m.delta ? money(m.delta) : ''}`, m.passed && !m.optOut ? 'good' : 'bad');
      if (store.phase === 'between') render();
      break;
    case 'rival_start': store.rival = m; store.rivalResult = null; L(`RIVAL HEIST: ${m.a.name} VS ${m.b.name}`, 'warn'); if (store.phase === 'play') render(); break;
    case 'rival_result': store.rivalResult = m; L(`${m.winnerName} WON THE SHOWDOWN +${money(m.amount)}`, 'good'); if (store.rival) rivalView.render(main, store.rival, m); sfx.play('win'); break;
    case 'hvh_start': banner('info', '💻 HACKER vs HACKER', `${m.hackerName} can scramble ${m.victimName}`, 3000); L(`HACKER VS HACKER: ${m.hackerName} TARGETS ${m.victimName}`, 'warn'); break;
    case 'teams_update': banner('info', 'CREW SHAKE-UP!', 'Teams swapped', 2000); L('CREW SHAKE-UP: TEAMS SWAPPED', 'warn'); break;
    case 'escape_open': banner('escape', 'ESCAPE!', 'Tap to bank your wallet!', 3000); sfx.play('alarm'); break;
    case 'final_standings':
      store.final = m;
      L(`HEIST COMPLETE. WINNER: ${m.winnerName}`, 'good');
      (m.standings || []).forEach((r) => L(`#${r.rank} ${r.name}  STASH ${money(r.stash)}${r.escaped ? '' : '  (CAUGHT)'}`, r.rank === 1 ? 'good' : ''));
      if (store.phase === 'end') render();
      sfx.play('win'); music.stop();
      break;
    case 'roast':
      store.roast = m.roast; finalView.renderRoast(m.roast);
      L('TRANSMISSION FROM THE MASTERMIND:', 'warn');
      (m.roast.players || []).forEach((p) => L(`${p.name}: ${p.lines[0] || ''}`, 'dim'));
      break;
    default: break;
  }
}

function onFx(m) {
  const game = String(m.gameId || '').replace(/-/g, ' ').toUpperCase();
  if (m.kind === 'fail') L(`${m.name} FAILED ${game} ${m.amount ? money(m.amount) : ''}`, 'bad');
  else if (m.kind === 'success') L(`${m.name} CRACKED ${game} +${money(m.amount)}`, 'good');
  else if (m.kind === 'freeze_violation') L(`${m.name} MOVED DURING FREEZE ${money(m.amount)}`, 'bad');
  else if (m.kind === 'escape') { store.escaped.push(m.name); L(`${m.name} ESCAPED WITH ${money(m.amount)}`, 'good'); if (store.phase === 'escape') render(); }
  else if (m.kind === 'sabotage') L(`SOMEONE QUEUED ${String(m.modifier).toUpperCase()} ON A RIVAL...`, 'warn');
}

function onState(m) {
  const prevPlayers = store.state ? store.state.players : [];
  store.state = m;
  if (m.endsAt && m.phase === store.phase) store.endsAt = m.endsAt;
  if (store.phase === 'lobby') {
    if (prevPlayers.length !== m.players.length) admin.refresh();
    return render();
  }
  updateBoard(prevPlayers);
  return undefined;
}

const PHASE_LOG = {
  briefing: (m) => [`ROUND ${m.round}/${m.rounds}: ${String(m.roundType || '').toUpperCase()}`, 'warn'],
  play: () => ['JOBS LIVE', 'dim'],
  results: () => ['ROUND OVER. COUNTING LOOT...', 'dim'],
  between: () => ['SAFEHOUSE BREAK', 'dim'],
  escape: () => ['ALARM! ESCAPE WINDOW OPEN', 'bad'],
  end: () => ['HEIST ARCHIVED. SCROLL TO REVIEW.', 'dim'],
};

function onPhase(m) {
  const prev = store.phase;
  if (!m.resync && PHASE_LOG[m.phase]) { const [t, k] = PHASE_LOG[m.phase](m); L(t, k); }
  term.setScrollable(m.phase === 'end');
  if (m.phase !== 'play') { sirenClear(); store.freezeEndsAt = 0; }
  Object.assign(store, { phase: m.phase, round: m.round, rounds: m.rounds, roundType: m.roundType, banner: m.banner, endsAt: m.endsAt });
  if (m.phase === 'briefing') {
    store.rival = null; store.rivalResult = null;
    music.start(balance.speed.base * balance.speed.perRound ** Math.max(0, m.round - 1));
    music.setRate(balance.speed.base * balance.speed.perRound ** Math.max(0, m.round - 1));
    if (m.round === 1 && !m.resync) narrator.say('game_start');
  }
  if (m.phase === 'between') { store.votes = {}; narrator.say('between'); }
  if (m.phase === 'results' && prev === 'play') narrator.say('results');
  if (m.phase === 'escape') store.escaped = [];
  if (m.phase !== 'play') clearFlash();
  if (m.phase !== prev) fadeSwap(render); else render();
}

// ---------------------------------------------------------------- views

function topBar() {
  const s = store;
  $('roundInfo').innerHTML = s.phase === 'lobby' ? '<small>Waiting for the crew</small>'
    : s.phase === 'end' ? 'Heist complete'
      : `Round ${s.round}/${s.rounds} <small>${esc((s.roundType || '').toUpperCase())}</small>`;
  $('roomTag').style.display = s.phase === 'lobby' ? 'none' : '';
}

setInterval(() => {
  const s = store.state;
  const t = $('timer');
  if (!s || !store.endsAt || store.endsAt < 0 || store.phase === 'lobby' || store.phase === 'end') { t.textContent = ''; setHeat(0); return; }
  // Paused while a Freeze runs (the server pushes the round end back by the freeze length).
  const now = sock.serverNow();
  const ms = Math.max(0, store.freezeEndsAt > now ? store.endsAt - store.freezeEndsAt : store.endsAt - now);
  setHeat(store.phase === 'play' ? 1 - ms / balance.rounds.playMs : 0);
  t.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  t.classList.toggle('low', ms < 10000 && store.phase === 'play');
  if (store.phase === 'briefing') { const el = $('brief-count'); if (el) el.textContent = Math.ceil(ms / 1000); }
}, 200);

function render() {
  topBar();
  switch (store.phase) {
    case 'lobby': return renderLobby();
    case 'briefing': return renderBriefing();
    case 'play': return store.rival ? rivalView.render(main, store.rival, store.rivalResult) : renderBoard();
    case 'results': return renderResults();
    case 'between': return renderBetween();
    case 'escape': return renderEscape();
    case 'end': return store.final ? finalView.render(main, store.final, store.roast, store.room) : (main.innerHTML = '<div class="center-stage"><h1>Counting the loot...</h1></div>');
    default: return undefined;
  }
}

function renderLobby() {
  const s = store;
  if (!s.room) { main.innerHTML = '<div class="center-stage"><h1>Opening the vault...</h1></div>'; return; }
  const joinUrl = `${info.publicUrl}/j/${s.room}`;
  const players = s.state ? s.state.players : [];
  const set = s.settings || {};
  const roundsOpts = [3, 4, 5, 6, 7, 8].map((n) => `<option ${n === (set.rounds > 0 ? set.rounds : balance.rounds.count) ? 'selected' : ''}>${n}</option>`).join('');
  main.innerHTML = `
    <div class="lobby">
      <div class="join-card">
        <div style="font-size:28px;color:var(--dim);font-weight:800">ROOM CODE</div>
        <div class="code">${esc(s.room)}</div>
        <img alt="Join QR" src="/api/qr?size=520&text=${encodeURIComponent(joinUrl)}">
        <div class="url">${esc(joinUrl.replace(/^https?:\/\//, ''))}</div>
      </div>
      <div style="display:flex;flex-direction:column;min-height:0">
        <h2 style="margin:0 0 12px;font-size:34px">The crew (${players.length}/${balance.players.max})</h2>
        <div class="roster-grid">${players.map((p) => `<div class="chip ${p.on ? '' : 'off'}"><span>${esc(p.name)}${p.bot ? ' 🤖' : ''}</span><span>${p.vault ? '🔑' : '…'}</span></div>`).join('') || '<div style="color:var(--dim)">Scan the QR or open the URL on your phone</div>'}</div>
        <div class="settings">
          <label><input type="checkbox" id="optKeys" ${set.virtualKeys === false ? 'checked' : ''}> Physical keys (QR tags)</label>
          <label><input type="checkbox" id="optTeams" ${set.teams ? 'checked' : ''}> Team mode</label>
          <label>Rounds <select id="optRounds">${roundsOpts}</select></label>
        </div>
        <div style="display:flex;gap:14px;margin-top:auto">
          <button class="btn alt" id="bots">🤖 Fill with bots</button>
          <button class="btn" id="start" ${players.length < balance.players.min ? 'disabled' : ''}>START THE HEIST</button>
        </div>
      </div>
    </div>`;
  const sendSettings = () => sock.send({ t: 'settings', settings: { virtualKeys: !$('optKeys').checked, teams: $('optTeams').checked, rounds: Number($('optRounds').value) } });
  ['optKeys', 'optTeams', 'optRounds'].forEach((id) => { $(id).onchange = sendSettings; });
  $('bots').onclick = () => sock.send({ t: 'fill_bots', count: Math.max(1, Math.min(balance.players.max, 6) - players.length) });
  $('start').onclick = () => { unlockAudio(); narrator.unlock(); sock.send({ t: 'start_game' }); };
}

function renderBriefing() {
  const s = store;
  main.innerHTML = `<div class="center-stage">
    <h2 style="color:var(--dim)">ROUND ${s.round} OF ${s.rounds}</h2>
    <h1>${esc((s.roundType || '').toUpperCase())}</h1>
    <h2>${esc(s.banner || '')}</h2>
    <div style="font-size:30px;color:var(--dim)">Speed x${(balance.speed.base * balance.speed.perRound ** (s.round - 1)).toFixed(2)} · check your phone for your secret target</div>
    <div class="big" id="brief-count"></div></div>`;
}

function renderBoard() {
  main.innerHTML = `<div class="game">
    <div class="bank" id="bank"><div class="label">BANK</div><div class="tube"><i id="tube"></i></div><div class="amount" id="bankAmt"></div></div>
    <div class="board" id="board"></div>
  </div>`;
  store.prevBank = null;
  updateBoard([]);
}

function updateBoard(prevPlayers) {
  const s = store.state;
  if (!s) return;
  const bankEl = $('bank');
  if (bankEl && s.bank != null) {
    bankDrain(bankEl, $('bankAmt'), $('tube'), store.prevBank, s.bank, s.bankStart);
    store.prevBank = s.bank;
  }
  const board = $('board');
  if (!board) return;
  const prev = Object.fromEntries(prevPlayers.map((p) => [p.id, p]));
  const ranked = s.players.slice().sort((a, b) => (b.stash + b.wallet) - (a.stash + a.wallet));
  board.innerHTML = '<div class="head"><span>#</span><span>CROOK</span><span style="text-align:right">WALLET</span><span style="text-align:right">STASH</span><span>KEY</span></div>' +
    ranked.map((p, i) => {
      const bump = prev[p.id] && prev[p.id].wallet !== p.wallet ? ' bump' : '';
      return `<div class="row${p.on ? '' : ' off'}${bump}"><span class="rank">${i + 1}</span><span class="name">${esc(p.name)}${p.team ? ` <small style="color:var(--dim)">${esc(p.team)}</small>` : ''}${p.esc ? ' 🚐' : ''}</span>
        <span class="wallet">${money(p.wallet)}</span><span class="stash">${money(p.stash)}</span><span>${p.key === 'stolen' ? '🚫' : p.key === 'held' ? '🔑' : ''}</span></div>`;
    }).join('');
}

function renderResults() {
  const r = store.results;
  if (!r) { main.innerHTML = '<div class="center-stage"><h1>Counting...</h1></div>'; return; }
  const rows = (r.table || []).slice().sort((a, b) => b.earned - a.earned);
  main.innerHTML = `<div class="center-stage" style="justify-content:flex-start">
    <h1 style="font-size:70px">ROUND ${r.round} LOOT</h1>
    <table class="results-table">${rows.map((p) => `<tr><td>${esc(p.name)}</td><td class="num ${p.earned >= 0 ? 'plus' : 'minus'}">${p.earned >= 0 ? '+' : ''}${money(p.earned)}</td><td class="num" style="color:var(--gold)">${money(p.wallet)}</td><td class="num" style="color:var(--green)">${money(p.stash)}</td></tr>`).join('')}</table>
    <h2>${r.bounties ? `🎯 ${r.bounties} bounty hunter${r.bounties === 1 ? '' : 's'} got paid` : '🎯 No bounties this round'} · Bank ${money(r.bank)}</h2></div>`;
}

function renderBetween() {
  const s = store.state;
  const votes = Object.values(store.votes);
  main.innerHTML = `<div class="center-stage" style="justify-content:flex-start">
    <h1 style="font-size:64px">BREAK TIME</h1>
    <h2 style="color:var(--dim)">Draw a card from the deck and enter its number on your phone. Plot your sabotage.</h2>
    <div class="votes">${votes.map((v) => `<div class="vote-card"><b>${esc(v.playerName)}</b> drew #${v.card.number}: <b>${esc(v.card.title)}</b><div>${esc(v.card.text)}</div><div style="color:var(--dim)">Vote on your phones!</div></div>`).join('')}</div>
    <table class="results-table">${s ? s.players.slice().sort((a, b) => (b.wallet + b.stash) - (a.wallet + a.stash)).map((p) => `<tr><td>${esc(p.name)}</td><td class="num" style="color:var(--gold)">${money(p.wallet)}</td><td class="num" style="color:var(--green)">${money(p.stash)}</td></tr>`).join('') : ''}</table>
  </div>`;
}

function renderEscape() {
  main.innerHTML = `<div class="center-stage">
    <h1 style="color:var(--red);font-size:130px">ESCAPE!</h1>
    <h2>Tap ESCAPE on your phone to bank your wallet. Unbanked cash is lost!</h2>
    <h2 style="color:var(--green)">${store.escaped.length ? 'Out the door: ' + store.escaped.map(esc).join(', ') : ''}</h2></div>`;
}

sock.connect();
render();
window.__host = { store, sock };
