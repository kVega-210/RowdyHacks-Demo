// CL-06 key QR scanner. BarcodeDetector when the browser has it, jsQR (lazy loaded) otherwise, and a manual
// short-code field that always works. openScanner(container, {title, onCode}) -> {close}.
import { h, bigBtn } from '../ui.js';

let jsqrPromise = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsqrPromise) {
    jsqrPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      s.onload = () => res(window.jsQR);
      s.onerror = rej;
      document.head.append(s);
    });
  }
  return jsqrPromise;
}

export function openScanner(container, { title = 'Scan a key', onCode, showManual = true }) {
  let stream = null, raf = 0, closed = false, detector = null;
  const video = h('video', { playsinline: true, muted: true, autoplay: true });
  video.setAttribute('playsinline', '');
  const msg = h('div', { class: 'msg' }, 'Starting camera...');
  const canvas = document.createElement('canvas');
  const manual = h('input', { class: 'field code', maxlength: 10, placeholder: 'HK3-1F9A2C', autocapitalize: 'characters', autocomplete: 'off' });
  const box = h('div', { class: 'scanbox', style: { width: '100%', maxWidth: '380px' } },
    h('h2', { class: 'center' }, title),
    h('div', { class: 'scanner' }, video, h('div', { class: 'reticle' }), msg),
    showManual ? h('div', {}, h('label', { class: 'lbl' }, "Can't scan? Type the code on the tag"), manual,
      bigBtn('USE CODE', () => { const c = manual.value.trim().toUpperCase(); if (c) found(c); }, 'alt')) : null);
  container.append(box);

  function found(code) {
    if (closed) return;
    close();
    onCode(code.trim());
  }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'No camera here. Type the code below.'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      msg.textContent = e && e.name === 'NotAllowedError' ? 'Camera blocked. Allow it in settings, or type the code.' : 'Camera unavailable. Type the code.';
      return;
    }
    if (closed) { stream.getTracks().forEach((t) => t.stop()); return; }
    video.srcObject = stream;
    await video.play().catch(() => {});
    msg.textContent = 'Point at the key tag';
    if ('BarcodeDetector' in window) {
      try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) { detector = null; }
    }
    let jsQR = null;
    if (!detector) jsQR = await loadJsQR().catch(() => null);
    if (!detector && !jsQR) { msg.textContent = 'Scanner unavailable. Type the code.'; return; }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let busy = false;
    const loop = async () => {
      if (closed) return;
      if (!busy && video.readyState >= 2) {
        busy = true;
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes.length) return found(codes[0].rawValue);
          } else {
            const w = 480, hh = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
            canvas.width = w; canvas.height = hh;
            ctx.drawImage(video, 0, 0, w, hh);
            const img = ctx.getImageData(0, 0, w, hh);
            const r = jsQR(img.data, w, hh, { inversionAttempts: 'attemptBoth' });
            if (r && r.data) return found(r.data);
          }
        } catch (_) { /* keep scanning */ }
        busy = false;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  function close() {
    closed = true;
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    box.remove();
  }

  start();
  return { close };
}
