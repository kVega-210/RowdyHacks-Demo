// MG-16 Security Override: watch the command sequence, then repeat it after it is hidden.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'security-override', name: 'Security Override', tags: ['cyber'], baseDurationMs: 12000 };

const CMDS = [['OVERRIDE', '#ff5c7a'], ['BYPASS', '#4dd2ff'], ['REBOOT', '#3dff9a'], ['MUTE', '#ffd84d'], ['UNLOCK', '#c77dff'], ['LOOP', '#ff9f43']];

css('mg-sec-override', `
.so-screen{height:64px;margin:0 auto 12px;max-width:340px;display:flex;align-items:center;justify-content:center;border-radius:12px;
  background:#000;border:2px solid #2a3555;font:900 26px ui-monospace,monospace;letter-spacing:.05em}
.so-pads{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;max-width:420px;margin:0 auto}
.so-pads .hh-btn{min-height:64px;font-size:18px;color:#0b0f1a}
.so-pads .hh-btn.lit{filter:brightness(1.6);transform:scale(1.05)}
.so-dots{text-align:center;font-size:22px;letter-spacing:6px;margin-top:10px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Memorise the commands...', timeMs: 13000 });
  const n = byD(g, 3, 4, 5);
  const pool = CMDS.slice(0, byD(g, 4, 4, 6));
  // Never the same command twice in a row: pick from the pool minus the previous one.
  const seq = [];
  for (let k = 0; k < n; k++) {
    let c = g.r.int(pool.length - (k ? 1 : 0));
    if (k && c >= seq[k - 1]) c++;
    seq.push(c);
  }
  const screen = h('div', { class: 'so-screen' }, 'MEMORIZE');
  const dots = h('div', { class: 'so-dots' });
  let input = 0, accepting = false;
  const pads = pool.map(([label, color], i) => {
    const b = g.btn(label, () => {
      if (!accepting) return;
      if (i !== seq[input]) return g.lose('wrong command', null, { good: pads[seq[input]], bad: b });
      input++;
      dots.textContent = '●'.repeat(input) + '○'.repeat(n - input);
      if (input >= n) g.win(null, null, { matrix: true });
    });
    b.style.background = color;
    return b;
  });
  g.stage.append(screen, h('div', { class: 'so-pads' }, pads), dots);
  const show = byD(g, 700, 600, 480);
  const lead = 1400; // v2: hold on MEMORIZE so the player is ready before the sequence plays
  seq.forEach((c, k) => {
    g.after(lead + k * show, () => {
      screen.textContent = pool[c][0];
      screen.style.color = pool[c][1];
      pads.forEach((p, i) => p.classList.toggle('lit', i === c));
    });
  });
  g.after(lead + n * show, () => {
    screen.textContent = 'YOUR TURN';
    screen.style.color = '#fff';
    pads.forEach((p) => p.classList.remove('lit'));
    accepting = true;
    g.hint('Repeat the sequence');
    dots.textContent = '○'.repeat(n);
  });
  return g.handle();
}
