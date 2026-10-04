# Minigame interface (DOC-03)

Build any minigame in isolation from this page. Types: [`/shared/minigame.d.ts`](../shared/minigame.d.ts).

## The contract
Each file `/client/minigames/<id>.js` exports:
```js
export const meta = { id: 'lockpick', name: 'Lockpick', tags: ['classic'], baseDurationMs: 12000 };
export function mount(container, { difficulty, speed, seed, onSuccess, onFail, tiers }) {
  // ...
  return { destroy() { /* stop timers, remove DOM */ } };
}
```
- `meta` must be a literal `export const meta = {...};` block: the server reads it with a regex (it never runs
  client code). `id` equals the file name. `tags` must contain `cyber` (Hack rounds) or `classic` (Break-in rounds);
  add `choice` for pick-a-tier games or `push-luck` for cash-out games.
- **Auto-discovery**: drop the file in the folder and it is live (`/api/minigames`). Nobody edits a shared index.
  Files starting with `_` are ignored.
- `difficulty` 1-3 tunes how hard it is; `speed` (>= 1) scales every timer and motion. It must be completable in
  12s or less at speed 1 and still winnable at speed 2.
- `seed`: all randomness comes from it, so the same seed gives the same puzzle.
- Call **exactly one** of `onSuccess({scoreMultiplier?, wager?})` / `onFail({reason, wager?})`, **exactly once**.
  After `destroy()` call neither.
- Push-your-luck games pass `scoreMultiplier` (server clamps to 0.25-3) and show the cash at stake (`.hh-stake`).
- Choice games pass `wager: {tier: '1'|'2'|'3'}` on both success and fail; payouts come from `balance.json`
  (`opts.tiers` is provided for display).

## Rules
Touch-first (pointer events, big buttons, `touch-action: none`), works on iOS Safari, **no**
`localStorage`/`sessionStorage`/IndexedDB, **no external assets** (emoji and CSS only), controls are `<button>`s or
carry the `hh-ctl` class (so sabotage modifiers can find them), and use the CT-01 fail fx.

## The kit (`/client/fx/kit.js`)
`game(container, opts, {id, title, hint, timeMs, onTimeout?})` builds the standard shell and gives you:
`g.stage`, `g.r` (seeded rng: `int`, `range`, `pick`, `shuffle`, `sample`, `chance`), `g.d`, `g.speed`,
`g.loop(fn(dt, ms))`, `g.after(ms, fn)`, `g.every(ms, fn)` (all in game time: speed and sabotage applied, paused
during FREEZE/STEAL overlays), `g.btn(label, onTap, cls)`, `g.penalize(ms)`, `g.hint()`, `g.status()`,
`g.win(scoreMultiplier?, extra?)`, `g.lose(reason, extra?)` (exactly-once guarded; plays the fail gag from
`/client/fx/fail.js` with your caption from `/content/fail-lines.json`), and `g.handle()` for the return value.
Helpers: `h()` (DOM), `css(id, text)`, `byD(g, easy, mid, hard)`, `drag()`, `tierOptions()`, `SYMBOLS`, `COLORS`.

## Sabotage modifiers
`/client/modifiers/<id>.js` exports `meta` and `applyModifier(el, {duration, strength}) -> remove()`. It must be
removable cleanly (idempotent `remove`), auto-expire after `duration`, and never make a game unwinnable (e.g.
Lockout never locks the only control and rotates every ~2s). Turbo works by setting `data-hh-timescale` on `el`.

## Wager wrappers
`/client/wagers/<id>.js` exports `meta` and `mount(container, opts & {game, config, content})`: it shows the
chooser (CL-10, `/client/wagers/chooser.js`), mounts the wrapped game with `difficultyDelta`/`speedMult` from
`balance.json wager.wrappers[id]`, and adds `wager: {tier, wrapper}` to the result. Copy and tier labels live in
`/content/wagers/<id>.json`.

## Testing
Open `/dev/minigame-sandbox/` (pickers for game, difficulty, speed, seed, modifier and wrapper; result log that
flags double calls; FPS counter; phone-sized frame). `server/src/test/.../ModuleContractTest` lints every module and
`scripts/browser-check/minigames.mjs` fuzzes them in headless Chromium.
