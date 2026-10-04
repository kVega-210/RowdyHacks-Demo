// MG-37 The Double Safe: one lock for normal money, or two copies of the minigame side by side. Both must open.
import { runWrapper, mountOnce } from './_wrap.js';

export const meta = { id: 'the-double-safe', name: 'The Double Safe', tags: ['wager'] };

export function mount(container, opts) {
  return runWrapper(meta.id, container, opts, (p) => {
    if ((p.cfg.locks || 1) < 2) return mountOnce(container, opts, p);
    // Two locks: split the screen, run both, succeed only when both succeed.
    const halves = [0, 1].map((i) => {
      const d = document.createElement('div');
      Object.assign(d.style, { position: 'absolute', left: '0', right: '0', top: i ? '50%' : '0', height: '50%', overflow: 'hidden', borderTop: i ? '3px solid #ffd84d' : '' });
      container.append(d);
      return d;
    });
    let wins = 0, settled = false, multSum = 0;
    const games = halves.map((half, i) => opts.game.mount(half, Object.assign({}, opts, {
      difficulty: p.difficulty, speed: p.speed, seed: (opts.seed || 1) + i * 7919,
      onSuccess: (r) => {
        if (settled) return;
        wins++;
        multSum += (r && r.scoreMultiplier) || 1;
        if (wins === 2) { settled = true; opts.onSuccess({ scoreMultiplier: multSum / 2, wager: p.wager }); }
      },
      onFail: (r) => {
        if (settled) return;
        settled = true;
        games.forEach((g, k) => { if (k !== i) g.destroy(); });
        opts.onFail(Object.assign({}, r, { wager: p.wager }));
      },
    })));
    return { destroy() { games.forEach((g) => g.destroy()); halves.forEach((hv) => hv.remove()); } };
  });
}
