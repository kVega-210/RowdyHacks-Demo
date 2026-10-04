// CT-01 fail animation library: 8 reusable "Dumb Ways to Die"-style fail effects plus a caption per minigame
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
.hh-fx{position:absolute;inset:0;z-index:50;pointer-events:none;overflow:hidden}
.hh-fx-cap{position:absolute;left:0;right:0;bottom:12%;text-align:center;font:900 22px system-ui,sans-serif;color:#fff;
  text-shadow:0 3px 0 #000,0 0 12px #000;padding:0 16px;animation:hhCap .35s ease-out both}
@keyframes hhCap{from{transform:scale(.4) rotate(-6deg);opacity:0}to{transform:none;opacity:1}}
.hh-fx-explosion{background:radial-gradient(circle,#fff 0,#ffd84d 15%,#ff7a1a 35%,#a3001b 60%,transparent 75%);animation:hhBoom .7s ease-out both}
@keyframes hhBoom{0%{transform:scale(.1);opacity:1}70%{opacity:1}100%{transform:scale(2.6);opacity:.0}}
.hh-fx-soot{background:#1a1a1a;animation:hhSoot .9s .25s both}
@keyframes hhSoot{from{opacity:0}to{opacity:.65}}
.hh-fx-trapdoor{background:#000;clip-path:ellipse(0% 0% at 50% 60%);animation:hhTrap .5s ease-in both}
@keyframes hhTrap{to{clip-path:ellipse(80% 45% at 50% 60%)}}
.hh-fx-fall{animation:hhFall .8s .3s ease-in both}
@keyframes hhFall{to{transform:translateY(60%) scale(.2) rotate(40deg);opacity:0}}
.hh-fx-siren{animation:hhSiren .25s linear infinite alternate}
@keyframes hhSiren{from{background:rgba(255,0,40,.45)}to{background:rgba(0,90,255,.45)}}
.hh-fx-bars{background:repeating-linear-gradient(90deg,transparent 0 9%,#333 9% 12%);animation:hhBars .4s .2s ease-out both;border-top:10px solid #333;border-bottom:10px solid #333}
@keyframes hhBars{from{transform:translateY(-100%)}to{transform:none}}
.hh-fx-dye{background:radial-gradient(circle at 50% 50%,#2fb4ff 0,#1068d8 40%,transparent 70%);animation:hhDye .8s ease-out both;filter:blur(2px)}
@keyframes hhDye{0%{transform:scale(.05)}60%{transform:scale(1.8)}100%{transform:scale(2.4);opacity:.85}}
.hh-fx-spot{inset:-60%;background:radial-gradient(circle at 50% 48%,transparent 0 10%,rgba(0,0,0,.92) 14%);animation:hhSpot .8s ease-in-out both}
@keyframes hhSpot{0%{transform:translateX(-25%)}50%{transform:translateX(25%)}100%{transform:none}}
.hh-fx-anvil{position:absolute;left:50%;top:-30%;width:120px;height:70px;margin-left:-60px;background:#3b3f4a;border-radius:6px 6px 18px 18px;
  box-shadow:inset 0 -12px 0 #23262e;animation:hhAnvil .45s cubic-bezier(.6,0,1,1) both}
@keyframes hhAnvil{to{top:55%}}
.hh-fx-net{background:repeating-linear-gradient(45deg,transparent 0 14px,#d9c58a 14px 17px),repeating-linear-gradient(-45deg,transparent 0 14px,#d9c58a 14px 17px);
  animation:hhNet .45s ease-out both}
@keyframes hhNet{from{transform:translateY(-100%) scale(1.4)}to{transform:none}}
.hh-shake{animation:hhShake .4s linear}
@keyframes hhShake{0%,100%{transform:none}20%{transform:translate(-8px,4px)}40%{transform:translate(7px,-5px)}60%{transform:translate(-5px,-3px)}80%{transform:translate(4px,5px)}}
.hh-win{position:absolute;inset:0;z-index:50;pointer-events:none;background:radial-gradient(circle,rgba(61,255,154,.55),transparent 70%);animation:hhWin .5s ease-out both}
@keyframes hhWin{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
.hh-coin{position:absolute;top:50%;left:50%;width:22px;height:22px;border-radius:50%;background:#ffd84d;border:3px solid #a8861a;animation:hhCoin .6s ease-out both}
@keyframes hhCoin{to{transform:translate(var(--dx),var(--dy));opacity:0}}
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

/** The 8 effects. Each adds layers to `fx` and may animate `root`. */
export const EFFECTS = {
  explosion(fx, root) { fx.append(layer('hh-fx-explosion'), layer('hh-fx-soot')); root.classList.add('hh-shake'); },
  trapdoor(fx, root) { fx.append(layer('hh-fx-trapdoor')); const st = root.querySelector('.hh-stage'); st && st.classList.add('hh-fx-fall'); },
  siren(fx) { fx.append(layer('hh-fx-siren')); },
  cuffs(fx) { fx.append(layer('hh-fx-bars')); },
  dyepack(fx, root) { fx.append(layer('hh-fx-dye')); root.classList.add('hh-shake'); },
  spotlight(fx) { fx.append(layer('hh-fx-spot')); },
  anvil(fx, root) { const a = document.createElement('div'); a.className = 'hh-fx-anvil'; fx.append(a); setTimeout(() => root.classList.add('hh-shake'), 420); },
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

/** Quick success burst. */
export function playWin(root) {
  ensureStyle();
  const w = document.createElement('div');
  w.className = 'hh-win';
  for (let i = 0; i < 10; i++) {
    const c = document.createElement('i');
    c.className = 'hh-coin';
    const a = (i / 10) * Math.PI * 2;
    c.style.setProperty('--dx', Math.cos(a) * 140 + 'px');
    c.style.setProperty('--dy', Math.sin(a) * 140 + 'px');
    w.append(c);
  }
  root.append(w);
}
