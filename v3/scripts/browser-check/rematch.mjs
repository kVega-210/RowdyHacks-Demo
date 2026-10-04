// Optional dev check: finish a game (admin end), press "New heist", and check the host, the phone and the bots all
// land in the new room's lobby. Server first: HEIST_TIME_SCALE=4 PORT=7173 ./run.sh (from v3/)
// Then: node scripts/browser-check/rematch.mjs http://localhost:7173 [screenshotDir]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const base = process.argv[2] || 'http://localhost:7173';
const shots = process.argv[3];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const host = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
host.on('pageerror', (e) => errors.push('host: ' + e.message));
await host.goto(base + '/host/?new=1');
await host.waitForFunction(() => window.__host && window.__host.store.room);
const room = await host.evaluate(() => window.__host.store.room);
const phone = await (await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true })).newPage();
phone.on('pageerror', (e) => errors.push('phone: ' + e.message));
await phone.goto(`${base}/phone/?room=${room}`);
await phone.fill('input[autocomplete=nickname]', 'Tester');
await phone.locator('button.big-btn', { hasText: 'JOIN THE CREW' }).dispatchEvent('pointerdown');
await phone.waitForFunction(() => window.__phone.store.playerId);
const face = await phone.evaluate(() => window.__phone.store.face);
await host.click('#bots');
await host.waitForFunction(() => window.__host.store.state && window.__host.store.state.players.length >= 4, null, { timeout: 15000 });
await host.waitForTimeout(2000); // let every bot finish joining
const before = await host.evaluate(() => window.__host.store.state.players.map((p) => p.name).sort());
await host.click('#start');
await phone.waitForFunction(() => window.__phone.store.phase === 'play', null, { timeout: 60000 });
await host.evaluate(() => window.__host.sock.send({ t: 'admin', action: 'end_game' }));
await host.waitForSelector('[data-new-heist]', { timeout: 30000 });
if (shots) await host.screenshot({ path: `${shots}/host-final.png` });
const offline = process.env.OFFLINE === '1'; // the phone has dropped (locked screen) when the host presses New heist
if (offline) await phone.evaluate(() => { const s = window.__phone.sock; s.closed = true; s.ws.close(); });
await host.click('[data-new-heist]');
await host.waitForTimeout(1500);
if (offline) await phone.evaluate(() => { const s = window.__phone.sock; s.closed = false; s.connect(); });
await host.waitForFunction((r) => window.__host.store.room !== r && window.__host.store.phase === 'lobby', room, { timeout: 10000 });
const room2 = await host.evaluate(() => window.__host.store.room);
await phone.waitForFunction((r) => window.__phone.store.room === r && window.__phone.store.phase === 'lobby', room2, { timeout: 10000 });
await host.waitForFunction((n) => window.__host.store.state && window.__host.store.state.players.length === n, before.length, { timeout: 10000 }).catch(() => {});
const after = await host.evaluate(() => window.__host.store.state.players.map((p) => p.name).sort());
const face2 = await phone.evaluate(() => window.__phone.store.face);
if (shots) { await host.screenshot({ path: `${shots}/host-new-lobby.png` }); await phone.screenshot({ path: `${shots}/phone-new-lobby.png` }); }
// The moved crew can play the new heist too.
await host.click('#start');
await phone.waitForFunction(() => window.__phone.store.phase === 'play', null, { timeout: 60000 });
console.log({ room, room2, before, after, face, face2 });
const ok = room2 !== room && JSON.stringify(before) === JSON.stringify(after) && face === face2 && !errors.length;
console.log(errors.length ? errors : 'no page errors');
console.log(ok ? 'REMATCH PASS' : 'REMATCH FAIL');
await browser.close();
process.exit(ok ? 0 : 1);
