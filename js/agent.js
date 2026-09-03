/* /agent/ — waitlist, upcoming dates, and seat sales for Build Your First AI Agent.
   Reads only public views (ea_events_public, ea_tiers_public) with the publishable key;
   writes go through the edge functions, which validate everything server-side. */
(function () {
  var CFG = window.BM_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var money = function (c) { var d = c / 100; return c % 100 === 0 ? '$' + d : '$' + d.toFixed(2); };
  var params = new URLSearchParams(location.search);
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Shape only. The server re-checks the token against the waitlist at checkout, so this
  // decides whether to SHOW the waitlist rate, never whether it is honoured.
  var EARLY = UUID.test(params.get('early') || '') ? params.get('early') : '';

  function when(iso, tz) {
    try {
      var d = new Date(iso);
      var date = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric' }).format(d);
      var time = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/Chicago', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d);
      return date + ' at ' + time;
    } catch (_) { return ''; }
  }
  function cal(iso, tz) {
    try {
      var d = new Date(iso);
      return { m: new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/Chicago', month: 'short' }).format(d).toUpperCase(),
               d: new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/Chicago', day: 'numeric' }).format(d) };
    } catch (_) { return { m: '', d: '' }; }
  }
  function rest(path) {
    return fetch(CFG.SUPABASE_URL + '/rest/v1/' + path, { headers: { apikey: CFG.SUPABASE_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_KEY } })
      .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }

  /* ---------------- waitlist forms (hero + closing band) ---------------- */
  function wireWaitlist(form) {
    if (!form) return;
    var box = form.closest('.ag-form');
    var err = box.querySelector('.err');
    var btn = form.querySelector('button[type=submit]');
    var label = btn ? btn.innerHTML : '';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.classList.remove('show');
      var f = form.elements;
      var name = (f.name.value || '').trim(), email = (f.email.value || '').trim().toLowerCase();
      if (name.length < 2) { return fail('Add your name so I know who to save the seat for.'); }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { return fail('That email does not look right. Check it and try again.'); }
      var exp = form.querySelector('input[name=experience]:checked');
      var body = {
        name: name, email: email,
        phone: f.phone ? (f.phone.value || '').trim() : '',
        goal: f.goal ? (f.goal.value || '').trim() : '',
        experience: exp ? exp.value : 'new',
        source: form.getAttribute('data-source') || 'agent-page',
        ref: document.referrer ? document.referrer.slice(0, 300) : '',
        hp: f.website ? f.website.value : ''
      };
      btn.disabled = true; btn.textContent = 'Saving your spot...';
      fetch(CFG.FUNCTIONS_BASE + '/ea-waitlist-join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok || !res.d || !res.d.ok) {
            var code = res.d && res.d.error;
            return fail(code === 'rate_limited' ? 'Too many tries from this connection. Give it a minute.' : 'That did not go through. Try once more, or email <a href="mailto:hello@taylormadecreative.net">hello@taylormadecreative.net</a> and I will add you by hand.');
          }
          done(box, res.d, name, email);
          try { if (window.fbq) window.fbq('track', 'Lead', { content_name: 'agent-waitlist' }); } catch (_) {}
        })
        .catch(function () { fail('No connection right now. Try again in a moment.'); });
      function fail(msg) { err.innerHTML = msg; err.classList.add('show'); btn.disabled = false; btn.innerHTML = label; }
    });
  }
  function done(box, d, name, email) {
    var first = name.split(/\s+/)[0];
    first = first.charAt(0).toUpperCase() + first.slice(1);
    var pos = d.position ? '#' + d.position : '';
    var el = box.querySelector('.ag-done');
    el.innerHTML =
      (pos ? '<div class="n">' + esc(pos) + '<small>on the list</small></div>' : '') +
      '<h3>' + esc(first) + ', ' + (d.existing ? 'you were already on the list.' : 'you are on the list.') + '</h3>' +
      '<p>' + (d.existing ? 'Your place and your early-bird link have not changed. ' : 'A confirmation just went to <b>' + esc(email) + '</b>. ') +
      'When the date is set you hear first, with a personal link that opens the waitlist rate before the public sale.</p>' +
      '<a class="btn gold" href="/login/?mode=join">Join the Academy free while you wait <span class="arr">&rarr;</span></a>';
    box.classList.add('is-done');
    try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
  }
  // the letter's CTA sends people back to the sheet and puts the cursor in it
  document.querySelectorAll('[data-scroll-form]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var box = document.querySelector('.ag-sheet .ag-form');
      if (!box) return;
      var target = box.classList.contains('is-done') ? box : (document.getElementById('wlForm-name') || box);
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target.focus) setTimeout(function () { target.focus({ preventScroll: true }); }, 420);
    });
  });

  wireWaitlist($('wlForm'));
  wireWaitlist($('wlForm2'));

  /* ---------------- upcoming dates + seats ---------------- */
  var datesBox = $('datesList'), seatsSec = $('seats'), tiersBox = $('tiers'), heroCta = $('heroCta');
  if (!datesBox || !CFG.SUPABASE_URL) return;

  Promise.all([
    rest('ea_events_public?select=*&order=starts_at.asc'),
    rest('ea_tiers_public?select=*&order=sort.asc,price_cents.asc')
  ]).then(function (res) {
    var events = res[0] || [], tiers = res[1] || [];
    renderDates(events);
    renderSeats(events, tiers);
  });

  function renderDates(events) {
    var upcoming = events.filter(function (e) { return new Date(e.starts_at).getTime() > Date.now() - 3 * 3600e3; });
    if (!upcoming.length) return; // the static "no date yet" copy stays
    $('datesEmpty').style.display = 'none';
    datesBox.innerHTML = upcoming.map(function (e) {
      var c = cal(e.starts_at, e.tz);
      var st = e.status === 'on_sale' ? '<a class="st on" href="#seats">Seats on sale</a>'
             : e.status === 'sold_out' ? '<span class="st">Sold out</span>'
             : '<span class="st">The list hears first</span>';
      return '<div class="ag-date"><div class="cal"><span class="m">' + esc(c.m) + '</span><span class="d">' + esc(c.d) + '</span></div>' +
        '<div><h3>' + esc(e.title) + '</h3><p>' + esc(when(e.starts_at, e.tz)) + (e.venue_label ? ' &middot; ' + esc(e.venue_label) : (e.format === 'virtual' ? ' &middot; Online' : '')) + (e.blurb ? '<br>' + esc(e.blurb) : '') + '</p></div>' + st + '</div>';
    }).join('');
    datesBox.style.display = '';
  }

  function renderSeats(events, tiers) {
    var onSale = events.filter(function (e) { return e.status === 'on_sale' || e.status === 'sold_out'; });
    if (!onSale.length || !tiers.length) return;
    seatsSec.hidden = false;
    if (heroCta) { heroCta.href = '#seats'; heroCta.innerHTML = 'Get your seat <span class="arr">&rarr;</span>'; }
    var byEvent = {};
    tiers.forEach(function (t) { (byEvent[t.event_id] = byEvent[t.event_id] || []).push(t); });
    var now = Date.now();
    tiersBox.innerHTML = onSale.map(function (e) {
      var list = byEvent[e.id] || [];
      if (!list.length) return '';
      return '<div class="ag-event-head" style="grid-column:1/-1"><h3 class="display-m" style="margin-top:6px">' + esc(e.title) + '</h3><p class="muted" style="margin-top:6px">' + esc(when(e.starts_at, e.tz)) + (e.venue_label ? ' &middot; ' + esc(e.venue_label) : '') + '</p></div>' +
        list.map(function (t) { return tierCard(t, e, now); }).join('');
    }).join('');
    var early = $('earlyNote');
    if (EARLY && early) { early.classList.add('show'); }
    tiersBox.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = tiers.filter(function (x) { return x.id === b.getAttribute('data-buy'); })[0];
        var e = onSale.filter(function (x) { return x.id === t.event_id; })[0];
        openBuy(t, e);
      });
    });
  }

  function tierCard(t, e, now) {
    var left = Math.max(0, t.qty - t.sold);
    var notOpen = t.sales_start && now < Date.parse(t.sales_start);
    var closed = t.sales_end && now > Date.parse(t.sales_end);
    var locked = t.access === 'waitlist' && !EARLY;
    var av = left === 0 ? 'Sold out' : left <= 3 ? 'Only ' + left + ' left' : left + ' seats left';
    var cta;
    if (locked) cta = '<p class="lockline">This rate opens through the link in your waitlist email.</p>';
    else if (notOpen) cta = '<p class="lockline">Opens ' + esc(when(t.sales_start, e.tz)) + '</p>';
    else if (closed || left === 0 || e.status === 'sold_out') cta = '<button class="btn ghost" disabled>' + (left === 0 || e.status === 'sold_out' ? 'Sold out' : 'Sales closed') + '</button>';
    else cta = '<button class="btn gold" data-buy="' + esc(t.id) + '">Get this seat <span class="arr">&rarr;</span></button>';
    return '<div class="ag-tier' + (locked ? ' locked' : '') + '"><div class="nm">' + esc(t.name) + '</div><div class="pr">' + (t.price_cents === 0 ? 'Free' : money(t.price_cents)) + '</div>' +
      (t.description ? '<p class="ds">' + esc(t.description) + '</p>' : '<p class="ds"></p>') +
      '<div class="av' + (left > 0 && left <= 3 ? ' low' : '') + '">' + esc(av) + '</div>' + cta + '</div>';
  }

  /* ---------------- buy dialog ---------------- */
  var dlg = $('buyDlg');
  function openBuy(t, e) {
    if (!dlg) return;
    var qty = 1, max = Math.min(4, Math.max(1, t.qty - t.sold));
    $('bdTitle').textContent = t.name + ' · ' + (t.price_cents === 0 ? 'Free' : money(t.price_cents));
    $('bdSub').textContent = e.title + '. ' + when(e.starts_at, e.tz) + '.';
    var out = $('bdQty'), tot = $('bdTot'), err = $('bdErr');
    function paint() { out.value = qty; tot.innerHTML = 'Total <b>' + (t.price_cents === 0 ? 'Free' : money(t.price_cents * qty)) + '</b>' + (qty > 1 ? ' for ' + qty + ' seats' : ''); }
    $('bdMinus').onclick = function () { qty = Math.max(1, qty - 1); paint(); };
    $('bdPlus').onclick = function () { qty = Math.min(max, qty + 1); paint(); };
    paint(); err.classList.remove('show');
    var form = $('bdForm'), btn = $('bdGo'), label = btn.innerHTML;
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var name = (form.elements.name.value || '').trim(), email = (form.elements.email.value || '').trim().toLowerCase();
      if (name.length < 2) return show('Add the name for the seat.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return show('That email does not look right.');
      btn.disabled = true; btn.textContent = 'Opening secure checkout...';
      fetch(CFG.FUNCTIONS_BASE + '/ea-ticket-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier_id: t.id, email: email, name: name, qty: qty, early: EARLY }) })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          var d = res.d || {};
          if (d.url) { location.href = d.url; return; }
          if (d.done) { location.href = '/agent/thanks/?free=1&codes=' + encodeURIComponent((d.codes || []).join(',')); return; }
          var m = { sold_out: 'That seat just sold out. Pick another tier or join the waitlist for the next date.',
                    waitlist_only: 'This rate is for the waitlist. Use the link in your waitlist email.',
                    not_open_yet: 'This tier is not open yet.', sales_closed: 'Sales for this tier have closed.',
                    payments_not_configured: 'Checkout is turning on. Try again in a few minutes.',
                    rate_limited: 'Too many tries from this connection. Give it a minute.' }[d.error];
          show(m || 'Could not start checkout. Try again in a minute.');
        })
        .catch(function () { show('No connection right now. Try again in a moment.'); });
      function show(msg) { err.textContent = msg; err.classList.add('show'); btn.disabled = false; btn.innerHTML = label; }
    };
    $('bdClose').onclick = function () { dlg.close(); };
    dlg.showModal();
  }
})();
