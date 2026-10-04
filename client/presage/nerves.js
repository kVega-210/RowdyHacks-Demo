// PR-02 Nerves of Steel (feature-flagged, off by default). Shows a live heart-rate meter during a vault-crack
// minigame and reports whether the player stayed calm. Everything is optional: if the flag is off, the SDK is
// missing, the camera is denied or no reading arrives, startNerves() resolves to a no-op handle and the game
// carries on untouched.
//
// Enable with ?presage=1 on the phone URL (or window.HEIST_PRESAGE = true). The Presage SDK adapter below is a
// thin shim: the go/no-go note from PR-01 decides which global/SDK call to wire into `presageProvider`.

const CALM_BPM_DELTA = 12;

export function enabled() {
  return new URLSearchParams(location.search).get('presage') === '1' || window.HEIST_PRESAGE === true;
}

/** Provider contract: start(onReading:(bpm:number)=>void) -> Promise<stop()> ; throws if unavailable. */
const presageProvider = {
  name: 'presage',
  available: () => !!(window.Presage || window.PresageSDK),
  async start(onReading) {
    const sdk = window.Presage || window.PresageSDK;
    const session = await sdk.start({ camera: 'user', vitals: ['heartRate'] });
    const handler = (v) => { if (v && typeof v.heartRate === 'number') onReading(v.heartRate); };
    session.on ? session.on('vitals', handler) : (session.onVitals = handler);
    return () => (session.stop ? session.stop() : undefined);
  },
};

/** Demo provider for the sandbox only (?presage=demo): a fake but plausible heart rate. */
const demoProvider = {
  name: 'demo',
  available: () => new URLSearchParams(location.search).get('presage') === 'demo',
  async start(onReading) {
    let bpm = 78;
    const iv = setInterval(() => { bpm += (Math.random() - 0.45) * 4; onReading(Math.round(bpm)); }, 1000);
    return () => clearInterval(iv);
  },
};

export async function startNerves(container) {
  const noop = { calm: () => null, stop() {} };
  if (!enabled() && !demoProvider.available()) return noop;
  const provider = [presageProvider, demoProvider].find((p) => { try { return p.available(); } catch (_) { return false; } });
  if (!provider) return noop;
  const meter = document.createElement('div');
  meter.style.cssText = 'position:absolute;top:6px;left:8px;z-index:30;background:#000b;border:2px solid #ff5c7a;border-radius:12px;padding:2px 10px;font:800 16px system-ui;color:#fff;pointer-events:none';
  meter.textContent = '❤️ --';
  container.append(meter);
  let baseline = null, last = null, stop = () => {};
  try {
    stop = await provider.start((bpm) => {
      if (baseline == null) baseline = bpm;
      last = bpm;
      const calm = bpm - baseline <= CALM_BPM_DELTA;
      meter.textContent = `❤️ ${bpm} ${calm ? '😎' : '😰'}`;
      meter.style.borderColor = calm ? '#3dff9a' : '#ff5c7a';
    });
  } catch (_) {
    meter.remove();
    return noop;
  }
  return {
    /** true/false once we have readings, null if none arrived. */
    calm: () => (last == null ? null : last - baseline <= CALM_BPM_DELTA),
    stop() { try { stop(); } catch (_) { /* ignore */ } meter.remove(); },
  };
}
