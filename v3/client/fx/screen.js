// v2 screen helpers: background "heat" (black/blue -> bright red as the round runs out) and quick fade-through-black
// transitions between screens.
export function setHeat(x) {
  const v = Math.max(0, Math.min(1, Number(x) || 0));
  document.documentElement.style.setProperty('--heat', v.toFixed(3));
}

// v2 Freeze: everything on screen stops moving (CSS animations and transitions) except the Freeze overlay, the host
// banner/flash and the siren. Minigames are paused separately (kit timescale 0).
const frozenCss = document.createElement('style');
frozenCss.textContent = `
html.hh-frozen *, html.hh-frozen *::before, html.hh-frozen *::after { animation-play-state: paused !important; transition: none !important; }
html.hh-frozen .ov.freeze, html.hh-frozen .ov.freeze *, html.hh-frozen #banner, html.hh-frozen #banner *, html.hh-frozen #flash,
html.hh-frozen .hh-siren-rise { animation-play-state: running !important; }`;
document.head.append(frozenCss);
export function setFrozen(on) { document.documentElement.classList.toggle('hh-frozen', !!on); }

let curtain = null;
let chain = Promise.resolve();

function getCurtain() {
  if (curtain && curtain.isConnected) return curtain;
  curtain = document.createElement('div');
  Object.assign(curtain.style, { position: 'fixed', top: '0', right: '0', bottom: '0', left: '0', background: '#000', opacity: '0', pointerEvents: 'none', zIndex: '150', transition: 'opacity 130ms ease-in' });
  document.body.append(curtain);
  return curtain;
}

/** Fade to black, run `swap` (which changes the screen), then fade back in. Calls are queued so they never overlap. */
export function fadeSwap(swap) {
  chain = chain.then(() => new Promise((resolve) => {
    const c = getCurtain();
    c.style.transition = 'opacity 120ms ease-in';
    c.style.opacity = '1';
    setTimeout(() => {
      try { swap(); } catch (e) { console.error(e); }
      c.style.transition = 'opacity 220ms ease-out';
      c.style.opacity = '0';
      setTimeout(resolve, 230);
    }, 125);
  }));
  return chain;
}
