// CL-09 host juice: animated bank drain and screen shake on big events. (v2: the fail reel lives in the terminal.)
import { money } from '/shared/protocol.js';

export function shake() {
  const s = document.getElementById('screen');
  s.classList.remove('shake');
  void s.offsetWidth;
  s.classList.add('shake');
}

/** Count the bank number down smoothly and flash red while draining. */
export function bankDrain(bankEl, amountEl, tubeEl, from, to, start) {
  if (tubeEl && start) tubeEl.style.height = Math.max(0, Math.min(100, (to / start) * 100)) + '%';
  if (from == null || from === to) { amountEl.textContent = money(to); return; }
  const t0 = performance.now(), dur = 700;
  bankEl.classList.toggle('draining', to < from);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    amountEl.textContent = money(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step); else setTimeout(() => bankEl.classList.remove('draining'), 300);
  };
  requestAnimationFrame(step);
}

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
