// MG-35 Small Vault / Big Vault: safe vault for modest cash, or a much harder vault worth several times more.
import { runWrapper, mountOnce } from './_wrap.js';

export const meta = { id: 'small-vault-big-vault', name: 'Small Vault / Big Vault', tags: ['wager'] };

export function mount(container, opts) {
  return runWrapper(meta.id, container, opts, (p) => mountOnce(container, opts, p));
}
