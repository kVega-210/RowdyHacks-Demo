// v2 Freeze warning: a 🚨 slowly rises from behind the terminal. When it is fully revealed the Freeze starts.
let current = null;

export function sirenRise(terminalEl, ms) {
  sirenClear();
  if (!terminalEl) return;
  const r = terminalEl.getBoundingClientRect();
  const s = document.createElement('div');
  s.className = 'hh-siren-rise';
  s.textContent = '🚨';
  Object.assign(s.style, {
    position: 'fixed', left: '50%', bottom: (innerHeight - r.top) + 'px', zIndex: '39', fontSize: '64px', lineHeight: '1',
    marginLeft: '-32px', transform: 'translateY(100%)', transition: `transform ${ms}ms linear`, pointerEvents: 'none',
    filter: 'drop-shadow(0 0 14px #ff2244)',
  });
  document.body.append(s);
  // Next frame: start rising.
  requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transform = 'translateY(0)'; }));
  s.animate([{ filter: 'drop-shadow(0 0 4px #ff2244)' }, { filter: 'drop-shadow(0 0 22px #ff2244)' }], { duration: 400, iterations: Infinity, direction: 'alternate' });
  current = s;
}

export function sirenClear() {
  if (current) current.remove();
  current = null;
}
