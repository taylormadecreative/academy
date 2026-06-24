/* BUILD MODE site behaviors. Vanilla JS, no build step. */
(function () {
  var CFG = window.BM_CONFIG || {};
  var BM = {
    _t: null,
    toast: function (msg, ms) {
      var t = document.getElementById('toast'); if (!t) return;
      t.innerHTML = msg; t.classList.add('show');
      clearTimeout(BM._t); BM._t = setTimeout(function () { t.classList.remove('show'); }, ms || 3600);
    },
    buy: function (slug) {
      if (!CFG.FUNCTIONS_BASE) {
        BM.toast('The store is live, payments switch on this week. <b>Drop your email on the home page to get told first.</b>');
        return;
      }
      fetch(CFG.FUNCTIONS_BASE + '/ea-create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: slug })
      }).then(function (r) {
        if (r.status === 503) { BM.toast('Payments are not switched on yet. <b>Check back very soon.</b>'); return null; }
        return r.json();
      }).then(function (d) {
        if (d && d.url) { location.href = d.url; }
        else if (d) { BM.toast('Could not start checkout. Try again in a minute.'); }
      }).catch(function () { BM.toast('Payments turn on soon. <b>Hang tight.</b>'); });
    },
    waitlist: function (e) {
      e.preventDefault();
      var email = (e.target.email && e.target.email.value || '').trim();
      if (!email) return false;
      var done = function () { BM.toast('You are on the list. <b>I will tell you first.</b>'); e.target.reset(); };
      var fallback = function () {
        if (CFG.WAITLIST_FALLBACK) {
          fetch(CFG.WAITLIST_FALLBACK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, _subject: 'BUILD MODE waitlist signup' }) }).then(done, done);
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

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-buy]');
    if (b) { ev.preventDefault(); BM.buy(b.getAttribute('data-buy')); }
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }
})();
