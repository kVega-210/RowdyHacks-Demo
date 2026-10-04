// Optional dev check (Node + Playwright): mounts every minigame in the sandbox at every difficulty, fuzzes it
// with random taps, and asserts the DOC-03 contract: mount returns {destroy}, exactly one of onSuccess/onFail
// is called once, no uncaught errors. Usage: node scripts/browser-check/minigames.mjs [baseUrl]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const base = process.argv[2] || 'http://localhost:7071';
const games = await (await fetch(base + '/api/minigames')).json();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const jobs = [];
for (const g of games) for (const d of [1, 2, 3]) jobs.push({ g, d, speed: d === 2 ? 1 : 2 });
const failures = [];
const stats = { runs: 0, wins: 0, fails: 0 };

async function worker() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + '/dev/minigame-sandbox/');
  await page.waitForFunction(() => window.__sandbox);
  while (jobs.length) {
    const { g, d, speed } = jobs.shift();
    errors.length = 0;
    const res = await page.evaluate(async ({ file, d, speed }) => {
      const mod = await import(file);
      const stage = document.getElementById('stage');
      stage.replaceChildren();
      const calls = [];
      let handle;
      try {
        handle = mod.mount(stage, {
          difficulty: d, speed, seed: Math.floor(Math.random() * 1e6), tiers: { 1: { payoutMult: 1 }, 2: { payoutMult: 2 }, 3: { payoutMult: 3.5 } },
          onSuccess: (r) => calls.push(['success', r]), onFail: (r) => calls.push(['fail', r]),
        });
      } catch (e) { return { error: 'mount threw: ' + e.message }; }
      if (!handle || typeof handle.destroy !== 'function') return { error: 'mount did not return {destroy}' };
      const t0 = performance.now();
      // Random tapping + dragging until a result or 20s.
      while (!calls.length && performance.now() - t0 < 20000) {
        const btns = [...stage.querySelectorAll('button, .hh-ctl')].filter((b) => b.offsetParent);
        const b = btns[Math.floor(Math.random() * btns.length)];
        if (b) {
          const r = b.getBoundingClientRect();
          const x = r.left + Math.random() * r.width, y = r.top + Math.random() * r.height;
          const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' };
          b.dispatchEvent(new PointerEvent('pointerdown', opts));
          b.dispatchEvent(new PointerEvent('pointermove', Object.assign({}, opts, { clientY: y - 40 })));
          b.dispatchEvent(new PointerEvent('pointerup', opts));
        }
        await new Promise((r) => setTimeout(r, 120 + Math.random() * 300));
      }
      await new Promise((r) => setTimeout(r, 1500));
      handle.destroy();
      const leftovers = stage.children.length;
      return { calls: calls.map((c) => c[0]), payload: calls[0] && calls[0][1], ms: Math.round(performance.now() - t0), leftovers };
    }, { file: g.file, d, speed });
    stats.runs++;
    const tag = `${g.id} d${d} s${speed}`;
    if (res.error) failures.push(`${tag}: ${res.error}`);
    else if (res.calls.length !== 1) failures.push(`${tag}: expected exactly 1 callback, got ${JSON.stringify(res.calls)}`);
    else {
      stats[res.calls[0] === 'success' ? 'wins' : 'fails']++;
      if (g.tags.includes('choice') && !(res.payload && res.payload.wager && res.payload.wager.tier)) failures.push(`${tag}: choice game result missing wager.tier`);
    }
    if (res.leftovers) failures.push(`${tag}: destroy() left ${res.leftovers} nodes behind`);
    if (errors.length) failures.push(`${tag}: page errors: ${errors.join(' | ')}`);
    process.stdout.write(res.error || (res.calls && res.calls.length === 1) ? '.' : 'x');
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: 8 }, worker));
await browser.close();
console.log(`\n${stats.runs} runs: ${stats.wins} fuzz wins, ${stats.fails} fuzz fails`);
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('All minigames honour the DOC-03 contract.');
