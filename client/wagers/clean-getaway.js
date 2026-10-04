// MG-36 Clean Getaway: finish normally for guaranteed cash, or take the fast route (much higher speed) for a big bonus.
import { runWrapper, mountOnce } from './_wrap.js';

export const meta = { id: 'clean-getaway', name: 'Clean Getaway', tags: ['wager'] };

export function mount(container, opts) {
  return runWrapper(meta.id, container, opts, (p) => mountOnce(container, opts, p));
}
