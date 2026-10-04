// Optional dev check (Node + Playwright): a host screen, a real phone page and server-side bots play a whole game.
// Start a sped-up server first:  HEIST_TIME_SCALE=4 PORT=7172 ./run.sh   (from v2/)
// Then: node scripts/browser-check/e2e.mjs http://localhost:7172 [screenshotDir]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const base = process.argv[2] || 'http://localhost:7172';
const shots = process.argv[3];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const hostCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const host = await hostCtx.newPage();
host.on('pageerror', (e) => errors.push('host: ' + e.message));
await host.goto(base + '/host/?new=1');
await host.waitForFunction(() => window.__host && window.__host.store.room);
const room = await host.evaluate(() => window.__host.store.room);
console.log('room', room);

const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
const phone = await phoneCtx.newPage();
phone.on('pageerror', (e) => errors.push('phone: ' + e.message));
await phone.goto(`${base}/phone/?room=${room}`);
await phone.fill('input[autocomplete=nickname]', 'Tester');
await phone.locator('button.big-btn', { hasText: 'JOIN THE CREW' }).dispatchEvent('pointerdown');
await phone.waitForFunction(() => window.__phone.store.playerId);
await host.click('#bots');
await host.waitForFunction(() => window.__host.store.state && window.__host.store.state.players.length >= 4, null, { timeout: 15000 });
if (shots) { await host.screenshot({ path: `${shots}/host-lobby.png` }); await phone.screenshot({ path: `${shots}/phone-lobby.png` }); }
await host.click('#start');

const seen = new Set();
const t0 = Date.now();
let taps = 0;
const v2 = { siren: false, frozen: false };
while (Date.now() - t0 < 6 * 60 * 1000) {
  const phase = await phone.evaluate(() => window.__phone.store.phase);
  if (!seen.has(phase)) {
    seen.add(phase);
    console.log('phase', phase, Math.round((Date.now() - t0) / 1000) + 's');
    if (shots) {
      await new Promise((r) => setTimeout(r, phase === 'play' ? 1500 : 400));
      await phone.screenshot({ path: `${shots}/phone-${phase}.png` });
      await host.screenshot({ path: `${shots}/host-${phase}.png` });
    }
  }
  // v2: freeze warning siren rising from behind the terminal, then the freeze itself.
  const fx = await phone.evaluate(() => ({ siren: !!document.querySelector('.hh-siren-rise'), frozen: !!document.querySelector('.ov.freeze') }));
  if (fx.siren && !v2.siren) console.log('siren rising', Math.round((Date.now() - t0) / 1000) + 's');
  if (fx.frozen && !v2.frozen) console.log('freeze', Math.round((Date.now() - t0) / 1000) + 's');
  v2.siren ||= fx.siren; v2.frozen ||= fx.frozen;
  if (phase === 'end') {
    const fin = await phone.evaluate(() => !!window.__phone.store.final);
    if (fin) break;
  }
  // Play like a (very bad) human: tap random visible buttons in the game box / overlays / escape.
  await phone.evaluate(() => {
    const pool = [...document.querySelectorAll('#game button, #overlay button, .escape-btn, .ov .grab')].filter((b) => b.offsetParent);
    const b = pool[Math.floor(Math.random() * pool.length)];
    if (b) {
      const r = b.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'touch' };
      b.dispatchEvent(new PointerEvent('pointerdown', o));
      b.dispatchEvent(new PointerEvent('pointerup', o));
    }
  });
  taps++;
  await new Promise((r) => setTimeout(r, 250));
}
await new Promise((r) => setTimeout(r, 2500));
if (shots) { await phone.screenshot({ path: `${shots}/phone-final.png`, fullPage: true }); await host.screenshot({ path: `${shots}/host-final.png` }); }
const result = await phone.evaluate(() => ({ final: window.__phone.store.final && window.__phone.store.final.winnerName, roast: !!window.__phone.store.roast }));
const hostFinal = await host.evaluate(() => window.__host.store.final && window.__host.store.final.winnerName);
const term = async (pg) => pg.evaluate(() => { const t = document.querySelector('#terminal'); return { lines: t.querySelectorAll('.hh-term-line').length, scroll: t.classList.contains('scroll'), h: Math.round(t.getBoundingClientRect().height / innerHeight * 100) }; });
const terms = { phone: await term(phone), host: await term(host) };
await browser.close();
console.log({ phases: [...seen], taps, result, hostFinal, v2, terms, errors });
const ok = result.final && hostFinal && errors.length === 0 && ['lobby', 'briefing', 'play', 'results', 'end'].every((p) => seen.has(p))
  && terms.phone.lines > 5 && terms.host.lines > 5 && terms.phone.scroll && terms.host.scroll;
console.log(ok ? 'E2E PASS' : 'E2E FAIL');
process.exit(ok ? 0 : 1);
