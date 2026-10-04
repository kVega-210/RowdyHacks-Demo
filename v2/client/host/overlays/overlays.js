// CL-05 host side: full-width event banners and screen flashes for Steal / Freeze / Bank Raid / Escape.
export function banner(kind, text, sub = '', ms = 2200) {
  const b = document.getElementById('banner');
  const el = document.createElement('div');
  el.className = 'b ' + kind;
  el.textContent = text;
  if (sub) { const s = document.createElement('small'); s.textContent = sub; el.append(s); }
  b.replaceChildren(el);
  clearTimeout(banner.t);
  banner.t = setTimeout(() => { if (el.isConnected) el.remove(); }, ms);
}

export function flash(kind, ms = 2000) {
  const f = document.getElementById('flash');
  f.className = '';
  void f.offsetWidth;
  f.className = kind;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => { f.className = ''; }, ms);
}

export function clearFlash() {
  document.getElementById('flash').className = '';
}
