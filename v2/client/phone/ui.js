// Small UI helpers shared by the phone screens.
import { h } from '../fx/kit.js';
export { h };
export { money } from '/shared/protocol.js';

export function toast(text, cls = '', ms = 2200) {
  const t = h('div', { class: 'toast ' + cls }, text);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), ms);
}

/** Replace the main view's content. */
export function view(...children) {
  const v = document.getElementById('view');
  v.replaceChildren(...children.flat().filter((c) => c != null && c !== false));
  v.scrollTop = 0;
  return v;
}

/** A live countdown element bound to a server timestamp. */
export function countdown(sock, endsAt, cls = 'countdown') {
  const el = h('div', { class: cls });
  const tick = () => {
    if (!el.isConnected && el.dataset.started) return;
    el.dataset.started = '1';
    el.textContent = Math.ceil(sock.msUntil(endsAt) / 1000);
    setTimeout(tick, 200);
  };
  tick();
  return el;
}

/** Tap handler that fires on pointerdown (fast on mobile). */
export function tap(el, fn) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!el.disabled) fn(e); });
  return el;
}

export function bigBtn(label, fn, cls = '') {
  return tap(h('button', { class: 'big-btn ' + cls, type: 'button' }, label), fn);
}
