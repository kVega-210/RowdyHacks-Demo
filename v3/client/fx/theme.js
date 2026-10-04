// v3 round themes: Break-in and Rival rounds are CLASSIC (black, red, yellow highlights); Hack rounds are CYBER
// (terminal / Matrix green). The palettes and fonts live in /fx/theme.css; this only flips <html data-theme>.
const THEME_BY_ROUND = { breakin: 'classic', rival: 'classic', hack: 'cyber' };

export function themeForRound(roundType) {
  return THEME_BY_ROUND[roundType] || 'classic';
}

/** Apply a theme by name ('classic' | 'cyber'). Call it while the screen is faded to black so the swap is hidden. */
export function setTheme(name) {
  const t = name === 'cyber' ? 'cyber' : 'classic';
  if (document.documentElement.dataset.theme === t) return;
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'cyber' ? '#010a04' : '#0a0405');
}

export function setRoundTheme(roundType) {
  setTheme(themeForRound(roundType));
}
