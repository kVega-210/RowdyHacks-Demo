// MG-09 Security Camera Loop: the feed repeats; learn the guard's pattern and SNEAK while he looks away.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'security-camera-loop', name: 'Security Camera Loop', tags: ['cyber'], baseDurationMs: 12000 };

css('mg-camera-loop', `
.cl-feed{position:relative;height:55%;max-width:420px;margin:0 auto;border:3px solid var(--line,#2a3555);border-radius:12px;background:repeating-linear-gradient(0deg,var(--panel2,#0d1424) 0 3px,var(--panel2,#0a0f1c) 3px 6px);overflow:hidden}
.cl-guard{position:absolute;left:50%;bottom:8%;font-size:76px;transform:translateX(-50%);transition:transform .1s}
.cl-eye{position:absolute;left:50%;top:10%;transform:translateX(-50%);font:900 20px system-ui;padding:2px 10px;border-radius:8px}
.cl-rec{position:absolute;top:6px;left:8px;color:#ff5c7a;font-weight:900;font-size:13px}
.cl-strip{display:flex;gap:4px;justify-content:center;margin:10px 0}
.cl-strip i{width:22px;height:10px;border-radius:3px;background:var(--line,#2a3555)}.cl-strip i.away{background:#3dff9a}.cl-strip i.now{outline:2px solid var(--gold,#ffd84d)}
.cl-label{text-align:center;font:900 24px system-ui,sans-serif;letter-spacing:.12em;color:#ff5c7a;margin:2px 0 4px;text-shadow:0 0 10px #ff224466}
.cl-go{display:block;margin:4px auto 0;width:80%;height:64px;font-size:26px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'SNEAK only when the guard looks away', timeMs: 12000 });
  const len = byD(g, 4, 5, 6);
  const pattern = Array.from({ length: len }, () => 'watch');
  const aways = byD(g, 2, 1, 1);
  g.r.sample([...Array(len).keys()], aways).forEach((i) => { pattern[i] = 'away'; });
  const step = byD(g, 900, 750, 600);
  const guard = h('div', { class: 'cl-guard' }, '👮');
  const eye = h('div', { class: 'cl-eye' });
  const marks = pattern.map((p) => h('i', { class: p === 'away' ? 'away' : '' }));
  const strip = h('div', { class: 'cl-strip' }, marks);
  let idx = 0;
  const show = () => {
    const away = pattern[idx] === 'away';
    guard.style.transform = `translateX(-50%) scaleX(${away ? -1 : 1})`;
    eye.textContent = away ? 'LOOKING AWAY' : 'WATCHING';
    eye.style.background = away ? '#3dff9a' : '#ff5c7a';
    eye.style.color = '#0b0f1a';
    marks.forEach((m, k) => m.classList.toggle('now', k === idx));
  };
  show();
  g.every(step, () => {
    idx = (idx + 1) % len;
    // At difficulty 3 the guard sometimes glances back for a beat (still part of the shown loop).
    show();
  });
  if (g.d >= 2) g.after(step * len, () => { strip.style.visibility = 'hidden'; g.hint('Loop memorised? The timeline is gone.'); });
  const go = g.btn('SNEAK', () => (pattern[idx] === 'away' ? g.win() : g.lose('caught on camera')), 'good cl-go');
  g.stage.append(h('div', { class: 'cl-feed' }, h('div', { class: 'cl-rec' }, '● REC CAM-3'), eye, guard), strip, h('div', { class: 'cl-label hh-label' }, 'ESCAPE!'), go);
  return g.handle();
}
