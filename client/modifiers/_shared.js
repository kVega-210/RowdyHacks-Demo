// Helpers shared by sabotage modifiers (underscore prefix = not auto-discovered).
const CONTROL_SELECTOR = 'button, .hh-btn, .hh-ctl, [role=button]';

export function controlsIn(el) {
  return [...el.querySelectorAll(CONTROL_SELECTOR)].filter((b) => b.isConnected && b.offsetParent !== null);
}

let n = 0;
export function styleOnce(id, text) {
  if (document.getElementById('mod-' + id)) return;
  const s = document.createElement('style');
  s.id = 'mod-' + id;
  s.textContent = text;
  document.head.append(s);
}

/** Wrap an apply function so remove() is idempotent and the modifier auto-expires after `duration`. */
export function timed(duration, removeFn) {
  let gone = false;
  const remove = () => { if (gone) return; gone = true; clearTimeout(t); removeFn(); };
  const t = setTimeout(remove, Math.max(0, duration || 0));
  return remove;
}

export const uid = () => 'm' + (++n);
