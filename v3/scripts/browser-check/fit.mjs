// v3 layout check: mounts every minigame inside the real phone page at several visible screen sizes and lists any
// button or label that ends up below the game area (i.e. hidden under the terminal).
// Usage: node scripts/browser-check/fit.mjs http://localhost:7072 [320x480,375x548,...] [gameIdFilter]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
const [base, sizes, filter] = [process.argv[2], (process.argv[3] || '360x560,375x548,390x664').split(','), process.argv[4]];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const games = await (await fetch(base + '/api/minigames')).json();
const bad = [];
for (const sz of sizes) {
  const [w, hgt] = sz.split('x').map(Number);
  const p = await (await b.newContext({ viewport: { width: w, height: hgt }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  await p.goto(base + '/phone/');
  await p.waitForFunction(() => window.__HH && window.__HH.ready);
  for (const g of games) {
    if (filter && !g.id.includes(filter)) continue;
    for (const d of [1, 2, 3]) {
      const r = await p.evaluate(async ({ file, d }) => {
        document.getElementById('hud').hidden = false;
        document.getElementById('view').hidden = true;
        const box = document.getElementById('game'); box.hidden = false; box.replaceChildren();
        const holder = document.createElement('div'); holder.className = 'gamebox'; box.append(holder);
        const mod = await import(file);
        const hd = mod.mount(holder, { difficulty: d, speed: 1, seed: 7, tiers: { 1: {}, 2: {}, 3: {} }, basePayout: 100, onSuccess() {}, onFail() {} });
        await new Promise((res) => setTimeout(res, 700));
        const gr = box.getBoundingClientRect();
        const out = [];
        for (const el of holder.querySelectorAll('button, .hh-label, [class*="-label"], .hh-title, .hh-status')) {
          const rc = el.getBoundingClientRect();
          if (!rc.width || !rc.height || getComputedStyle(el).visibility === 'hidden') continue;
          const over = Math.round(rc.bottom - gr.bottom), under = Math.round(gr.top - rc.top);
          if (over > 2 || under > 2) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}${el.textContent ? '"' + el.textContent.trim().slice(0, 10) + '"' : ''} ${over > 2 ? '+' + over + 'px below' : under + 'px above'}`);
        }
        hd && hd.destroy && hd.destroy();
        return { gameH: Math.round(gr.height), out };
      }, { file: g.file, d });
      if (r.out.length) bad.push(`${sz} game=${r.gameH}px ${g.id} d${d}: ${r.out.slice(0, 3).join('; ')}`);
    }
  }
  const gameH = await p.evaluate(() => Math.round(document.getElementById('game').getBoundingClientRect().height));
  console.log(`${sz}: game area ${gameH}px`);
}
console.log(bad.length + ' problems'); bad.forEach((x) => console.log(' ', x));
await b.close();
