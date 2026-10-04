// CL-01 phone join screen: room code + name, or one-tap rejoin with the stored session token.
import { h, view, bigBtn } from '../ui.js';

const KEY = 'hh.session';

export function loadSession() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; }
}
export function saveSession(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* private mode: rejoin by code instead */ }
}
export function clearSession() {
  try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
}

export function render(ctx, { error } = {}) {
  const params = new URLSearchParams(location.search);
  const saved = loadSession();
  const code = h('input', { class: 'field code', maxlength: 4, autocomplete: 'off', autocapitalize: 'characters', inputmode: 'text',
    placeholder: 'ABCD', value: (params.get('room') || (saved && saved.room) || '').toUpperCase() });
  const name = h('input', { class: 'field', maxlength: 16, autocomplete: 'nickname', placeholder: 'Your heist name',
    value: (saved && saved.name) || '' });
  code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  const go = () => {
    const room = code.value.trim().toUpperCase();
    const nm = name.value.trim();
    if (room.length !== 4) return ctx.toast('Room codes are 4 letters', 'bad');
    if (!nm) return ctx.toast('Pick a name', 'bad');
    ctx.join(room, nm);
  };
  view(
    h('h1', {}, 'HEIST HAVOC!'),
    h('p', { class: 'center muted' }, 'Rob the bank. Rob your friends. Escape rich.'),
    error ? h('div', { class: 'card', style: { borderColor: 'var(--red)', color: 'var(--red)' } }, error) : null,
    saved && saved.token ? h('div', { class: 'card' },
      h('b', {}, `Back to room ${saved.room} as ${saved.name}?`),
      bigBtn('REJOIN', () => ctx.resume(saved), 'green')) : null,
    h('div', { class: 'card' },
      h('label', { class: 'lbl' }, 'Room code'), code,
      h('label', { class: 'lbl' }, 'Name'), name,
      bigBtn('JOIN THE CREW', go)),
  );
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}
