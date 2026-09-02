/* Taylormade Academy — PWA boot.
   Registers the service worker (offline + instant loads).
   The "Install the Academy app" / iOS "Add to Home Screen" bar was removed 2026-09-02. */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();

/* Native-app (Capacitor) polish: when the site runs inside the Taylormade Academy native
   app, strip the "it's a web page" tells (overscroll bounce, long-press callouts, tap
   highlight) and tag <html> so the app can adapt. Browser visitors are never affected. */
(function () {
  'use strict';
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  document.documentElement.classList.add('cap-native');
  var s = document.createElement('style');
  s.textContent =
    'html.cap-native,html.cap-native body{overscroll-behavior:none;}' +
    'html.cap-native *{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}' +
    /* keep real content selectable (ebook text, posts), kill it only on chrome */
    'html.cap-native .site-header,html.cap-native .appbar,html.cap-native button,html.cap-native .btn,' +
    'html.cap-native nav,html.cap-native .nav,html.cap-native .navlink{-webkit-user-select:none;user-select:none;}';
  document.head.appendChild(s);
})();
