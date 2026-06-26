/* Taylormade Academy — PWA boot.
   1) Registers the service worker (offline + instant loads).
   2) Adds an install affordance: native prompt on Android/desktop Chrome,
      a friendly "Add to Home Screen" coach on iOS Safari (which has no prompt API). */
(function () {
  'use strict';

  // ---- 1. Service worker ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  // ---- 2. Install affordance ----
  var standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (standalone) return; // already installed as an app

  var ua = window.navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  var isSafari = isIOS && /safari/i.test(ua) && !/(crios|fxios|edgios|opios)/i.test(ua);

  function dismissed() { try { return localStorage.getItem('tma_a2hs') === 'off'; } catch (_) { return false; } }
  function setDismissed() { try { localStorage.setItem('tma_a2hs', 'off'); } catch (_) {} }

  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!dismissed()) showBar('android');
  });
  window.addEventListener('appinstalled', function () {
    hideBar();
    try { localStorage.setItem('tma_a2hs', 'off'); } catch (_) {}
  });

  if (isIOS && isSafari && !dismissed()) {
    setTimeout(function () { showBar('ios'); }, 2800);
  }

  var bar = null;
  function shareIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0b40e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 16V4"/><path d="m8 8 4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>';
  }

  function showBar(kind) {
    if (bar || dismissed()) return;
    bar = document.createElement('div');
    bar.className = 'tma-a2hs';
    var icon = '<img class="tma-a2hs-ic" src="/assets/icon-192.png" alt="">';
    if (kind === 'ios') {
      bar.innerHTML =
        icon +
        '<div class="tma-a2hs-tx"><b>Get the Academy app</b>' +
        '<span>Tap ' + shareIcon() + ' below, then <b>Add to Home Screen</b>.</span></div>' +
        '<button class="tma-a2hs-x" aria-label="Close">&times;</button>';
    } else {
      bar.innerHTML =
        icon +
        '<div class="tma-a2hs-tx"><b>Install the Academy app</b>' +
        '<span>One tap. Works offline.</span></div>' +
        '<button class="tma-a2hs-go">Install</button>' +
        '<button class="tma-a2hs-x" aria-label="Close">&times;</button>';
    }
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add('in'); });

    bar.querySelector('.tma-a2hs-x').addEventListener('click', function () {
      setDismissed();
      hideBar();
    });
    var go = bar.querySelector('.tma-a2hs-go');
    if (go) {
      go.addEventListener('click', function () {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          if (deferredPrompt.userChoice) deferredPrompt.userChoice.finally(function () { deferredPrompt = null; });
        }
        hideBar();
      });
    }
  }

  function hideBar() {
    if (!bar) return;
    var b = bar;
    bar = null;
    b.classList.remove('in');
    setTimeout(function () { if (b && b.parentNode) b.parentNode.removeChild(b); }, 320);
  }

  var style = document.createElement('style');
  style.textContent =
    '.tma-a2hs{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:9999;' +
    'display:flex;align-items:center;gap:12px;max-width:480px;margin:0 auto;' +
    'background:#fff;border:1px solid #e6ebf5;border-radius:18px;padding:11px 12px;' +
    'box-shadow:0 20px 54px -14px rgba(4,18,58,.5);' +
    'font-family:Inter,system-ui,-apple-system,sans-serif;' +
    'transform:translateY(160%);transition:transform .36s cubic-bezier(.16,1,.3,1);}' +
    '.tma-a2hs.in{transform:translateY(0);}' +
    '.tma-a2hs-ic{width:44px;height:44px;border-radius:11px;flex:0 0 auto;box-shadow:0 2px 8px rgba(4,18,58,.12);}' +
    '.tma-a2hs-tx{flex:1 1 auto;display:flex;flex-direction:column;gap:2px;min-width:0;color:#0a1733;line-height:1.32;}' +
    '.tma-a2hs-tx b{font-size:14px;font-weight:700;}' +
    '.tma-a2hs-tx span{font-size:12.5px;color:#475569;}' +
    '.tma-a2hs-go{flex:0 0 auto;background:#fdc921;color:#04123a;border:0;font-weight:700;font-size:14px;' +
    'padding:10px 17px;border-radius:100px;cursor:pointer;font-family:inherit;}' +
    '.tma-a2hs-go:active{transform:scale(.97);}' +
    '.tma-a2hs-x{flex:0 0 auto;background:none;border:0;color:#94a3b8;font-size:23px;line-height:1;cursor:pointer;padding:2px 6px;}' +
    '@media (display-mode: standalone){.tma-a2hs{display:none!important;}}';
  document.head.appendChild(style);
})();
