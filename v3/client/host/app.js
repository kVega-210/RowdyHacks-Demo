// CL-02 host screen entry: lobby with huge room code + join QR, then the live game board.
import { HeistSocket, money } from '/shared/protocol.js';
import { Narrator } from './audio/player.js';
import { shake, bankDrain, esc } from './fx/fx.js';
import { createTerminal } from '../fx/terminal.js';
import { sirenRise, sirenClear } from '../fx/siren.js';
import { fadeSwap, setHeat, setFrozen } from '../fx/screen.js';
import { setTheme, themeForRound } from '../fx/theme.js';
import { banner, flash, clearFlash } from './overlays/overlays.js';
import { installAdmin } from './admin/admin.js';
import * as rivalView from './rival/rival.js';
import * as finalView from './final/final.js';
import { sfx, music, unlockAudio, freezeAudio } from '../fx/sfx.js';

// Loaded by /boot.js before this module runs (no top-level await: older browsers can't parse it).
const balance = window.__HH.balance;
const info = window.__HH.info || { publicUrl: location.origin };
const KEY = 'hh.host';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { /* ok */ } };

const store = { room: null, hostToken: null, settings: null, state: null, phase: 'lobby', round: 0, rounds: balance.rounds.count,
  roundType: null, banner: '', duels: {}, rivalEvent: false, results: null, final: null, roast: null, prevBank: null, overtime: 0 };
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
    else sock.send({ t: 'create_room', settings: {} });
  },
  onMessage: (m) => { try { handle(m); } catch (e) { console.error(m.t, e); } },
});
const ctx = { store, send: (m) => sock.send(m) };
const admin = installAdmin(ctx);

// v3: "New heist" on the final screen opens a new lobby with everyone who is still connected.
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-new-heist]');
  if (!b) return;
  e.preventDefault();
  b.disabled = true;
  b.textContent = 'Opening a new room...';
  sock.send({ t: 'new_heist' });
});

document.addEventListener('click', () => {
  unlockAudio();
  narrator.unlock();
  $('unlock').remove();
}, { once: true });

function handle(m) {
  switch (m.t) {
    case 'welcome':
      if (store.room && store.room !== m.room) Object.assign(store, { final: null, roast: null, duels: {}, rivalEvent: false }); // New heist
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
    case 'freeze_warning':
      sirenRise(termEl, Math.max(300, (m.startsAt || 0) - sock.serverNow()));
      L('WARNING: FREEZE IMMINENT', 'warn');
      break;
    case 'freeze_start':
      sirenClear();
      store.freezeEndsAt = m.endsAt;
      if (m.roundEndsAt) store.endsAt = m.roundEndsAt;
      flash('freeze', balance.freeze.windowMs); banner('freeze', 'FREEZE!', 'HANDS OFF YOUR PHONES', balance.freeze.windowMs);
      startFreeze(Math.max(500, m.endsAt - sock.serverNow()));
      L('FREEZE! ALL CLOCKS PAUSED.', 'warn');
      break;
    case 'freeze_end': clearFlash(); store.freezeEndsAt = 0; endFreeze(); L('FREEZE LIFTED', 'dim'); break;
    case 'bank_warning':
      banner('info', m.pct === 0 ? 'THE BANK IS EMPTY!' : `BANK AT ${m.pct}%`, m.pct === 0 ? 'Heist over. Wallets banked.' : '', 2200);
      L(m.pct === 0 ? 'BANK EMPTY. HEIST OVER. WALLETS AUTO-BANKED.' : `BANK RESERVES AT ${m.pct}%`, 'warn');
      shake();
      break;
    case 'fx': onFx(m); break;
    case 'client_error': L(`PHONE COULD NOT START (${m.device}): ${m.message}`, 'bad'); break;
    case 'narrate': if (!freezeAudio.active) narrator.say(m.key, m.vars || {}); break; // only the siren during a Freeze
    // v3 rival duels
    case 'rival_round':
      L(`${m.event ? 'RIVAL EVENT' : 'RIVAL ROUND'}: ${(m.pairs || []).map((p) => `${p.a.face} ${p.a.name} VS ${p.b.face} ${p.b.name}`).join(' · ')}`, 'warn');
      if (m.event) banner('info', '⚔️ RIVAL EVENT!', 'Jobs paused. Everyone duels a random rival.', 2600);
      break;
    case 'rival_event_start':
      store.rivalEvent = true; store.duels = {};
      store.freezeEndsAt = m.endsAt;
      if (m.roundEndsAt) store.endsAt = m.roundEndsAt;
      sfx.play('alarm');
      if (store.phase === 'play') fadeSwap(render);
      break;
    case 'rival_event_end':
      store.rivalEvent = false; store.duels = {};
      store.freezeEndsAt = 0;
      if (m.roundEndsAt) store.endsAt = m.roundEndsAt;
      L('RIVAL EVENT OVER. JOBS RESUME.', 'dim');
      if (store.phase === 'play') fadeSwap(render);
      break;
    case 'duel_start':
      store.duels[m.duelId] = Object.assign({}, m, { bar: 0 });
      if (showingDuels()) render();
      break;
    case 'duel_state': {
      const d = store.duels[m.duelId];
      if (d) { d.bar = m.bar; d.status = 'LIVE'; rivalView.update(m); }
      break;
    }
    case 'duel_end': {
      const d = store.duels[m.duelId];
      if (!d || m.aborted) break;
      d.result = m; d.bar = m.state ? m.state.bar : d.bar;
      L(m.draw || !m.winnerId ? `DUEL ${d.a.name} VS ${d.b.name}: DRAW` : `${m.winnerName} WON THE ${String(d.name).toUpperCase()} DUEL +${money(m.amount)}`, m.draw ? 'dim' : 'good');
      if (m.winnerId) sfx.play('success', { minGapMs: 300 });
      if (showingDuels()) render();
      // In a rival round the pair's next duel replaces this card a few seconds later.
      if (!store.rivalEvent) setTimeout(() => { if (store.duels[m.duelId] === d) { delete store.duels[m.duelId]; if (showingDuels()) render(); } }, 3200);
      break;
    }
    case 'hvh_start': banner('info', '💻 HACKER vs HACKER', `${m.hackerName} can scramble ${m.victimName}`, 3000); L(`HACKER VS HACKER: ${m.hackerName} TARGETS ${m.victimName}`, 'warn'); break;
    case 'teams_update': banner('info', 'CREW SHAKE-UP!', 'Teams swapped', 2000); L('CREW SHAKE-UP: TEAMS SWAPPED', 'warn'); break;
    case 'final_standings':
      store.final = m;
      L(`HEIST COMPLETE. WINNER: ${m.winnerName}`, 'good');
      (m.standings || []).forEach((r) => L(`#${r.rank} ${r.face || ''} ${r.name}  STASH ${money(r.stash)}`, r.rank === 1 ? 'good' : ''));
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

// v2 Freeze: everything stops. Music off, narrator cut, all other sounds muted, the screen stops moving, and
// only a looping siren plays until freeze_end.
function startFreeze(ms) {
  narrator.hush(true);
  freezeAudio.start(ms);
  setFrozen(true);
}
function endFreeze() {
  if (!document.documentElement.classList.contains('hh-frozen') && !freezeAudio.active) return;
  freezeAudio.end();
  setFrozen(false);
  narrator.hush(false);
}

function onFx(m) {
  const game = String(m.gameId || '').replace(/-/g, ' ').toUpperCase();
  // Soundboard on the big screen for everyone's jobs (throttled so a burst of results doesn't turn into noise).
  if (m.kind === 'fail') { L(`${m.name} FAILED ${game} ${m.amount ? money(m.amount) : ''}`, 'bad'); sfx.play('fail', { minGapMs: 350 }); }
  else if (m.kind === 'success') { L(`${m.name} CRACKED ${game} +${money(m.amount)}`, 'good'); sfx.play('success', { minGapMs: 250 }); }
  else if (m.kind === 'freeze_violation') L(`${m.name} MOVED DURING FREEZE ${money(m.amount)}`, 'bad');
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
  briefing: (m) => [m.overtime ? `OVERTIME ${m.overtime}: ${String(m.roundType || '').toUpperCase()}. BANK STILL HAS CASH.` : `ROUND ${m.round}/${m.rounds}: ${String(m.roundType || '').toUpperCase()}`, 'warn'],
  play: () => ['JOBS LIVE', 'dim'],
  results: () => ['ROUND OVER. COUNTING LOOT...', 'dim'],
  between: () => ['SAFEHOUSE BREAK', 'dim'],
  end: () => ['BANK EMPTY. WALLETS AUTO-BANKED. HEIST ARCHIVED. SCROLL TO REVIEW.', 'dim'],
};

function onPhase(m) {
  const prev = store.phase;
  if (!m.resync && PHASE_LOG[m.phase]) { const [t, k] = PHASE_LOG[m.phase](m); L(t, k); }
  term.setScrollable(m.phase === 'end');
  if (m.phase !== 'play') { sirenClear(); store.freezeEndsAt = 0; endFreeze(); store.rivalEvent = false; }
  Object.assign(store, { phase: m.phase, round: m.round, rounds: m.rounds, roundType: m.roundType, banner: m.banner, endsAt: m.endsAt, overtime: m.overtime || 0 });
  if (m.phase === 'briefing') {
    store.duels = {}; store.rivalEvent = false;
    music.start(balance.speed.base * balance.speed.perRound ** Math.max(0, m.round - 1));
    music.setRate(balance.speed.base * balance.speed.perRound ** Math.max(0, m.round - 1));
    if (m.round === 1 && !m.resync) narrator.say('game_start');
  }
  if (m.phase === 'between') narrator.say('between');
  if (m.phase === 'results' && prev === 'play') narrator.say('results');
  if (m.phase !== 'play') clearFlash();
  if (m.phase !== prev) fadeSwap(render); else render();
}

// ---------------------------------------------------------------- views

function topBar() {
  const s = store;
  $('roundInfo').innerHTML = s.phase === 'lobby' ? '<small>Waiting for the crew</small>'
    : s.phase === 'end' ? 'Heist complete'
      : s.overtime ? `Overtime ${s.overtime} <small>${esc((s.roundType || '').toUpperCase())}</small>`
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
  const heat = store.phase === 'play' ? 1 - ms / balance.rounds.playMs : 0;
  setHeat(heat);
  music.setIntensity(heat); // pitch and tempo climb as the round clock runs out
  t.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  t.classList.toggle('low', ms < 10000 && store.phase === 'play');
  if (store.phase === 'briefing') { const el = $('brief-count'); if (el) el.textContent = Math.ceil(ms / 1000); }
}, 200);

function render() {
  // v3: the theme follows the round type (render runs under the fade-to-black, so the swap is hidden).
  setTheme(store.phase === 'lobby' ? 'classic' : themeForRound(store.roundType));
  topBar();
  switch (store.phase) {
    case 'lobby': return renderLobby();
    case 'briefing': return renderBriefing();
    case 'play': return showingDuels() ? rivalView.render(main, store) : renderBoard();
    case 'results': return renderResults();
    case 'between': return renderBetween();
    case 'end': return store.final ? finalView.render(main, store.final, store.roast, store.room) : (main.innerHTML = '<div class="center-stage"><h1>Counting the loot...</h1></div>');
    default: return undefined;
  }
}

function showingDuels() {
  return store.phase === 'play' && (store.rivalEvent || store.roundType === 'rival');
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
        <div class="label">ROOM CODE</div>
        <div class="code">${esc(s.room)}</div>
        <img alt="Join QR" src="/api/qr?size=520&text=${encodeURIComponent(joinUrl)}">
        <div class="url">${esc(joinUrl.replace(/^https?:\/\//, ''))}</div>
        <div class="join-help">QR not working? Type <b>${esc(joinUrl.replace(/^https?:\/\//, ''))}</b> into Chrome or Safari.<br>
          Brave: if it warns about a secure connection, tap <b>Continue</b> (or turn Shields off for this site).</div>
      </div>
      <div style="display:flex;flex-direction:column;min-height:0">
        <h2 style="margin:0 0 12px;font-size:34px">The crew (${players.length}/${balance.players.max})</h2>
        <div class="vault-preview">${players.length ? (() => { const e = economyPreview(players.length, set.rounds > 0 ? set.rounds : balance.rounds.count); return `🏦 Vault <b>${money(e.bank)}</b> · ≈ <b>${money(e.perJob)}</b> per job`; })() : 'Bigger crew = bigger vault = bigger payouts'}</div>
        <div class="roster-grid${players.length > 16 ? ' huge' : players.length > 8 ? ' many' : ''}">${players.map((p) => `<div class="chip ${p.on ? '' : 'off'}"><span><span class="face">${esc(p.face || '')}</span> ${esc(p.name)}</span><span>${p.bot ? '🤖' : ''}</span></div>`).join('') || '<div style="color:var(--dim)">Scan the QR or open the URL on your phone</div>'}</div>
        <div class="settings">
          <label><input type="checkbox" id="optTeams" ${set.teams ? 'checked' : ''}> Team mode</label>
          <label>Rounds <select id="optRounds">${roundsOpts}</select></label>
        </div>
        <div style="display:flex;gap:14px;margin-top:auto">
          <button class="btn alt" id="bots">${players.length < 6 ? '🤖 Fill with bots' : '🤖 +6 bots'}</button>
          <button class="btn" id="start" ${players.length < balance.players.min ? 'disabled' : ''}>START THE HEIST</button>
        </div>
      </div>
    </div>`;
  const sendSettings = () => sock.send({ t: 'settings', settings: { teams: $('optTeams').checked, rounds: Number($('optRounds').value) } });
  ['optTeams', 'optRounds'].forEach((id) => { $(id).onchange = sendSettings; });
  // Fill to 6, then each press adds 6 more (up to the room maximum) to try big crews.
  $('bots').onclick = () => sock.send({ t: 'fill_bots', count: players.length < 6 ? 6 - players.length : Math.min(6, balance.players.max - players.length) });
  $('start').onclick = () => { unlockAudio(); narrator.unlock(); sock.send({ t: 'start_game' }); };
}

function renderBriefing() {
  const s = store;
  main.innerHTML = `<div class="center-stage">
    <h2 style="color:var(--dim)">${s.overtime ? `OVERTIME ${s.overtime} · THE BANK STILL HAS CASH` : `ROUND ${s.round} OF ${s.rounds}`}</h2>
    <h1>${esc((s.roundType || '').toUpperCase())}</h1>
    <h2>${esc(s.banner || '')}</h2>
    <h2 class="sub">Speed x${(balance.speed.base * balance.speed.perRound ** (s.round - 1)).toFixed(2)} · check your phone for your secret target</h2>
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
  const cols = columnsFor(ranked.length);
  const rowHtml = (p, i) => {
    const bump = prev[p.id] && prev[p.id].wallet !== p.wallet ? ' bump' : '';
    return `<div class="row${p.on ? '' : ' off'}${bump}"><span class="rank">${i + 1}</span><span class="face">${esc(p.face || '')}</span><span class="name">${esc(p.name)}${p.team ? ` <small style="color:var(--dim)">${esc(p.team)}</small>` : ''}</span>
        <span class="wallet">${money(p.wallet + p.stash)}</span></div>`;
  };
  // v3: up to 10 crooks per column; big crews get 2-3 columns side by side.
  board.className = 'board' + (cols > 1 ? ` multi cols${cols}` : '');
  board.style.setProperty('--per', Math.ceil(ranked.length / cols));
  let k = 0;
  board.innerHTML = chunk(ranked, cols).map((part) => `<div class="bcol"><div class="head"><span>#</span><span></span><span>CROOK</span><span style="text-align:right">WALLET</span></div>${part.map((p) => rowHtml(p, k++)).join('')}</div>`).join('');
}

// v3 big crews (up to 30): split long lists into side-by-side columns of at most `per` rows.
function columnsFor(n, per = 10) { return Math.max(1, Math.ceil(n / per)); }
function chunk(list, cols) {
  const size = Math.ceil(list.length / cols) || 1;
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
/** Starting vault and ~cash per completed job for a crew of n (mirrors Economy.startingBank / roundScale). */
function economyPreview(n, rounds) {
  const bank = Math.round(balance.bank.startPerPlayer * Math.pow(Math.max(1, n), balance.bank.crewExponent));
  const perJob = Math.round(bank / Math.max(1, rounds) / Math.max(1, n) / balance.economy.expectedPaidJobsPerPlayer);
  return { bank, perJob };
}

function faceOf(id) {
  const p = store.state && store.state.players.find((x) => x.id === id);
  return p ? p.face || '' : '';
}

/** Results-style tables, split into side-by-side columns for big crews. */
function tables(rows, rowHtml) {
  const cols = columnsFor(rows.length);
  const parts = chunk(rows, cols);
  return `<div class="table-cols">${parts.map((part) => `<table class="results-table" style="--rows:${Math.max(4, Math.ceil(rows.length / cols))}">${part.map(rowHtml).join('')}</table>`).join('')}</div>`;
}

function renderResults() {
  const r = store.results;
  if (!r) { main.innerHTML = '<div class="center-stage"><h1>Counting...</h1></div>'; return; }
  const rows = (r.table || []).slice().sort((a, b) => b.earned - a.earned);
  main.innerHTML = `<div class="center-stage" style="justify-content:flex-start">
    <h1 class="sm">ROUND ${r.round} LOOT</h1>
    ${tables(rows, (p) => `<tr><td>${esc(faceOf(p.id))} ${esc(p.name)}</td><td class="num ${p.earned >= 0 ? 'plus' : 'minus'}">${p.earned >= 0 ? '+' : ''}${money(p.earned)}</td><td class="num" style="color:var(--gold)">${money(p.wallet + p.stash)}</td></tr>`)}
    <h2>${r.bounties ? `🎯 ${r.bounties} bounty hunter${r.bounties === 1 ? '' : 's'} got paid` : '🎯 No bounties this round'} · Bank ${money(r.bank)}</h2></div>`;
}

function renderBetween() {
  const s = store.state;
  main.innerHTML = `<div class="center-stage" style="justify-content:flex-start">
    <h1 class="sm">BREAK TIME</h1>
    <h2 class="sub">Plot your sabotage on your phone.</h2>
    ${s ? tables(s.players.slice().sort((a, b) => (b.wallet + b.stash) - (a.wallet + a.stash)), (p) => `<tr><td>${esc(p.face || '')} ${esc(p.name)}</td><td class="num" style="color:var(--gold)">${money(p.wallet + p.stash)}</td></tr>`) : ''}
  </div>`;
}

sock.connect();
render();
window.__host = { store, sock };
