// AU-05 sound engine. Every sound is synthesised with WebAudio by default, so nothing has to be licensed or loaded.
// v2: any sound (and the music loop) can be replaced by a real audio file: list it in /assets/sfx/manifest.json.
//   sfx.play(name)       one-shot ('success' and 'fail' pick a random sound from their soundboard)
//   music.start(rate)    looping tension track; setRate(roundSpeed) between rounds,
//   music.setIntensity(0..1) within a round: pitch and tempo climb as the clock runs out (Sonic-drowning style)
let ctx = null;
let master = null;
let musicBus = null;
let muted = false;
const MASTER_VOL = 0.9;
const MUSIC_VOL = 0.55;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // A compressor keeps the louder mix from clipping when many sounds fire at once.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = MASTER_VOL;
    master.connect(comp);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_VOL;
    musicBus.connect(master);
  }
  return ctx;
}

// ---------------------------------------------------------------- optional audio files

const files = {}; // name -> AudioBuffer
let filesLoading = null;
function loadFiles() {
  if (filesLoading || !ctx) return filesLoading;
  filesLoading = fetch('/assets/sfx/manifest.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    .then((m) => Promise.all(Object.entries(m.sounds || {}).map(([name, file]) => fetch('/assets/sfx/' + file)
      .then((r) => { if (!r.ok) throw new Error(file); return r.arrayBuffer(); })
      .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then((buf) => { files[name] = buf; })
      .catch(() => { /* missing or undecodable file: keep the synth sound */ }))))
    .then(() => { if (music.on && files.music) music.restart(); });
  return filesLoading;
}

function playFile(name, { bus, loop = false, rate = 1 } = {}) {
  const c = ac();
  if (!c || !files[name] || muted || c.state !== 'running') return null;
  const s = c.createBufferSource();
  s.buffer = files[name];
  s.loop = loop;
  s.playbackRate.value = rate;
  s.connect(bus || master);
  s.start();
  return s;
}

/** Call from a user gesture (iOS needs this before any sound plays). */
export function unlockAudio() {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start(0);
  loadFiles();
}

export function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : MASTER_VOL; }

// ---------------------------------------------------------------- synth helpers

function tone(freq, dur, { type = 'square', vol = 0.25, slide = 0, delay = 0, bus } = {}) {
  const c = ac();
  if (!c || muted || c.state !== 'running') return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus || master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.3, delay = 0, hp = 800, bus } = {}) {
  const c = ac();
  if (!c || muted || c.state !== 'running') return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(bus || master);
  s.start(c.currentTime + delay);
}

/** A two-tone siren sweep (police "wee-woo"). */
function siren(cycles = 2, { lo = 650, hi = 1050, half = 0.22, vol = 0.22 } = {}) {
  for (let i = 0; i < cycles * 2; i++) {
    const up = i % 2 === 0;
    tone(up ? lo : hi, half, { type: 'sawtooth', slide: up ? hi - lo : lo - hi, vol, delay: i * half });
  }
}

const SOUNDS = {
  click: () => tone(900, 0.04, { type: 'square', vol: 0.08 }),
  // Soundboard: success
  coin: () => { tone(988, 0.08, { vol: 0.2 }); tone(1319, 0.3, { vol: 0.2, delay: 0.08 }); },
  jingle: () => [1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.18, delay: i * 0.06 })),
  register: () => {
    noise(0.05, { vol: 0.35, hp: 2500 }); // key clack
    noise(0.12, { vol: 0.25, hp: 400, delay: 0.06 }); // drawer slides out
    [2093, 2637, 3136].forEach((f) => tone(f, 0.7, { type: 'sine', vol: 0.12, delay: 0.14 })); // "ka-CHING" bell
    tone(4186, 0.5, { type: 'triangle', vol: 0.06, delay: 0.14 });
  },
  // Soundboard: fail
  fail: () => { tone(300, 0.5, { type: 'sawtooth', slide: -220, vol: 0.25 }); noise(0.3, { vol: 0.15, delay: 0.1 }); },
  siren: () => siren(2),
  cuffs: () => {
    // Ratchet clicks, then the final metallic clamp.
    for (let i = 0; i < 6; i++) { noise(0.025, { vol: 0.35, hp: 3500, delay: i * 0.045 }); tone(2400 + i * 90, 0.03, { type: 'square', vol: 0.05, delay: i * 0.045 }); }
    tone(1800, 0.25, { type: 'triangle', vol: 0.18, delay: 0.3 });
    tone(2700, 0.2, { type: 'sine', vol: 0.1, delay: 0.3 });
    noise(0.06, { vol: 0.4, hp: 1500, delay: 0.3 });
  },
  alarm: () => siren(4, { lo: 660, hi: 880, half: 0.18, vol: 0.2 }),
  freeze: () => { tone(1500, 0.6, { type: 'sine', slide: -1200, vol: 0.3 }); noise(0.5, { vol: 0.1, hp: 4000 }); },
  vault: () => { tone(80, 0.6, { type: 'triangle', vol: 0.5 }); noise(0.4, { vol: 0.2, hp: 200 }); },
  tick: () => tone(1200, 0.03, { type: 'square', vol: 0.06 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.25, delay: i * 0.12 })),
};

/** Random-pick groups: what plays when a job is completed or failed. */
const BOARDS = { success: ['register', 'coin', 'jingle'], fail: ['siren', 'cuffs'] };

const lastAt = {};
export const sfx = {
  /** Play a sound by name. A file listed in /assets/sfx/manifest.json wins over the synth version. */
  play(name, { minGapMs = 0 } = {}) {
    try {
      const board = BOARDS[name];
      if (board) name = board[Math.floor(Math.random() * board.length)];
      const now = performance.now();
      if (minGapMs && now - (lastAt[name] || 0) < minGapMs) return;
      lastAt[name] = now;
      if (files[name]) { playFile(name); return; }
      (SOUNDS[name] || (() => {}))();
    } catch (_) { /* audio is optional */ }
  },
};

// ---------------------------------------------------------------- music

/**
 * Tension loop in the spirit of Space Invaders: a marching four-note bass that never stops, with a lead arpeggio
 * and drums layered on as the round heats up. rate = the round's speed (rises every round); intensity = how far
 * through the round we are. Both raise the tempo and the pitch, and the last stretch adds a rising "drowning"
 * countdown beep. With an audio file named "music" in the manifest, that file loops instead and its playbackRate
 * (pitch + tempo together) follows the same curve.
 */
const BASS = [98, 87.31, 77.78, 73.42]; // G2 F2 Eb2 D2, the classic descending march
const LEAD = [392, 466.16, 587.33, 698.46, 783.99, 698.46, 587.33, 466.16];
export const music = {
  timer: 0, step: 0, rate: 1, intensity: 0, on: false, src: null,
  pitch() { return Math.pow(this.rate, 0.35) * Math.pow(2, (this.intensity * 7) / 12); }, // up to ~a fifth higher
  tempo() { return this.rate * (1 + 1.3 * this.intensity * this.intensity); }, // accelerates hard near the end
  start(rate = 1) {
    this.rate = rate;
    if (this.on) return;
    this.on = true;
    this.restart();
  },
  restart() {
    clearTimeout(this.timer);
    if (this.src) { try { this.src.stop(); } catch (_) { /* already stopped */ } this.src = null; }
    if (!this.on) return;
    if (files.music) {
      this.src = playFile('music', { bus: musicBus, loop: true, rate: this.fileRate() });
      return;
    }
    const tickFn = () => {
      if (!this.on) return;
      const p = this.pitch();
      const x = this.intensity;
      const i = this.step++;
      tone(BASS[i % 4] * p, 0.2, { type: 'sawtooth', vol: 0.32, bus: musicBus });
      tone(BASS[i % 4] * p / 2, 0.2, { type: 'square', vol: 0.18, bus: musicBus });
      if (i % 2 === 0) tone(150, 0.12, { type: 'sine', slide: -100, vol: 0.45, bus: musicBus }); // kick
      if (i % 4 === 2) noise(0.08, { vol: 0.18, hp: 1800, bus: musicBus }); // snare
      noise(0.03, { vol: 0.05 + 0.08 * x, hp: 7000, bus: musicBus }); // hats get louder with the heat
      if (x > 0.35) tone(LEAD[i % LEAD.length] * p, 0.1, { type: 'square', vol: 0.06 + 0.1 * x, bus: musicBus });
      if (x > 0.35) tone(LEAD[(i + 4) % LEAD.length] * p, 0.1, { type: 'square', vol: 0.05 + 0.08 * x, bus: musicBus, delay: 0.5 * this.stepMs() / 1000 });
      // Last stretch: the "running out of air" countdown beep, one step higher every beat.
      if (x > 0.8 && i % 2 === 0) tone(880 * Math.pow(2, ((x - 0.8) * 60) / 12), 0.09, { type: 'square', vol: 0.16, bus: musicBus });
      this.timer = setTimeout(tickFn, this.stepMs());
    };
    tickFn();
  },
  stepMs() { return Math.max(85, 260 / this.tempo()); }, // capped so the finale stays a beat, not a buzz
  fileRate() { return Math.min(2, Math.pow(this.rate, 0.5) * (1 + 0.45 * this.intensity * this.intensity)); },
  setRate(rate) { this.rate = Math.max(0.5, rate || 1); this.retune(); },
  /** 0 = start of the round (or between rounds), 1 = the clock is at zero. */
  setIntensity(x) { this.intensity = Math.max(0, Math.min(1, x || 0)); this.retune(); },
  retune() { if (this.src && ctx) this.src.playbackRate.setTargetAtTime(this.fileRate(), ctx.currentTime, 0.3); },
  duck(on) { if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? 0.12 : MUSIC_VOL, ctx.currentTime, 0.1); },
  stop() { this.on = false; this.restart(); },
};
