// Shared logic for wager wrappers (MG-35/36/37). Underscore prefix = not auto-discovered.
// A wrapper is NOT a minigame: it asks safe-or-risky first, then mounts any existing minigame with tweaked
// difficulty/speed, and tags the result with wager:{tier, wrapper} so the server (BE-12) resolves the payout.
import { choose } from './chooser.js';

/**
 * opts: the normal DOC-03 mount opts plus
 *   game     the minigame module to wrap ({meta, mount})
 *   config   balance.json wager.wrappers[<id>]  (tier -> {difficultyDelta, speedMult, locks?})
 *   tiers    balance.json wager.tiers            (tier -> {payoutMult, failPenaltyMult})
 *   content  /content/wagers/<id>.json           (labels and blurbs)
 */
export function runWrapper(id, container, opts, mountInner) {
  const { content = {}, config = {}, tiers = {} } = opts;
  let inner = null;
  let destroyed = false;
  const options = (content.options || Object.keys(config).map((t) => ({ tier: t, label: 'Tier ' + t }))).map((o) =>
    Object.assign({}, o, tiers[o.tier] || {}));
  const chooser = choose(container, {
    title: content.name || id,
    prompt: (content.prompt || '') + (opts.game ? ` (${opts.game.meta.name})` : ''),
    options,
    timeoutMs: 5000,
    onPick(o) {
      if (destroyed) return;
      const cfg = config[o.tier] || {};
      const wager = { tier: o.tier, wrapper: id };
      const difficulty = Math.max(1, Math.min(3, (opts.difficulty || 1) + (cfg.difficultyDelta || 0)));
      const speed = Math.max(1, (opts.speed || 1) * (cfg.speedMult || 1));
      inner = mountInner({ cfg, difficulty, speed, wager });
    },
  });
  return { destroy() { destroyed = true; chooser.destroy(); if (inner) inner.destroy(); } };
}

/** Mount the wrapped game once with adjusted params and pass the wager through on either result. */
export function mountOnce(container, opts, { difficulty, speed, wager }) {
  return opts.game.mount(container, Object.assign({}, opts, {
    difficulty, speed,
    onSuccess: (r) => opts.onSuccess(Object.assign({}, r, { wager })),
    onFail: (r) => opts.onFail(Object.assign({}, r, { wager })),
  }));
}
