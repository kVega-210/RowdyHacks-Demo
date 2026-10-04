// MG-31 Ventilation Shaft: at each junction follow the breeze; a dead end means you're stuck.
import { game, h, css, byD } from '../fx/kit.js';

export const meta = { id: 'ventilation-shaft', name: 'Ventilation Shaft', tags: ['classic'], baseDurationMs: 12000 };

const DIRS = [['◀', 'LEFT'], ['▲', 'UP'], ['▶', 'RIGHT']];

css('mg-vent', `
.vs-duct{position:relative;height:190px;border-radius:12px;background:repeating-linear-gradient(45deg,#2b313d 0 10px,#232833 10px 20px);border:4px solid #4a5263;margin-bottom:10px;overflow:hidden}
.vs-breeze{position:absolute;font-size:44px;color:#bfe9ff;opacity:.0}
.vs-you{position:absolute;left:50%;bottom:10px;margin-left:-20px;font-size:40px}
.vs-depth{position:absolute;top:6px;left:10px;font-weight:900}
.vs-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.vs-pad .hh-btn{height:64px;font-size:26px}
`);

export function mount(container, opts) {
  const g = game(container, opts, { id: meta.id, title: meta.name, hint: 'Follow the breeze (〰️) to the vault', timeMs: 12000 });
  const junctions = byD(g, 3, 4, 5);
  const path = Array.from({ length: junctions }, () => g.r.int(3));
  let step = 0;
  const breeze = h('div', { class: 'vs-breeze' }, '〰️');
  const depth = h('div', { class: 'vs-depth' });
  const duct = h('div', { class: 'vs-duct' }, breeze, depth, h('div', { class: 'vs-you' }, '🐀'));
  const POS = [{ left: '8%', top: '45%' }, { left: '44%', top: '8%' }, { left: '80%', top: '45%' }];
  const show = () => {
    depth.textContent = `Junction ${step + 1}/${junctions}`;
    Object.assign(breeze.style, POS[path[step]]);
  };
  show();
  const strength = byD(g, 1, 0.55, 0.35);
  g.loop((dt, t) => {
    const pulse = g.d === 3 ? (Math.floor(t / 700) % 3 === 0 ? 1 : 0) : 0.6 + 0.4 * Math.sin(t / 200);
    breeze.style.opacity = String(strength * pulse);
  });
  g.stage.append(duct, h('div', { class: 'vs-pad' }, DIRS.map(([icon], i) => g.btn(icon, () => {
    if (i !== path[step]) return g.lose('dead end');
    step++;
    if (step >= junctions) g.win(); else show();
  }, 'alt'))));
  return g.handle();
}
