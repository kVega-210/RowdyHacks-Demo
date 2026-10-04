// v2 event terminal, Fallout Shelter / Pip-Boy style: green phosphor text, scanlines, typewriter lines.
// createTerminal(el, {title}) -> {log(text, kind), setScrollable(on), clear(), el}
const STYLE = `
.hh-term{position:relative;display:flex;flex-direction:column;background:#020c05;color:#39ff7a;border-top:3px solid #1f8f45;
  font:600 14px/1.35 ui-monospace,"Cascadia Mono","Consolas",Menlo,monospace;overflow:hidden;z-index:40;
  text-shadow:0 0 6px rgba(57,255,122,.55);box-shadow:inset 0 0 40px rgba(0,255,90,.08)}
.hh-term::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px);animation:hhTermFlicker 4s steps(2) infinite}
@keyframes hhTermFlicker{50%{opacity:.85}}
.hh-term-head{display:flex;justify-content:space-between;padding:3px 10px;background:#0a2a14;color:#9dffbe;font-size:11px;letter-spacing:.18em;border-bottom:1px solid #1f8f45}
.hh-term-body{flex:1;overflow:hidden;padding:4px 10px 6px;touch-action:none}
.hh-term.scroll .hh-term-body{overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch}
.hh-term.scroll .hh-term-head span:last-child::after{content:' · SCROLL ▲▼'}
.hh-term-line{white-space:pre-wrap;word-break:break-word}
.hh-term-line .ts{color:#1f9f4f;margin-right:6px}
.hh-term-line.good{color:#a6ffbf}.hh-term-line.bad{color:#ff6b7f;text-shadow:0 0 6px rgba(255,80,100,.5)}
.hh-term-line.warn{color:#ffd84d;text-shadow:0 0 6px rgba(255,216,77,.5)}.hh-term-line.dim{color:#2fbf62}
.hh-term-cursor{display:inline-block;width:8px;height:14px;background:#39ff7a;vertical-align:-2px;animation:hhBlink 1s steps(2) infinite}
@keyframes hhBlink{50%{opacity:0}}
`;
function ensureStyle() {
  if (document.getElementById('css-hh-term')) return;
  const s = document.createElement('style');
  s.id = 'css-hh-term';
  s.textContent = STYLE;
  document.head.append(s);
}

export function createTerminal(el, { title = 'VAULT-TEC HEIST TERMINAL', max = 300 } = {}) {
  ensureStyle();
  el.classList.add('hh-term');
  const status = document.createElement('span');
  status.textContent = 'ONLINE';
  const head = document.createElement('div');
  head.className = 'hh-term-head';
  const t = document.createElement('span');
  t.textContent = title;
  head.append(t, status);
  const body = document.createElement('div');
  body.className = 'hh-term-body';
  const cursor = document.createElement('span');
  cursor.className = 'hh-term-cursor';
  body.append(cursor);
  el.replaceChildren(head, body);
  const t0 = Date.now();
  const queue = [];
  let typing = false;

  const stamp = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    return `[${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}]`;
  };
  const stick = () => body.scrollHeight - body.scrollTop - body.clientHeight < 30;

  function pump() {
    if (typing || !queue.length) return;
    typing = true;
    const { text, kind } = queue.shift();
    const line = document.createElement('div');
    line.className = 'hh-term-line ' + (kind || '');
    const ts = document.createElement('span');
    ts.className = 'ts';
    ts.textContent = stamp();
    const txt = document.createElement('span');
    line.append(ts, txt);
    const follow = stick() || !el.classList.contains('scroll');
    body.insertBefore(line, cursor);
    while (body.children.length > max + 1) body.firstChild.remove();
    // Typewriter: fast, and faster still when lines are queued up.
    const full = '> ' + text;
    let i = 0;
    const step = Math.max(1, Math.ceil(full.length / (queue.length > 2 ? 4 : 14)));
    const tick = () => {
      i = Math.min(full.length, i + step);
      txt.textContent = full.slice(0, i);
      if (follow) body.scrollTop = body.scrollHeight;
      if (i < full.length) setTimeout(tick, 16);
      else { typing = false; pump(); }
    };
    tick();
  }

  return {
    el,
    log(text, kind = '') { queue.push({ text: String(text), kind }); if (queue.length > 40) queue.splice(0, queue.length - 40); pump(); },
    setScrollable(on) { el.classList.toggle('scroll', !!on); status.textContent = on ? 'ARCHIVE' : 'ONLINE'; },
    clear() { body.replaceChildren(cursor); },
  };
}
