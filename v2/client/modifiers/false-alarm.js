// MG-42 False Alarm: flashes a fake ALARM warning over the minigame. It is pointer-events:none, so every tap
// passes straight through; it only distracts.
import { timed, styleOnce } from './_shared.js';

export const meta = { id: 'false-alarm', name: 'False Alarm', tags: ['sabotage'] };

styleOnce('false-alarm', `
.mod-alarm{position:absolute;inset:0;z-index:40;pointer-events:none;display:flex;align-items:center;justify-content:center;
  font:900 34px system-ui,sans-serif;color:#fff;text-shadow:0 3px 0 #000;letter-spacing:.06em;animation:modAlarm .5s steps(2) infinite}
@keyframes modAlarm{0%{background:rgba(255,0,40,.35)}100%{background:rgba(255,0,40,0)}}
.mod-alarm span{max-width:86%;text-align:center;overflow-wrap:anywhere;transform:rotate(-8deg);border:4px solid #fff;padding:6px 14px;border-radius:10px;background:#ff2244aa}
`);

// v2: the fake alerts come in random languages.
const TEXT = [
  '⚠️ ¡ALARMA!', '⚠️ ALARME !', '⚠️ ALLARME!', '⚠️ ALARM!', '⚠️ ALARME!', '⚠️ ТРЕВОГА!', '⚠️ 警報！', '⚠️ 警报！', '⚠️ 경보!',
  '⚠️ إنذار!', '⚠️ अलार्म!', '⚠️ ALARM!', '⚠️ HÄLYTYS!', '⚠️ LARM!', '⚠️ ALARMA!', '⚠️ ΣΥΝΑΓΕΡΜΟΣ!', '⚠️ אזעקה!', '⚠️ ALARM!',
  '¡INTRUSO!', 'EINDRINGLING!', 'INTRUS !', 'НАРУШИТЕЛЬ!', '侵入者！', '入侵者！', '침입자!', 'INTRUSO!', 'INDRINGER!',
  'ALERTE SÉCURITÉ', 'SICHERHEITSALARM', 'ALLERTA SICUREZZA', 'ALERTA DE SEGURANÇA', 'GÜVENLİK İHLALİ', 'BEZPEČNOSTNÍ POPLACH',
  '¡LA POLICÍA VIENE!', 'POLIZEI KOMMT!', 'LA POLICE ARRIVE !', '警察が来る！', 'ПОЛИЦИЯ ЕДЕТ!', 'POLISI DATANG!', 'POLISEN KOMMER!',
];

export function applyModifier(el, { duration = 6000, strength = 0.5 } = {}) {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const layer = document.createElement('div');
  layer.className = 'mod-alarm';
  const label = document.createElement('span');
  layer.append(label);
  el.append(layer);
  const every = 1600 - Math.max(0, Math.min(1, strength)) * 800;
  const flip = () => {
    label.textContent = TEXT[Math.floor(Math.random() * TEXT.length)];
    layer.style.visibility = layer.style.visibility === 'hidden' ? 'visible' : 'hidden';
  };
  flip();
  const iv = setInterval(flip, every / 2);
  return timed(duration, () => { clearInterval(iv); layer.remove(); });
}
