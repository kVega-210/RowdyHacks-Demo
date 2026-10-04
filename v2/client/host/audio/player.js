// AU-03 host narrator playback: a priority queue where FREEZE and the empty bank cut in, music ducking while
// the Mastermind talks, an event -> line mapper with random variants, and graceful fallbacks:
// pre-generated ElevenLabs mp3 (manifest.json, AU-02) -> Web Speech API -> silence.
import { music } from '../../fx/sfx.js';

const URGENT = new Set(['freeze', 'bank_0']);

// Fallback voice (browser Web Speech, used when there is no ElevenLabs mp3 for a line). Tweak freely:
// voice: first installed voice whose name matches (e.g. /daniel|google uk english male/i); lang: preferred language;
// rate 0.1-10 (1 = normal), pitch 0-2 (1 = normal). The ElevenLabs voice is set with ELEVENLABS_VOICE_ID in .env.
const FALLBACK_VOICE = { voice: /male|daniel|arthur/i, lang: /en-GB/i, rate: 1.05, pitch: 0.8 };

export class Narrator {
  constructor() {
    this.lines = {};
    this.named = {};
    this.manifest = {};
    this.queue = [];
    this.current = null;
    this.unlocked = false;
    this.enabled = true;
    this.recent = new Map();
    this.ready = this.load();
  }

  async load() {
    const [nar, man] = await Promise.all([
      fetch('/content/narrator.json').then((r) => r.json()).catch(() => ({ lines: [], named: [] })),
      fetch('/host/audio/manifest.json').then((r) => (r.ok ? r.json() : { lines: {} })).catch(() => ({ lines: {} })),
    ]);
    for (const l of nar.lines || []) (this.lines[l.event] ||= []).push(l);
    for (const l of nar.named || []) (this.named[l.event] ||= []).push(l);
    this.manifest = man.lines || {};
  }

  unlock() {
    this.unlocked = true;
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }

  /** Map a server narrate key (+vars) to a line and queue it. */
  async say(key, vars = {}) {
    if (!this.enabled) return;
    await this.ready;
    let event = key;
    if (key === 'round_intro' && vars.type && this.lines['round_' + vars.type]) event = 'round_' + vars.type;
    // Personalised line through /api/tts (AU-04) for a few events, when a name is known.
    const name = vars.name || vars.thief || vars.hacker;
    if (name && this.named[event] && Math.random() < 0.6) {
      const n = this.pick(this.named[event]);
      return this.enqueue({ event, named: n, name, urgent: URGENT.has(event) });
    }
    const pool = this.lines[event];
    if (!pool || !pool.length) return undefined;
    return this.enqueue({ event, line: this.pick(pool), urgent: URGENT.has(event) });
  }

  pick(pool) {
    const last = this.recent.get(pool);
    let l = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && l === last) l = pool[(pool.indexOf(l) + 1) % pool.length];
    this.recent.set(pool, l);
    return l;
  }

  /** v2 Freeze: cut the current line, drop the queue and ignore new lines until hush(false). */
  hush(on) {
    this.hushed = !!on;
    if (on) { this.queue = []; this.stopCurrent(); } else music.duck(false);
  }

  enqueue(item) {
    if (this.hushed) return;
    if (item.urgent) {
      this.queue = this.queue.filter((q) => q.urgent);
      this.queue.unshift(item);
      this.stopCurrent();
    } else {
      if (this.queue.length > 3) this.queue.shift();
      this.queue.push(item);
    }
    if (!this.current) this.next();
  }

  stopCurrent() {
    if (!this.current) return;
    try { this.current.stop(); } catch (_) { /* ignore */ }
    this.current = null;
  }

  async next() {
    const item = this.queue.shift();
    if (!item) { music.duck(false); return; }
    music.duck(true);
    const done = () => { if (this.current && this.current.item === item) { this.current = null; this.next(); } };
    this.current = { item, stop: () => {} };
    try {
      if (item.named) {
        const res = await this.fetchNamed(item.named.id, item.name);
        if (res.audio) return this.playUrl(res.audio, item, done);
        const fallback = res.lineId && this.findLine(res.lineId);
        if (fallback && this.manifest[fallback.id]) return this.playUrl(this.manifest[fallback.id].file, item, done);
        return this.speak(item.named.text.replace('{name}', item.name), item, done);
      }
      const m = this.manifest[item.line.id];
      if (m && this.unlocked) return this.playUrl(m.file, item, done);
      return this.speak(item.line.text, item, done);
    } catch (_) {
      done();
    }
    return undefined;
  }

  findLine(id) {
    for (const pool of Object.values(this.lines)) for (const l of pool) if (l.id === id) return l;
    return null;
  }

  async fetchNamed(id, name) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1800);
    try {
      const r = await fetch(`/api/tts?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`, { signal: ctrl.signal });
      if ((r.headers.get('content-type') || '').includes('audio')) return { audio: URL.createObjectURL(await r.blob()) };
      return await r.json();
    } catch (_) {
      return {};
    } finally {
      clearTimeout(t);
    }
  }

  playUrl(url, item, done) {
    const a = new Audio(url);
    this.current = { item, stop: () => { a.pause(); } };
    a.onended = done;
    a.onerror = () => this.speak(item.line ? item.line.text : '', item, done);
    a.play().catch(() => this.speak(item.line ? item.line.text : '', item, done));
  }

  speak(text, item, done) {
    if (!text || !('speechSynthesis' in window) || !this.unlocked) { setTimeout(done, 200); return; }
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    u.voice = voices.find((v) => FALLBACK_VOICE.lang.test(v.lang) && FALLBACK_VOICE.voice.test(v.name))
      || voices.find((v) => FALLBACK_VOICE.voice.test(v.name)) || voices.find((v) => /^en/i.test(v.lang)) || null;
    u.rate = FALLBACK_VOICE.rate;
    u.pitch = FALLBACK_VOICE.pitch;
    u.onend = done;
    u.onerror = done;
    this.current = { item, stop: () => window.speechSynthesis.cancel() };
    window.speechSynthesis.speak(u);
  }
}
