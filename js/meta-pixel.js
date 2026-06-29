/* Meta (Facebook) Pixel — loads ONLY if BM_CONFIG.META_PIXEL_ID is set.
   Tracks PageView on every page so you can build Custom Audiences (website visitors),
   Lookalikes, and retarget. Conversion events (Lead on sign-in, CompleteRegistration on
   onboarding) are fired from the login + welcome pages. No-op until you paste your Pixel ID. */
(function () {
  // No third-party ad tracking inside the native app (App Store privacy / ATT).
  // The Meta Pixel runs on the website only; in the Capacitor app it's a no-op.
  var Cap = window.Capacitor;
  if (Cap && Cap.isNativePlatform && Cap.isNativePlatform()) return;
  var id = (window.BM_CONFIG || {}).META_PIXEL_ID;
  if (!id) return;
  if (window.fbq) { try { fbq('track', 'PageView'); } catch (_) {} return; }
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', id);
  fbq('track', 'PageView');
})();
