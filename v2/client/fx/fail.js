import { dollarPop } from './effects.js';
// CT-01 fail animation library (v2: jail bars, flashing sirens, net) plus a caption per minigame
// from /content/fail-lines.json. playFail(root, {gameId, effect?}) -> Promise that resolves when the gag ends.
const FAIL_MS = 1100;

let lines = null;
let loading = null;
function loadLines() {
  if (lines || loading) return loading;
  loading = fetch('/content/fail-lines.json')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((j) => { lines = j || {}; });
  return loading;
}
loadLines();

export function captionFor(gameId) {
  const l = lines || {};
  const own = l.games && l.games[gameId];
  if (own) return own;
  const generic = (l.generic && l.generic.length) ? l.generic : ['Busted.'];
  return generic[Math.floor(Math.random() * generic.length)];
}

const STYLE = `
.hh-fx{position:absolute;top:0;right:0;bottom:0;left:0;z-index:50;pointer-events:none;overflow:hidden}
.hh-fx-cap{position:absolute;left:0;right:0;bottom:12%;text-align:center;font:900 22px system-ui,sans-serif;color:#fff;
  text-shadow:0 3px 0 #000,0 0 12px #000;padding:0 16px;animation:hhCap .35s ease-out both}
@keyframes hhCap{from{transform:scale(.4) rotate(-6deg);opacity:0}to{transform:none;opacity:1}}
.hh-fx-siren{animation:hhSiren .25s linear infinite alternate}
@keyframes hhSiren{from{background:rgba(255,0,40,.45)}to{background:rgba(0,90,255,.45)}}
.hh-fx-bars{background:repeating-linear-gradient(90deg,transparent 0 9%,#333 9% 12%);animation:hhBars .4s .2s ease-out both;border-top:10px solid #333;border-bottom:10px solid #333}
@keyframes hhBars{from{transform:translateY(-100%)}to{transform:none}}
.hh-fx-net{background:repeating-linear-gradient(45deg,transparent 0 14px,#d9c58a 14px 17px),repeating-linear-gradient(-45deg,transparent 0 14px,#d9c58a 14px 17px);
  animation:hhNet .45s ease-out both}
@keyframes hhNet{from{transform:translateY(-100%) scale(1.4)}to{transform:none}}
.hh-shake{animation:hhShake .4s linear}
@keyframes hhShake{0%,100%{transform:none}20%{transform:translate(-8px,4px)}40%{transform:translate(7px,-5px)}60%{transform:translate(-5px,-3px)}80%{transform:translate(4px,5px)}}
.hh-win{position:absolute;top:0;right:0;bottom:0;left:0;z-index:50;pointer-events:none;background:radial-gradient(circle,rgba(61,255,154,.55),transparent 70%);animation:hhWin .5s ease-out both}
@keyframes hhWin{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
`;
function ensureStyle() {
  if (document.getElementById('css-hh-fail')) return;
  const s = document.createElement('style');
  s.id = 'css-hh-fail';
  s.textContent = STYLE;
  document.head.append(s);
}

function layer(cls) {
  const d = document.createElement('div');
  d.className = 'hh-fx ' + cls;
  return d;
}

/** v2 keeps three gags: jail bars, flashing sirens and the net. */
export const EFFECTS = {
  cuffs(fx) { fx.append(layer('hh-fx-bars')); },
  siren(fx) { fx.append(layer('hh-fx-siren')); },
  net(fx) { fx.append(layer('hh-fx-net')); },
};
export const EFFECT_NAMES = Object.keys(EFFECTS);

/** Play a fail gag on a minigame root. Resolves after ~1.1s. */
export function playFail(root, { gameId, effect, reason } = {}) {
  ensureStyle();
  const name = effect || EFFECT_NAMES[Math.floor(Math.random() * EFFECT_NAMES.length)];
  const fx = layer('');
  (EFFECTS[name] || EFFECTS.siren)(fx, root);
  const cap = document.createElement('div');
  cap.className = 'hh-fx-cap';
  cap.textContent = reason === 'timeout' && Math.random() < 0.3 ? 'Too slow! The guards are back.' : captionFor(gameId);
  fx.append(cap);
  root.append(fx);
  return new Promise((res) => setTimeout(res, FAIL_MS));
}

/** Quick success burst: green glow plus a few dollar pops. */
export function playWin(root) {
  ensureStyle();
  const w = document.createElement('div');
  w.className = 'hh-win';
  root.append(w);
  const r = root.getBoundingClientRect();
  dollarPop({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, { count: 3 });
}
