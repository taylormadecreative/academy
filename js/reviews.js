/* js/reviews.js — fills every <section data-reviews="slug"> with that workshop's APPROVED reviews from the public
   function ea_reviews_public (0059). One POST to PostgREST, no supabase-js. Every review field goes in with
   textContent, never innerHTML. The section stays hidden when there are none, or if anything fails. */
(function () {
  var CFG = window.BM_CONFIG || {};
  var strips = document.querySelectorAll('section[data-reviews]');
  if (!strips.length || !CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) return;
  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
  function stars(n) { n = Math.max(1, Math.min(5, n | 0)); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  strips.forEach(function (sec) {
    fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/ea_reviews_public', {
      method: 'POST',
      headers: { apikey: CFG.SUPABASE_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: sec.getAttribute('data-reviews') })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.count || !d.items || !d.items.length) return;
      var list = sec.querySelector('.rv-list'), avg = sec.querySelector('.rv-avg');
      var verified = sec.getAttribute('data-verified') || 'Verified attendee';
      if (d.avg != null) { avg.textContent = d.avg + ' out of 5 · ' + d.count + ' reviews'; avg.hidden = false; }
      d.items.forEach(function (it) {
        var card = el('figure', 'rv-card'), s = el('div', 'rv-stars', stars(it.stars));
        s.setAttribute('role', 'img'); s.setAttribute('aria-label', (it.stars | 0) + ' out of 5 stars');
        var cap = el('figcaption', 'rv-who'); cap.appendChild(el('b', null, it.display_name));
        if (it.who_line) cap.appendChild(el('span', null, it.who_line));
        if (it.verified) cap.appendChild(el('span', 'rv-ver', verified));
        card.appendChild(s); card.appendChild(el('blockquote', 'rv-body', it.body)); card.appendChild(cap);
        list.appendChild(card);
      });
      sec.hidden = false;
    }).catch(function () { /* a bonus, never a breakage: the strip just stays hidden */ });
  });
})();
