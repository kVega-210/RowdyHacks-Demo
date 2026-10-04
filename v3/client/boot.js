/* Boot loader for the phone and host pages. A plain (non-module) script in old-browser-safe syntax, so it runs
   everywhere and can explain a failure instead of leaving a blank page.
   - Shows any startup error on screen (so a player can read it out or screenshot it).
   - Polyfills the few DOM helpers older phones lack.
   - Fetches the JSON the app needs, stores it on window.__HH, then imports the app module. The app modules
     therefore need no top-level await (iOS < 15 and older Android browsers cannot parse it).
   Usage: <script src="/boot.js" data-entry="/phone/app.js" data-json="balance=/shared/balance.json"></script> */
(function () {
  var me = document.currentScript;
  var started = false;

  function fatal(msg) {
    var box = document.getElementById('hh-fatal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'hh-fatal';
      box.setAttribute('style', 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;background:#070a12;color:#e9f1ff;' +
        'font:16px/1.4 system-ui,sans-serif;padding:24px;overflow:auto');
      box.innerHTML = '<h2 style="color:#ffd84d;margin:0 0 12px">HEIST HAVOC! could not start</h2>' +
        '<p>Try the latest <b>Chrome</b> (Android) or <b>Safari</b> (iPhone). If you scanned the QR code with another app, ' +
        'open the link in your normal browser instead.</p><p>Details:</p><pre id="hh-fatal-msg" style="white-space:pre-wrap;' +
        'color:#ff5c7a;font-size:13px"></pre><button onclick="location.reload()" style="font:inherit;font-weight:800;' +
        'padding:12px 20px;border:0;border-radius:12px;background:#ffd84d;color:#0b0f1a">Retry</button>';
      (document.body || document.documentElement).appendChild(box);
    }
    var pre = document.getElementById('hh-fatal-msg');
    pre.textContent += msg + '\n';
  }
  window.__hhFatal = fatal;

  // Errors before the app is running are fatal (blank page otherwise); afterwards the app handles its own.
  window.addEventListener('error', function (e) {
    if (!window.__HH || !window.__HH.ready) fatal((e.message || 'Script error') + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    if (!window.__HH || !window.__HH.ready) fatal('Startup failed: ' + (e.reason && (e.reason.message || e.reason)));
  });

  // Small polyfills for older iOS / Android browsers.
  function replaceChildren() {
    while (this.lastChild) this.removeChild(this.lastChild);
    if (arguments.length) this.append.apply(this, arguments);
  }
  if (!Element.prototype.replaceChildren) Element.prototype.replaceChildren = replaceChildren;
  if (typeof DocumentFragment !== 'undefined' && !DocumentFragment.prototype.replaceChildren) DocumentFragment.prototype.replaceChildren = replaceChildren;

  var noModules = !('noModule' in HTMLScriptElement.prototype);
  if (noModules || !window.fetch || !window.Promise || !window.WebSocket) {
    fatal('This browser is too old for the game (needs JavaScript modules, fetch and WebSockets).');
    return;
  }

  var entry = me.getAttribute('data-entry');
  var wants = (me.getAttribute('data-json') || '').split(',').filter(Boolean);
  window.__HH = { ready: false };
  Promise.all(wants.map(function (pair) {
    var i = pair.indexOf('='), key = pair.slice(0, i), url = pair.slice(i + 1), optional = key.charAt(0) === '?';
    if (optional) key = key.slice(1);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' returned HTTP ' + r.status);
      return r.json();
    }).then(function (j) { window.__HH[key] = j; }, function (err) {
      if (!optional) throw new Error('Could not load ' + url + ': ' + err.message);
    });
  })).then(function () {
    started = true;
    // import() is wrapped in Function so this file still parses in browsers that lack it.
    return new Function('u', 'return import(u)')(entry);
  }).then(function () {
    window.__HH.ready = true;
  }, function (err) {
    fatal((started ? 'Could not start the app: ' : '') + (err && err.message ? err.message : err));
  });
})();
