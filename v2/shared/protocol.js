// DOC-02 runtime half: message names plus a reconnecting WebSocket client shared by the host and phone apps.
// The wire contract (payload shapes, error codes, reconnect handshake) is documented in /docs/protocol.md and
// typed in /shared/protocol.d.ts. Clients send intents only; the server never trusts client timestamps.

/** Client -> server intents. */
export const C2S = Object.freeze({
  CREATE_ROOM: 'create_room', HOST_RESUME: 'host_resume', JOIN: 'join', RESUME: 'resume', LEAVE: 'leave', PING: 'ping',
  START_GAME: 'start_game', SETTINGS: 'settings', FILL_BOTS: 'fill_bots', ADMIN: 'admin',
  MINIGAME_RESULT: 'minigame_result', FREEZE_VIOLATION: 'freeze_violation', SABOTAGE: 'sabotage', HACK_SCRAMBLE: 'hack_scramble',
});

/** Server -> client state/events. */
export const S2C = Object.freeze({
  WELCOME: 'welcome', ERROR: 'error', PONG: 'pong', STATE: 'state', PHASE_CHANGED: 'phase_changed', SETTINGS: 'settings',
  ROUND_START: 'round_start', MINIGAME_ASSIGN: 'minigame_assign', MINIGAME_ACK: 'minigame_ack',
  FREEZE_START: 'freeze_start', FREEZE_END: 'freeze_end', FREEZE_PENALTY: 'freeze_penalty',
  BANK_WARNING: 'bank_warning', ROUND_RESULTS: 'round_results', BETWEEN: 'between', TEAMS_UPDATE: 'teams_update',
  SABOTAGE_ACK: 'sabotage_ack',
  MODIFIER_APPLY: 'modifier_apply', HVH_START: 'hvh_start', HVH_POWER: 'hvh_power', HVH_ACK: 'hvh_ack', HVH_BONUS: 'hvh_bonus',
  RIVAL_START: 'rival_start', RIVAL_RESULT: 'rival_result',
  FINAL_STANDINGS: 'final_standings', ROAST: 'roast', KICKED: 'kicked',
  NARRATE: 'narrate', FX: 'fx',
});

export const PHASES = Object.freeze(['lobby', 'briefing', 'play', 'results', 'between', 'end']);

/**
 * Reconnecting socket. onOpen fires on every (re)connect so the app can send join/resume/host_resume.
 * Tracks the server clock offset from any message carrying `now`, so countdowns use server time.
 */
export class HeistSocket {
  constructor({ url, onMessage, onOpen, onStatus, heartbeatMs = 10000 } = {}) {
    this.url = url || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    this.onMessage = onMessage || (() => {});
    this.onOpen = onOpen || (() => {});
    this.onStatus = onStatus || (() => {});
    this.heartbeatMs = heartbeatMs;
    this.offset = 0;
    this.retry = 0;
    this.closed = false;
    this.ws = null;
    this.hb = 0;
    this.lastMsgAt = 0;
  }

  connect() {
    this.closed = false;
    this.onStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.lastMsgAt = Date.now();
      this.onStatus('open');
      this.onOpen();
      clearInterval(this.hb);
      this.hb = setInterval(() => {
        this.send({ t: C2S.PING });
        // No traffic for 3 heartbeats: assume a dead socket (bad Wi-Fi) and reconnect.
        if (Date.now() - this.lastMsgAt > this.heartbeatMs * 3) ws.close();
      }, this.heartbeatMs);
    };
    ws.onmessage = (ev) => {
      this.lastMsgAt = Date.now();
      let m;
      try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (typeof m.now === 'number') this.offset = m.now - Date.now();
      this.onMessage(m);
    };
    ws.onclose = () => {
      clearInterval(this.hb);
      if (this.ws !== ws) return;
      this.onStatus('closed');
      if (this.closed) return;
      const delay = Math.min(5000, 300 * 2 ** this.retry++) + Math.random() * 300;
      setTimeout(() => { if (!this.closed) this.connect(); }, delay);
    };
    ws.onerror = () => {};
    return this;
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  /** Server time now (ms), corrected by the last observed offset. */
  serverNow() { return Date.now() + this.offset; }

  /** Milliseconds until a server timestamp. */
  msUntil(serverTs) { return serverTs > 0 ? Math.max(0, serverTs - this.serverNow()) : 0; }

  close() { this.closed = true; clearInterval(this.hb); if (this.ws) this.ws.close(); }
}

/** "$1,234" */
export const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
