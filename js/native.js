/* Taylormade Academy — native-app layer.
   Runs ONLY inside the Capacitor iOS/Android app (browser visitors never see any of this).
   Turns the web experience into a real app: native push notifications, a native bottom tab
   bar with haptics, a native Share sheet, an offline screen, and the App Store "reader"
   payment model (no in-app purchase buttons; subscriptions are handled on the web). */
(function () {
  'use strict';

  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;

  var P = Cap.Plugins || {};
  var platform = (Cap.getPlatform && Cap.getPlatform()) || 'ios';
  document.documentElement.classList.add('cap-native', 'cap-' + platform);

  /* ---------- App Store 3.1.1: the native app sells nothing ----------
     Bounce off any sales surface (the pricing page, the store, and every product
     detail page) to the member's library BEFORE a price or buy button can render.
     Members buy/manage their membership on the web; the app is read-only access. */
  if (/^\/(pricing|store)(\/|$)/.test(location.pathname)) {
    location.replace('/library/');
    return;
  }

  /* ---------- helpers ---------- */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function haptic(style) {
    try { P.Haptics && P.Haptics.impact({ style: style || 'LIGHT' }); } catch (_) {}
  }

  /* ---------- icons + tabs (defined before init runs) ---------- */
  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg>',
    learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5 12 3l9 3.5L12 10z"/><path d="M21 6.5V12"/><path d="M6 8.7V13c0 1.5 2.7 3 6 3s6-1.5 6-3V8.7"/></svg>',
    community: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.5a3 3 0 0 1 0 5.8"/><path d="M17.5 19a5.5 5.5 0 0 0-3-4.9"/></svg>',
    account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
  };
  var TABS = [
    { key: 'home', label: 'Home', href: '/', match: ['/'] },
    { key: 'learn', label: 'Library', href: '/library/', match: ['/library', '/course', '/store', '/pricing'] },
    { key: 'community', label: 'Community', href: '/community/', match: ['/community'] },
    { key: 'account', label: 'Account', href: '/dashboard/', match: ['/dashboard', '/login', '/welcome', '/about'] },
  ];

  /* ---------- styles ---------- */
  function injectStyles() {
    var css = document.createElement('style');
    css.textContent =
      // App Store reader model (3.1.1): the native app shows NO prices, purchase,
      // upgrade, or "see plans" CTAs anywhere. Subs/ebooks are bought on the web.
      'html.cap-native [data-buy],html.cap-native [data-add-cart],html.cap-native [data-checkout],' +
      'html.cap-native [data-checkout-cart],html.cap-native [data-open-cart],html.cap-native [data-price],' +
      'html.cap-native .cart-btn,html.cap-native .cart-drawer,html.cap-native .cart-backdrop,' +
      'html.cap-native .cart-up,html.cap-native .price,html.cap-native .tiers,html.cap-native .tier,' +
      'html.cap-native .upsell,html.cap-native a[href="/pricing/"],html.cap-native a[href^="/pricing"]{display:none!important;}' +
      // suppress the marketing popup inside the app (cleaner native feel)
      'html.cap-native .pop-back{display:none!important;}' +
      // strip the "it's a web page" tells
      'html.cap-native,html.cap-native body{overscroll-behavior:none;}' +
      'html.cap-native *{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}' +
      // room for the bottom tab bar
      'html.cap-native body{padding-bottom:calc(60px + env(safe-area-inset-bottom))!important;}' +
      // bottom tab bar
      '.cap-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:9998;display:flex!important;' +
      'background:rgba(255,255,255,.94);backdrop-filter:saturate(150%) blur(14px);' +
      '-webkit-backdrop-filter:saturate(150%) blur(14px);border-top:1px solid #e9edf6;' +
      'padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -6px 24px -16px rgba(4,18,58,.4);}' +
      '.cap-tab{flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'gap:3px;padding:8px 0 7px;background:none;border:0;cursor:pointer;color:#7d8aa6;' +
      'font:600 10.5px/1 Inter,system-ui,sans-serif;-webkit-tap-highlight-color:transparent;}' +
      '.cap-tab svg{width:23px;height:23px;}' +
      '.cap-tab.active{color:#0b40e0;}' +
      '.cap-tab:active{transform:scale(.92);}' +
      // floating share button
      '.cap-share{position:fixed;right:14px;bottom:calc(72px + env(safe-area-inset-bottom));z-index:9998;' +
      'width:46px;height:46px;border-radius:50%;border:0;cursor:pointer;' +
      'background:linear-gradient(180deg,#fdc921,#f2b705);color:#04123a;' +
      'box-shadow:0 12px 26px -8px rgba(253,201,33,.6);display:flex;align-items:center;justify-content:center;}' +
      '.cap-share:active{transform:scale(.94);}' +
      // offline overlay
      '.cap-offline{position:fixed;inset:0;z-index:10000;display:none;flex-direction:column;align-items:center;' +
      'justify-content:center;text-align:center;padding:32px;gap:6px;' +
      'background:radial-gradient(120% 70% at 50% -8%,#0a205c 0%,#04123a 46%,#020a1f 100%);' +
      'font-family:Inter,system-ui,sans-serif;color:#f7f9ff;}' +
      '.cap-offline.show{display:flex;}' +
      '.cap-offline .b{width:92px;height:92px;border-radius:22px;background:#fff;display:flex;align-items:center;' +
      'justify-content:center;box-shadow:0 24px 60px -18px rgba(0,0,0,.6);margin-bottom:22px;}' +
      '.cap-offline .b img{width:72px;height:72px;}' +
      '.cap-offline h2{font-size:23px;font-weight:700;margin:0 0 8px;}' +
      '.cap-offline p{font-size:15px;color:#bcc8e6;max-width:28ch;line-height:1.5;margin:0;}' +
      '.cap-offline button{margin-top:24px;background:linear-gradient(180deg,#fdc921,#f2b705);color:#04123a;' +
      'border:0;font:700 16px Inter,sans-serif;padding:13px 28px;border-radius:100px;}';
    document.head.appendChild(css);
  }

  /* ---------- bottom tab bar ---------- */
  function buildTabBar() {
    if (document.querySelector('.cap-tabbar')) return;
    var path = location.pathname;
    var bar = document.createElement('div');
    bar.className = 'cap-tabbar';
    bar.setAttribute('role', 'navigation');
    TABS.forEach(function (t) {
      var active = t.match.some(function (m) { return m === '/' ? path === '/' : path.indexOf(m) === 0; });
      var b = document.createElement('button');
      b.className = 'cap-tab' + (active ? ' active' : '');
      b.type = 'button';
      b.innerHTML = ICONS[t.key] + '<span>' + t.label + '</span>';
      b.addEventListener('click', function () {
        haptic('LIGHT');
        if (location.pathname !== t.href) location.href = t.href;
      });
      bar.appendChild(b);
    });
    document.body.appendChild(bar);
  }

  /* ---------- native share ---------- */
  function buildShareButton() {
    if (!P.Share || document.querySelector('.cap-share')) return;
    var btn = document.createElement('button');
    btn.className = 'cap-share';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Share');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8 15.7 6.4"/><path d="M8.3 13.2 15.7 17.6"/></svg>';
    btn.addEventListener('click', function () {
      haptic('MEDIUM');
      try {
        P.Share.share({
          title: document.title || 'Taylormade Academy',
          text: 'Learn the craft and build real things with Taylormade Academy.',
          url: location.href.split('?')[0],
          dialogTitle: 'Share',
        });
      } catch (_) {}
    });
    document.body.appendChild(btn);
  }

  /* ---------- offline screen ---------- */
  function setupOffline() {
    var el = document.createElement('div');
    el.className = 'cap-offline';
    el.innerHTML =
      '<div class="b"><img src="/assets/icon-512.png" alt=""></div>' +
      '<h2>You’re offline</h2>' +
      '<p>No connection right now. Reconnect and tap retry — anything you’ve opened is still here.</p>' +
      '<button type="button">Try again</button>';
    el.querySelector('button').addEventListener('click', function () { haptic('LIGHT'); location.reload(); });
    document.body.appendChild(el);
    function sync() { el.classList.toggle('show', navigator.onLine === false); }
    window.addEventListener('offline', sync);
    window.addEventListener('online', sync);
    sync();
  }

  /* ---------- push notifications ---------- */
  function getAccessToken() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /sb-.*-auth-token$/.test(k)) {
          var v = JSON.parse(localStorage.getItem(k));
          var t = v && (v.access_token || (v.currentSession && v.currentSession.access_token));
          if (t) return t;
        }
      }
    } catch (_) {}
    return null;
  }
  function registerToken(value) {
    var cfg = window.BM_CONFIG || {};
    var jwt = getAccessToken();
    if (!cfg.FUNCTIONS_BASE || !jwt) return; // not signed in yet — registers on a later page load
    fetch(cfg.FUNCTIONS_BASE + '/ea-register-push', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + jwt, 'apikey': cfg.SUPABASE_KEY || '' },
      body: JSON.stringify({ token: value, platform: platform }),
    }).catch(function () {});
  }
  function setupPush() {
    var Push = P.PushNotifications;
    if (!Push) return;
    try {
      Push.addListener('registration', function (t) { if (t && t.value) registerToken(t.value); });
      Push.addListener('pushNotificationActionPerformed', function (e) {
        var data = e && e.notification && e.notification.data;
        if (data && data.url) location.href = data.url;
      });
    } catch (_) {}
    setTimeout(function () {
      Push.checkPermissions().then(function (res) {
        if (res.receive === 'granted') { Push.register(); return; }
        if (res.receive === 'prompt' || res.receive === 'prompt-with-rationale') {
          Push.requestPermissions().then(function (r) { if (r.receive === 'granted') Push.register(); });
        }
      }).catch(function () {});
    }, 1600);
  }

  /* ---------- suppress the marketing popup in-app ---------- */
  function suppressPopup() {
    try { window.BM && typeof BM.popMark === 'function' && BM.popMark(); } catch (_) {}
  }

  /* ---------- in-app login: steer to the 6-digit code, not the magic link ----------
     A bundled app can't open the magic link in-place, so we tell members to type the
     code from their email (the login page already supports code sign-in). */
  function adaptLogin() {
    if (location.pathname.indexOf('/login') !== 0) return;
    function apply() {
      var sent = document.getElementById('sentState');
      if (sent) {
        var p = sent.querySelector('p');
        if (p && p.getAttribute('data-cap') !== '1') {
          p.setAttribute('data-cap', '1');
          p.innerHTML = 'I emailed a 6-digit code to <b id="sentTo" style="color:var(--ink)"></b>. Enter it below to sign in — you don’t need to tap the link in the email.';
        }
      }
    }
    apply();
    setTimeout(apply, 1500);
  }

  /* ---------- init (runs after all the above are defined) ---------- */
  function main() {
    suppressPopup();
    injectStyles();
    buildTabBar();
    buildShareButton();
    setupOffline();
    setupPush();
    adaptLogin();
    setTimeout(function () { try { P.SplashScreen && P.SplashScreen.hide(); } catch (_) {} }, 250);
  }
  ready(main);
})();
