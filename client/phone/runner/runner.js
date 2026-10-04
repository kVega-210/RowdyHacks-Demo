// CL-03 phone minigame runner. Loads the minigame named in minigame_assign, applies difficulty/speed, the
// optional wager wrapper and sabotage modifiers, and reports exactly one result intent per attempt.
// Also handles Wake Lock and the iOS quirks (audio unlock on first tap, no zoom/scroll in the game box).
import { h } from '../ui.js';
import { unlockAudio } from '../../fx/sfx.js';
import { startNerves } from '../../presage/nerves.js';

const modCache = new Map();
const load = (file) => {
  if (!modCache.has(file)) modCache.set(file, import(file));
  return modCache.get(file);
};
const jsonCache = new Map();
const loadJson = (url) => {
  if (!jsonCache.has(url)) jsonCache.set(url, fetch(url).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  return jsonCache.get(url);
};

export class Runner {
  constructor(ctx) {
    this.ctx = ctx;
    this.box = document.getElementById('game');
    this.current = null;
    this.attemptId = null;
    this.removers = [];
    this.wakeLock = null;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.current) this.lockScreen(); });
    document.addEventListener('pointerdown', unlockAudio, { once: true });
  }

  async lockScreen() {
    try { if ('wakeLock' in navigator && !this.wakeLock) { this.wakeLock = await navigator.wakeLock.request('screen'); this.wakeLock.addEventListener('release', () => { this.wakeLock = null; }); } } catch (_) { /* not supported or denied */ }
  }

  showBox(on) {
    this.box.hidden = !on;
    document.getElementById('view').hidden = on;
  }

  waiting(text = 'Next job incoming...') {
    this.stop();
    this.showBox(true);
    this.box.replaceChildren(h('div', { class: 'wait' }, h('b', {}, '🔐'), text));
  }

  async run(a) {
    this.stop();
    this.attemptId = a.attemptId;
    const myAttempt = a.attemptId;
    this.showBox(true);
    const holder = h('div', { class: 'gamebox' });
    this.box.replaceChildren(holder);
    this.lockScreen();
    let sent = false;
    let nerves = null;
    const report = (success, res = {}) => {
      if (sent || this.attemptId !== myAttempt) return;
      sent = true;
      const msg = { t: 'minigame_result', attemptId: myAttempt, success };
      const calm = nerves && nerves.calm();
      if (calm != null) msg.nerves = { calm };
      if (res.scoreMultiplier != null) msg.scoreMultiplier = res.scoreMultiplier;
      if (res.wager) msg.wager = res.wager;
      if (!success) msg.reason = String(res.reason || 'fail').slice(0, 60);
      this.ctx.send(msg);
    };
    const balance = this.ctx.balance;
    const opts = {
      difficulty: a.difficulty, speed: a.speed, seed: a.seed, tiers: balance.wager.tiers,
      onSuccess: (r) => report(true, r), onFail: (r) => report(false, r),
    };
    try {
      const game = await load(a.file);
      if (this.attemptId !== myAttempt) return;
      if (a.wrapper) {
        const [w, content] = await Promise.all([load(`/wagers/${a.wrapper}.js`), loadJson(`/content/wagers/${a.wrapper}.json`)]);
        if (this.attemptId !== myAttempt) return;
        this.current = w.mount(holder, Object.assign({}, opts, { game, content, config: balance.wager.wrappers[a.wrapper] }));
      } else {
        this.current = game.mount(holder, opts);
      }
      for (const m of a.modifiers || []) this.applyModifier(m, 500);
      if ((this.ctx.balance.presage.games || []).includes(a.gameId)) {
        startNerves(holder).then((n) => { nerves = n; this.removers.push(() => n.stop()); });
      }
    } catch (e) {
      console.error('minigame failed to load', e);
      report(false, { reason: 'load error' });
    }
  }

  /** Apply a sabotage modifier (from round_start / minigame_assign / live modifier_apply). */
  async applyModifier(m, delay = 0) {
    try {
      const mod = await load(`/modifiers/${m.id}.js`);
      setTimeout(() => {
        if (!this.box.firstChild) return;
        const target = this.box.firstChild;
        const remove = mod.applyModifier(target, { duration: m.durationMs, strength: m.strength });
        if (typeof remove === 'function') this.removers.push(remove);
      }, delay);
      this.ctx.toast(`Sabotaged: ${mod.meta.name}!`, 'bad');
    } catch (_) { /* unknown modifier: ignore, never break the game */ }
  }

  stop() {
    this.removers.forEach((r) => { try { r(); } catch (_) { /* ignore */ } });
    this.removers = [];
    if (this.current) { try { this.current.destroy(); } catch (_) { /* ignore */ } }
    this.current = null;
    this.attemptId = null;
  }

  hide() {
    this.stop();
    this.showBox(false);
    this.box.replaceChildren();
    if (this.wakeLock) { this.wakeLock.release().catch(() => {}); this.wakeLock = null; }
  }
}
