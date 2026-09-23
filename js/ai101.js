/* /ai101/ — the free AI 101 sign-up. A seat is a $0 tier on the ea_events row with
   workshop_slug 'ai101', claimed through ea-ticket-checkout, the same path the paid workshop
   uses: the server re-checks the tier, the window and the event, issues the seat and sends the
   email with the room link. This page only reads the public views to find that tier. */
(function () {
  var CFG = window.BM_CONFIG || {};
  var SLUG = 'ai101';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var HELP = '<a href="mailto:hello@taylormadecreative.net">hello@taylormadecreative.net</a>';
  var forms = [document.getElementById('a1Form'), document.getElementById('a1Form2')].filter(Boolean);
  if (!forms.length) return;

  function rest(path) {
    return fetch(CFG.SUPABASE_URL + '/rest/v1/' + path, { headers: { apikey: CFG.SUPABASE_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_KEY } })
      .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }

  /* the seat: the next ai101 date on sale, and its free tier */
  var seat = null, over = false;
  var ready = !CFG.SUPABASE_URL ? Promise.resolve() : Promise.all([
    rest('ea_events_public?select=*&workshop_slug=eq.' + SLUG + '&order=starts_at.asc'),
    rest('ea_tiers_public?select=*&price_cents=eq.0&order=sort.asc')
  ]).then(function (res) {
    var now = Date.now();
    var events = (res[0] || []).filter(function (e) { return e.status === 'on_sale' || e.status === 'sold_out'; });
    var next = events.filter(function (e) { return Date.parse(e.ends_at || e.starts_at) + 15 * 60e3 > now; })[0];
    if (!next && events.length) over = true;
    if (next) {
      var tier = (res[1] || []).filter(function (t) { return t.event_id === next.id; })[0];
      if (tier) seat = { event: next, tier: tier };
    }
    if (over) forms.forEach(function (f) { closed(f.closest('.ag-form')); });
  });

  function closed(box) {
    box.querySelector('.ag-done').innerHTML =
      '<h3>This class already happened.</h3>' +
      '<p>Academy members can watch the replay. The next step, Build Your First AI Agent, is open for seats now.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn gold" href="/ai101/replay/">Watch the replay <span class="arr">&rarr;</span></a>' +
      '<a class="btn ghost" href="/agent/">See the agent workshop</a></div>';
    box.classList.add('is-done');
  }

  function done(box, name, email, existing) {
    var first = name.split(/\s+/)[0];
    first = first.charAt(0).toUpperCase() + first.slice(1);
    var next = '/login/?mode=join&next=' + encodeURIComponent('/ai101/');
    box.querySelector('.ag-done').innerHTML =
      '<h3>' + esc(first) + ', ' + (existing ? 'you already have a seat.' : 'you are in.') + '</h3>' +
      '<p>' + (existing ? 'Your room link went to <b>' + esc(email) + '</b> when you first signed up. Check your inbox (and spam) for “You are in: AI 101”.'
                        : 'Your room link and the cheat sheet are on their way to <b>' + esc(email) + '</b>.') + '</p>' +
      '<p><b>One last step:</b> make your free Academy account now, with the same email. Then on the night you just click the link and walk in.</p>' +
      '<a class="btn gold" href="' + next + '">Make my free account <span class="arr">&rarr;</span></a>';
    box.classList.add('is-done');
    try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
  }

  forms.forEach(function (form) {
    var box = form.closest('.ag-form');
    var err = box.querySelector('.err');
    var btn = form.querySelector('button[type=submit]');
    var label = btn.innerHTML;
    function fail(msg) { err.innerHTML = msg; err.classList.add('show'); btn.disabled = false; btn.innerHTML = label; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.classList.remove('show');
      var f = form.elements;
      if (f.website && f.website.value) return;             /* the honeypot: a bot, say nothing */
      var name = (f.name.value || '').trim(), email = (f.email.value || '').trim().toLowerCase();
      if (name.length < 2) return fail('Add your name so I know who the seat is for.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('That email does not look right. Check it and try again.');
      btn.disabled = true; btn.textContent = 'Saving your seat...';
      ready.then(function () {
        if (over) { closed(box); return; }
        if (!seat) return fail('Sign-up is not open yet. Try again soon, or email ' + HELP + ' and I will save your seat by hand.');
        return fetch(CFG.FUNCTIONS_BASE + '/ea-ticket-checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier_id: seat.tier.id, email: email, name: name, qty: 1 })
        })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (d) {
            if (d && d.done) {
              done(box, name, email, !!d.existing);
              try { if (window.fbq) window.fbq('track', 'CompleteRegistration', { content_name: 'ai101' }); } catch (_) {}
              return;
            }
            var m = { sold_out: 'The room is full. Email ' + HELP + ' and I will tell you about the next one.',
                      sales_closed: 'Sign-up for this class has closed.',
                      not_open_yet: 'Sign-up is not open yet. Try again soon.',
                      not_on_sale: 'Sign-up is not open yet. Try again soon.',
                      rate_limited: 'Too many tries from this connection. Give it a minute.',
                      email_invalid: 'That email does not look right. Check it and try again.',
                      name_required: 'Add your name so I know who the seat is for.' }[d && d.error];
            fail(m || 'That did not go through. Try once more, or email ' + HELP + ' and I will save your seat by hand.');
          });
      }).catch(function () { fail('No connection right now. Try again in a moment.'); });
    });
  });

  /* the letter's button sends people back to the top sheet and puts the cursor in it */
  document.querySelectorAll('[data-scroll-form]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var box = document.querySelector('.ag-sheet .ag-form');
      if (!box) return;
      var target = box.classList.contains('is-done') ? box : (document.getElementById('a1Form-name') || box);
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target.focus) setTimeout(function () { target.focus({ preventScroll: true }); }, 420);
    });
  });
})();
