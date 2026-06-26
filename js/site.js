/* Taylormade Academy site behaviors. Vanilla JS, no build step. */
(function () {
  var CFG = window.BM_CONFIG || {};
  var BM = {
    _t: null,
    _cart: [],
    _prods: {},
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); },
    initials: function (n) { var p = String(n || 'M').trim().split(/\s+/);
      return ((p[0] || 'M')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); },
    avatarHtml: function (name, url, cls) {
      cls = cls ? (' ' + cls) : '';
      var safe = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g,
        function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); };
      if (url) return '<span class="avatar' + cls + '" style="background-image:url(' +
        safe(url) + ');background-size:cover;background-position:center;color:transparent"></span>';
      return '<span class="avatar' + cls + '">' + safe(BM.initials(name)) + '</span>';
    },
    uploadAvatar: async function (supabase, userId, file) {
      if (!file) throw new Error('No file');
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Use a PNG, JPG, or WebP image.');
      if (file.size > 3 * 1024 * 1024) throw new Error('Image must be under 3 MB.');
      var ext = (file.type === 'image/png') ? 'png' : (file.type === 'image/webp') ? 'webp' : 'jpg';
      var path = userId + '/avatar.' + ext;
      var up = await supabase.storage.from('ea-avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      var pub = supabase.storage.from('ea-avatars').getPublicUrl(path);
      // cache-bust so a re-upload to the same path refreshes immediately
      return pub.data.publicUrl + '?t=' + Date.now();
    },
    fmt: function (c) { var d = c / 100; return (c % 100 === 0) ? ('$' + d) : ('$' + d.toFixed(2)); },
    toast: function (msg, ms) {
      var t = document.getElementById('toast'); if (!t) return;
      t.innerHTML = msg; t.classList.add('show');
      clearTimeout(BM._t); BM._t = setTimeout(function () { t.classList.remove('show'); }, ms || 3600);
    },
    buy: function (slug) {
      if (!CFG.FUNCTIONS_BASE) { BM.toast('The store is live, payments switch on this week.'); return; }
      fetch(CFG.FUNCTIONS_BASE + '/ea-create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: slug })
      }).then(function (r) { if (r.status === 503) { BM.toast('Payments are not switched on yet. <b>Check back very soon.</b>'); return null; } return r.json(); })
        .then(function (d) { if (d && d.url) { location.href = d.url; } else if (d) { BM.toast('Could not start checkout. Try again in a minute.'); } })
        .catch(function () { BM.toast('Payments turn on soon. <b>Hang tight.</b>'); });
    },

    /* ---------------- cart ---------------- */
    cartLoad: function () { try { BM._cart = JSON.parse(localStorage.getItem('ea_cart') || '[]') || []; } catch (_) { BM._cart = []; } },
    cartSave: function () { try { localStorage.setItem('ea_cart', JSON.stringify(BM._cart)); } catch (_) {} },
    addToCart: function (slug, title) {
      if (!slug) return;
      if (BM._cart.some(function (i) { return i.slug === slug; })) { BM.openCart(); BM.toast('Already in your cart.'); return; }
      BM._cart.push({ slug: slug, title: title || slug }); BM.cartSave(); BM.renderCart(); BM.openCart(); BM.toast('Added to cart.');
    },
    removeFromCart: function (slug) { BM._cart = BM._cart.filter(function (i) { return i.slug !== slug; }); BM.cartSave(); BM.renderCart(); },
    /* overlay focus management — shared by the cart drawer + lead popup */
    _lastFocus: null,
    _focusable: function (c) { return Array.prototype.slice.call(c.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function (el) { return el.offsetParent !== null; }); },
    _openOverlay: function (el, backdropId) { if (!el || el.classList.contains('open')) return; BM._lastFocus = document.activeElement; el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); if (backdropId) { var b = document.getElementById(backdropId); if (b) b.classList.add('open'); } var f = BM._focusable(el); setTimeout(function () { (f[0] || el).focus(); }, 30); },
    _closeOverlay: function (el, backdropId) { if (!el) return; var was = el.classList.contains('open'); el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); if (backdropId) { var b = document.getElementById(backdropId); if (b) b.classList.remove('open'); } if (was && BM._lastFocus && BM._lastFocus.focus) { try { BM._lastFocus.focus(); } catch (_) {} } },
    openCart: function () { BM._openOverlay(document.getElementById('cartDrawer'), 'cartBackdrop'); },
    closeCart: function () { BM._closeOverlay(document.getElementById('cartDrawer'), 'cartBackdrop'); },

    /* ---------------- lead popup ---------------- */
    popSeen: function () { try { var t = localStorage.getItem('ea_pop'); return !!(t && (Date.now() - parseInt(t, 10) < 6048e5)); } catch (_) { return false; } },
    popMark: function () { try { localStorage.setItem('ea_pop', String(Date.now())); } catch (_) {} },
    showPop: function () { if (BM.popSeen()) return; var b = document.getElementById('popBack'); if (!b) return; BM._openOverlay(b, null); BM.popMark(); },
    hidePop: function () { BM._closeOverlay(document.getElementById('popBack'), null); },
    renderCart: function () {
      var n = BM._cart.length;
      var badge = document.getElementById('cartCount'); if (badge) { badge.textContent = n; badge.style.display = n > 0 ? '' : 'none'; }
      var box = document.getElementById('cartItems');
      var sub = 0;
      if (box) {
        if (!n) { box.innerHTML = '<p class="muted" style="padding:30px 4px;text-align:center">Your cart is empty.</p>'; }
        else {
          var html = '';
          BM._cart.forEach(function (it) {
            var p = BM._prods[it.slug]; var c = (p && p.price_cents != null) ? p.price_cents : null; if (c != null) sub += c;
            html += '<div class="cart-item"><div style="flex:1;min-width:0"><div class="ci-t">' + BM.esc(it.title || it.slug) + '</div><div class="ci-p">' + (c != null ? BM.fmt(c) : '—') + '</div></div><button class="ci-x" data-cart-remove="' + BM.esc(it.slug) + '" aria-label="Remove">×</button></div>';
          });
          box.innerHTML = html;
        }
      }
      var st = document.getElementById('cartSubtotal'); if (st) st.textContent = BM.fmt(sub);
      var co = document.getElementById('cartCheckout'); if (co) co.disabled = !n;
    },
    checkoutCart: function () {
      if (!BM._cart.length) return;
      if (!CFG.FUNCTIONS_BASE) { BM.toast('Payments switch on soon.'); return; }
      var btn = document.getElementById('cartCheckout'); if (btn) { btn.disabled = true; btn.textContent = 'Starting checkout...'; }
      fetch(CFG.FUNCTIONS_BASE + '/ea-create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: BM._cart.map(function (i) { return i.slug; }) })
      }).then(function (r) { return r.status === 503 ? null : r.json(); })
        .then(function (d) {
          if (d && d.url) { location.href = d.url; }
          else { BM.toast('Could not start checkout. Try again.'); if (btn) { btn.disabled = false; btn.innerHTML = 'Checkout Securely <span class="arr">&rarr;</span>'; } }
        }).catch(function () { BM.toast('Payments turn on soon.'); if (btn) { btn.disabled = false; btn.innerHTML = 'Checkout Securely <span class="arr">&rarr;</span>'; } });
    },

    subscribe: function (e, source) {
      e.preventDefault();
      var form = e.target;
      var email = (form.email && form.email.value || '').trim();
      if (!email) return false;
      var done = function (msg) { BM.toast(msg || 'You’re in. <b>Check your inbox.</b>'); form.reset(); BM.popMark(); BM.hidePop(); };
      var soft = function () { BM.toast('Hmm, that didn’t go through. <b>Try again in a sec.</b>'); };
      if (!CFG.FUNCTIONS_BASE) { done('Got it. <b>You’re on the list.</b>'); return false; }
      fetch(CFG.FUNCTIONS_BASE + '/ea-subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, source: source || 'site' })
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.ok) { done(); } else { soft(); } })
        .catch(soft);
      return false;
    },
    getEbook: function (e) {
      e.preventDefault();
      var form = e.target;
      var email = (form.querySelector('input[type=email]') || {}).value;
      email = (email || '').trim().toLowerCase();
      if (!email || email.indexOf('@') < 1) { BM.toast('Enter a valid email.'); return false; }
      // capture the lead so it is never lost, even if signup is not completed
      try {
        fetch(CFG.FUNCTIONS_BASE + '/ea-subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, source: 'ebook-popup', lead_magnet: 'ai-playbook' })
        }).catch(function () {});
      } catch (_) {}
      BM.popMark(); BM.hidePop();
      // hand off to the real signup flow; the Playbook is waiting in their library
      location.href = '/login/?email=' + encodeURIComponent(email);
      return false;
    },
    waitlist: function (e) {
      e.preventDefault();
      var email = (e.target.email && e.target.email.value || '').trim();
      if (!email) return false;
      var done = function () { BM.toast('You are on the list. <b>I will tell you first.</b>'); e.target.reset(); };
      var fallback = function () {
        if (CFG.WAITLIST_FALLBACK) {
          fetch(CFG.WAITLIST_FALLBACK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, _subject: 'Taylormade Academy waitlist signup' }) }).then(done, done);
        } else { done(); }
      };
      try {
        if (CFG.SUPABASE_URL && CFG.SUPABASE_KEY) {
          fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/ea_join_waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': CFG.SUPABASE_KEY, 'Authorization': 'Bearer ' + CFG.SUPABASE_KEY },
            body: JSON.stringify({ p_email: email })
          }).then(function (r) { if (r.ok) done(); else fallback(); }, fallback);
        } else { fallback(); }
      } catch (_) { fallback(); }
      return false;
    }
  };
  window.BM = BM;
  BM.cartLoad();

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-buy]'); if (b) { ev.preventDefault(); BM.buy(b.getAttribute('data-buy')); return; }
    var ac = ev.target.closest('[data-add-cart]'); if (ac) { ev.preventDefault(); BM.addToCart(ac.getAttribute('data-add-cart'), ac.getAttribute('data-title')); return; }
    var oc = ev.target.closest('[data-open-cart]'); if (oc) { ev.preventDefault(); BM.openCart(); return; }
    var cl = ev.target.closest('[data-close-cart]'); if (cl) { ev.preventDefault(); BM.closeCart(); return; }
    var rm = ev.target.closest('[data-cart-remove]'); if (rm) { ev.preventDefault(); BM.removeFromCart(rm.getAttribute('data-cart-remove')); return; }
    var co = ev.target.closest('[data-checkout-cart]'); if (co) { ev.preventDefault(); BM.checkoutCart(); return; }
    var pc = ev.target.closest('[data-pop-close]'); if (pc) { ev.preventDefault(); BM.hidePop(); return; }
    var ge = ev.target.closest('[data-get-ebook]'); if (ge) { ev.preventDefault(); BM._openOverlay(document.getElementById('popBack'), null); return; }
    if (ev.target.id === 'popBack') { BM.hidePop(); return; }
  });

  // Escape closes the open overlay; Tab is trapped inside it.
  document.addEventListener('keydown', function (e) {
    var pop = document.getElementById('popBack'), cart = document.getElementById('cartDrawer');
    var open = (pop && pop.classList.contains('open')) ? pop : ((cart && cart.classList.contains('open')) ? cart : null);
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); if (open === pop) { BM.hidePop(); } else { BM.closeCart(); } return; }
    if (e.key === 'Tab') {
      var f = BM._focusable(open); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  // Fill prices from the database (single source of truth, always matches checkout)
  // and cache the catalog for the cart.
  function fillPrices() {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) { BM.renderCart(); return; }
    fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/ea_list_products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': CFG.SUPABASE_KEY, 'Authorization': 'Bearer ' + CFG.SUPABASE_KEY },
      body: '{}'
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      var map = {};
      (list || []).forEach(function (p) { map[p.slug] = p; });
      BM._prods = map;
      document.querySelectorAll('[data-price]').forEach(function (el) {
        var slug = el.getAttribute('data-price'); if (!slug) return;
        var p = map[slug]; if (!p || p.price_cents == null) return;
        var d = p.price_cents / 100;
        var s = (p.price_cents % 100 === 0) ? ('$' + d) : ('$' + d.toFixed(2));
        if (p.billing === 'recurring') s += '/mo';
        el.textContent = s;
      });
      BM.renderCart();
    }).catch(function () { BM.renderCart(); });
  }
  fillPrices();

  // store category filter
  var sf = document.getElementById('storeFilter');
  if (sf) {
    sf.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      var cat = b.getAttribute('data-cat');
      sf.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('active', x === b); });
      document.querySelectorAll('#storeGrid [data-cat]').forEach(function (c) { c.style.display = (cat === 'all' || c.getAttribute('data-cat') === cat) ? '' : 'none'; });
    });
  }

  // newsletter lead popup: timed + desktop exit-intent, once per visitor (7 days)
  if (document.getElementById('popBack') && !BM.popSeen()) {
    setTimeout(BM.showPop, 9000);
    var exitPop = function (e) { if (e.clientY <= 0) { BM.showPop(); document.removeEventListener('mouseout', exitPop); } };
    document.addEventListener('mouseout', exitPop);
  }
})();
