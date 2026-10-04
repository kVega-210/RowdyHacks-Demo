// AU-05 stand-in: every sound is synthesised with WebAudio, so there are no audio files to license or load.
// sfx.play(name) for one-shots, music.start()/setRate(speed)/stop() for the tension loop that follows the speed ramp.
let ctx = null;
let master = null;
let musicBus = null;
let muted = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.35;
    musicBus.connect(master);
  }
  return ctx;
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
}

export function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.6; }

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

function noise(dur, { vol = 0.3, delay = 0, hp = 800 } = {}) {
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
  s.connect(f).connect(g).connect(master);
  s.start(c.currentTime + delay);
}

const SOUNDS = {
  click: () => tone(900, 0.04, { type: 'square', vol: 0.08 }),
  coin: () => { tone(988, 0.08, { vol: 0.2 }); tone(1319, 0.25, { vol: 0.2, delay: 0.08 }); },
  fail: () => { tone(300, 0.5, { type: 'sawtooth', slide: -220, vol: 0.25 }); noise(0.3, { vol: 0.15, delay: 0.1 }); },
  alarm: () => { for (let i = 0; i < 4; i++) { tone(880, 0.18, { type: 'sawtooth', vol: 0.2, delay: i * 0.36 }); tone(660, 0.18, { type: 'sawtooth', vol: 0.2, delay: i * 0.36 + 0.18 }); } },
  steal: () => { tone(220, 0.1, { vol: 0.3 }); tone(440, 0.1, { vol: 0.3, delay: 0.1 }); tone(880, 0.3, { vol: 0.3, delay: 0.2 }); },
  freeze: () => { tone(1500, 0.6, { type: 'sine', slide: -1200, vol: 0.3 }); noise(0.5, { vol: 0.1, hp: 4000 }); },
  vault: () => { tone(80, 0.6, { type: 'triangle', vol: 0.5 }); noise(0.4, { vol: 0.2, hp: 200 }); },
  tick: () => tone(1200, 0.03, { type: 'square', vol: 0.06 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.25, delay: i * 0.12 })),
  raid: () => { for (let i = 0; i < 6; i++) tone(1000 + i * 120, 0.06, { vol: 0.15, delay: i * 0.05 }); },
  escape: () => { for (let i = 0; i < 3; i++) tone(440, 0.25, { type: 'sawtooth', slide: 440, vol: 0.2, delay: i * 0.3 }); },
};

export const sfx = { play(name) { try { (SOUNDS[name] || (() => {}))(); } catch (_) { /* audio is optional */ } } };

/** Looping tension bass line. Tempo follows the round speed (playbackRate equivalent). */
export const music = {
  timer: 0, step: 0, rate: 1, on: false,
  start(rate = 1) {
    this.rate = rate;
    if (this.on) return;
    this.on = true;
    const tickFn = () => {
      if (!this.on) return;
      const notes = [55, 55, 65.4, 55, 73.4, 55, 65.4, 49];
      const n = notes[this.step++ % notes.length];
      tone(n, 0.18, { type: 'sawtooth', vol: 0.22, bus: musicBus });
      if (this.step % 2 === 0) noise(0.04, { vol: 0.05, hp: 6000 });
      this.timer = setTimeout(tickFn, 240 / this.rate);
    };
    tickFn();
  },
  setRate(rate) { this.rate = Math.max(0.5, rate || 1); },
  duck(on) { if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? 0.08 : 0.35, ctx.currentTime, 0.1); },
  stop() { this.on = false; clearTimeout(this.timer); },
};
