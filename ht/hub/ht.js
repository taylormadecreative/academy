/* The HT Hub — Huston-Tillotson × Taylormade Academy. Shared runtime.
   Renders a space from window.HT (see docs/superpowers/specs/ht-hub-schema.md), then tries to greet a signed-in Academy member.
   Everything renders for everyone (preview with sample content); auth is additive, never blocking. */
(function () {
  'use strict';
  var HT = window.HT || (window.HT = {});
  var LS = function (k) { return 'ht:' + k; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function h(strings) { var out = strings[0]; for (var i = 1; i < arguments.length; i++) out += esc(arguments[i]) + strings[i]; return out; }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function initials(name) { return String(name || '').replace(/\(.*?\)/g, '').split(/[\s&·]+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || 'HT'; }
  function store() { try { return window.sessionStorage || null; } catch (e) { return null; } }
  function get(k, d) { try { var st = store(); if (!st) return d; var v = st.getItem(LS(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function set(k, v) { try { var st = store(); if (st) st.setItem(LS(k), JSON.stringify(v)); } catch (e) {} }
  function clearDemo() { [window.sessionStorage, window.localStorage].forEach(function (st) { try { Object.keys(st).filter(function (k) { return k.indexOf('ht:') === 0; }).forEach(function (k) { st.removeItem(k); }); } catch (e) {} }); }

  var ICONS = {
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0"/><path d="M12 17v5M8 22h8"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>',
    door: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v18H5V3z"/><path d="M14 8h5v13"/><circle cx="11" cy="12" r="1"/></svg>',
    hands: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.4-9.3-8.6C.9 9 3 5 6.5 5c2 0 3.3 1 4.1 2.1C11.4 6 12.7 5 14.7 5 18.2 5 20.3 9 18.5 12.4 16.2 16.6 12 21 12 21z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>',
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8.5l3.5 3.5 7-8"/></svg>'
  };
  Object.keys(ICONS).forEach(function (k) { ICONS[k] = ICONS[k].replace('<svg', '<svg aria-hidden="true" focusable="false"'); });
  function icon(n) { return ICONS[n] || ICONS.star; }

  /* ---------- block renderers ---------- */
  function card(b, inner, cls) {
    var head = (b.title || b.meta) ? '<div class="hd">' + (b.title ? h`<h2>${b.title}</h2>` : '<span></span>') + (b.meta ? h`<span class="m">${b.meta}</span>` : '') + '</div>' : '';
    return '<section class="hc rv ' + (cls || '') + '"' + (b.id ? h` id="${b.id}"` : '') + '>' + head + '<div class="bd">' + inner + '</div></section>';
  }
  function chipHtml(t, cls) { return t ? h`<span class="chip ${cls || ''}">${t}</span>` : ''; }
  function btn(c) { if (!c) return ''; return h`<a class="btn ${c.style || 'ht'}" href="${c.href}">${c.label}</a>`; }

  var R = {};
  R.intro = function (b) {
    var art = '';
    if (b.video) {
      var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      art = h`<div class="art"><video muted loop playsinline ${still ? '' : 'autoplay'} preload="none" poster="${b.poster || ''}" aria-label="${b.imageAlt || 'A short looping portrait'}"><source src="${b.video}" type="video/mp4"></video>` +
        '<button type="button" class="pill ghost" data-vtoggle aria-pressed="' + (!still) + '" style="position:absolute;left:12px;bottom:12px;background:rgba(255,255,255,.92)">' + (still ? 'Play' : 'Pause') + '</button></div>';
    }
    else if (b.image) art = h`<div class="art"><img src="${b.image}" alt="${b.imageAlt || ''}" loading="eager" decoding="async"></div>`;
    var ada = b.ada ? '<div class="ada" style="margin-top:18px">' + h`<img src="${HT.site.adaPoster}" alt="Ada, the HT student ambassador"><div><b>Ada says</b><p>${b.ada.text}</p>` + (b.ada.when ? h`<div class="w">${b.ada.when}</div>` : '') + '</div></div>' : '';
    return '<section class="intro rv' + (art ? '' : ' plain') + '"' + (b.id ? h` id="${b.id}"` : '') + '><div>' +
      (b.kicker ? h`<div class="k">${b.kicker}</div>` : '') + h`<h2>${b.title}</h2>` + (b.text ? h`<p>${b.text}</p>` : '') +
      (b.ctas && b.ctas.length ? '<div class="ctas">' + b.ctas.map(btn).join('') + '</div>' : '') + ada + '</div>' + art + '</section>';
  };
  R.ada = function (b) { return '<section class="ada rv"' + (b.id ? h` id="${b.id}"` : '') + '>' + h`<img src="${HT.site.adaPoster}" alt="Ada, the HT student ambassador"><div><b>${b.label || 'Ada says'}</b><p>${b.text}</p>` + (b.when ? h`<div class="w">${b.when}</div>` : '') + '</div></section>'; };
  R.stats = function (b) { return '<section class="stats rv"' + (b.id ? h` id="${b.id}"` : '') + '>' + b.items.map(function (s) { return h`<div class="stat"><b>${s.n}</b><span>${s.label}</span></div>`; }).join('') + '</section>'; };
  R.cards = function (b) {
    var inner = '<div class="cards">' + b.items.map(function (c) {
      var tag = c.href ? 'a' : 'div';
      return '<' + tag + ' class="card"' + (c.href ? h` href="${c.href}"` : '') + '>' + (c.img ? h`<div class="img"><img src="${c.img}" alt="${c.href ? '' : (c.alt || '')}" loading="lazy" decoding="async"></div>` : '') +
        '<div class="cb">' + (c.meta ? h`<div class="meta">${c.meta}</div>` : '') + h`<h3>${c.title}</h3>` + (c.text ? h`<p>${c.text}</p>` : '') +
        (c.badge ? chipHtml(c.badge, c.badgeCls || 'sample') : '') + (c.foot ? h`<div class="foot">${c.foot}</div>` : '') + '</div></' + tag + '>';
    }).join('') + '</div>';
    return card(b, inner);
  };
  R.spaces = function (b) {
    var inner = '<div class="spaces">' + HT.order.map(function (k, i) {
      var s = HT.spaces[k]; if (!s) return '';
      return h`<a class="space${i === 0 ? ' first' : ''}" href="${HT.site.hub + k + '/'}"><span class="ic">` + icon(s.icon) + h`</span><span><em>${s.office}</em><b>${s.title}</b><span>${s.blurb}</span></span></a>`;
    }).join('') + '</div>';
    return card(b, inner);
  };
  R.agenda = function (b) {
    var head = b.event ? '<div class="evt-head">' + h`<b>${b.event.name}</b>` + (b.event.dates ? h`<span>${b.event.dates}</span>` : '') + (b.event.place ? h`<span>${b.event.place}</span>` : '') + (b.event.note ? chipHtml(b.event.note, 'sample') : '') + '</div>' : '';
    var days = (b.days || []).map(function (d) {
      return '<div class="day">' + h`<h3>${d.label}</h3>` + d.items.map(function (it) {
        return '<div class="ag">' + h`<div class="t">${it.time}</div><div class="b"><b>${it.title}</b>` + ((it.where || it.who) ? h`<span>${[it.where, it.who].filter(Boolean).join(' · ')}</span>` : '') + '</div>' + (it.tag ? '<div class="tag">' + chipHtml(it.tag, it.tagCls || '') + '</div>' : '') + '</div>';
      }).join('') + '</div>';
    }).join('');
    var tools = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' + (b.ics !== false ? '<button class="pill" type="button" data-ics="' + esc(b.id || '') + '">' + ICONS.calendar.replace('viewBox', 'width="14" height="14" viewBox') + ' Add to calendar</button>' : '') + '<button class="pill ghost" type="button" data-print>Print the agenda</button></div>';
    var node = card(b, head + days + tools);
    return node;
  };
  R.people = function (b) {
    var inner = b.items.map(function (p) {
      return '<div class="person">' + h`<span class="av${p.gold ? ' g' : ''}">${p.init || initials(p.name)}</span><div><b>${p.name}</b><span>${[p.role, p.org].filter(Boolean).join(' · ')}</span></div>` +
        '<div class="act">' + (p.tag ? chipHtml(p.tag, p.tagCls || 'soft') : '') + (b.dm ? '<button class="pill ghost" type="button" data-dm="' + esc(p.name) + '" aria-label="Message ' + esc(p.name) + '">Message</button>' : '') + '</div></div>';
    }).join('');
    return card(b, inner);
  };
  R.directory = function (b) {
    var rows = b.items.map(function (p) {
      return '<div class="person" data-q="' + esc((p.name + ' ' + p.program + ' ' + (p.skills || []).join(' ') + ' ' + (p.year || '')).toLowerCase()) + '">' + h`<span class="av">${initials(p.name)}</span><div><b>${p.name}</b><span>${[p.program, p.year].filter(Boolean).join(' · ')}` + (p.skills && p.skills.length ? h` · ${p.skills.join(', ')}` : '') + '</span></div><div class="act">' + (p.tag ? chipHtml(p.tag, p.tagCls || 'soft') : '') + (p.href ? h`<a class="pill ghost" href="${p.href}">Portfolio</a>` : '') + '</div></div>';
    }).join('');
    var lid = 'dir-' + (b.id || 'list');
    var inner = (b.search !== false ? '<div class="search"><input type="search" placeholder="Search by name, program, or skill" aria-label="Search the directory" aria-controls="' + lid + '" data-search></div>' : '') +
      '<div id="' + lid + '" data-list>' + rows + '</div><div class="empty" data-none hidden role="status">No one matches that yet.</div><div data-count role="status" style="position:absolute;left:-9999px"></div>';
    return card(b, inner);
  };
  R.announcements = function (b) {
    var inner = b.items.map(function (a) {
      return '<div class="ann"><span class="dot"></span><div>' + h`<p>${a.text}</p><div class="w">${[a.who, a.when].filter(Boolean).join(' · ')}</div>` + '</div></div>';
    }).join('');
    return card(b, inner || '<div class="empty">Nothing posted yet.</div>');
  };
  R.materials = function (b) {
    var inner = b.items.map(function (m) {
      return '<div class="mat">' + h`<span class="k">${m.kind || 'DOC'}</span><div><b>${m.title}</b>` + (m.sub ? h`<span>${m.sub}</span>` : '') + '</div>' + (m.href ? h`<a class="lnk" href="${m.href}" aria-label="Open ${m.title}">Open</a>` : (m.restricted ? chipHtml('Restricted', 'soft') : '')) + '</div>';
    }).join('');
    return card(b, inner);
  };
  R.tracks = function (b) {
    var inner = b.items.map(function (t) {
      var done = (t.sessions || []).filter(function (s) { return s.done; }).length, total = (t.sessions || []).length;
      var pct = typeof t.progress === 'number' ? t.progress : (total ? Math.round(done / total * 100) : 0);
      return '<div class="track"><div class="th"><div>' + h`<h3>${t.title}</h3>` + (t.text ? h`<p>${t.text}</p>` : '') + '</div>' + (t.tag ? chipHtml(t.tag, t.tagCls || '') : '') + '</div>' +
        '<div class="prog" aria-hidden="true"><i data-w="' + pct + '"></i></div>' + h`<div class="pm"><span>${done} of ${total} sessions</span><span>${pct}%</span></div>` +
        (t.sessions || []).map(function (s) { return '<div class="sess">' + h`<span class="no${s.done ? ' done' : ''}">${s.no}</span><div><b>${s.title}</b>` + (s.date ? h`<span>${s.date}</span>` : '') + '</div><span class="st">' + (s.done ? chipHtml('Done', 'green') : (s.status ? chipHtml(s.status, 'soft') : '')) + '</span></div>'; }).join('') +
        (t.cert ? '<div class="cert"><span class="seal"><img src="/ht/img/ht-monogram-gold.png" alt=""></span><div>' + h`<b>${t.cert.title || 'Certificate of completion'}</b><span>${t.cert.text || ''}</span>` + '</div>' + chipHtml(t.cert.status || 'Sample', t.cert.cls || 'sample') + '</div>' : '') + '</div>';
    }).join('');
    return card(b, inner);
  };
  R.feed = function (b) {
    var chans = (b.channels || []).map(function (c, i) { return '<button class="pill' + (i === 0 ? ' on' : ' ghost') + '" type="button" aria-pressed="' + (i === 0) + '" data-chan="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
    var stored = get('feed:' + (b.id || b.room || 'feed'), []);
    var posts = stored.concat(b.posts).map(function (p, i) { return postHtml(p, i); }).join('');
    var inner = '<div class="chans" data-chans role="group" aria-label="Channels">' + chans + '</div><form class="composer" data-composer="' + esc(b.id || b.room || 'feed') + '"><input placeholder="Post to the channel" aria-label="Write a post" maxlength="280"><button class="btn ht sm" type="submit">Post</button></form><div data-posts>' + posts + '</div>';
    return card(b, inner);
  };
  function postHtml(p, i) {
    var n = p.likes || 0;
    return '<div class="post" data-chan="' + esc(p.chan || '') + '"><div class="ph">' + h`<span class="av">${p.init || initials(p.who)}</span><div><b>${p.who}</b><br><span>${[p.chan, p.when].filter(Boolean).join(' · ')}</span></div>` + '</div>' + h`<p>${p.text}</p>` +
      '<div class="acts"><button type="button" data-like="' + i + '" aria-pressed="false" aria-label="Like, ' + n + '"><span aria-hidden="true">♥</span> <span>' + n + '</span></button>' +
      '<button type="button" data-reply="' + esc(p.who) + '">Reply</button></div></div>';
  }
  R.chat = function (b) {
    var msgs = (b.seed || []).concat(get('chat:' + b.room, []));
    var priv = /private/i.test(b.meta || '') || /private/i.test(b.title || '');
    var ph = b.placeholder || (priv ? 'Message your host' : 'Say something to the room');
    var inner = '<div class="chat"><div class="scroll" data-scroll role="log" aria-live="polite" aria-label="Messages" tabindex="0">' + msgs.map(bub).join('') + '</div><form data-chat="' + esc(b.room) + '"><input placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '" maxlength="400"><button type="submit">Send</button></form></div>';
    var s = card(b, inner); return s.replace('<div class="bd">', '<div class="bd" style="padding:0">');
  };
  function bub(m) { return '<div class="bub' + (m.me ? ' me' : '') + '">' + h`<div class="who">${m.who}</div><p>${m.text}</p>` + (m.when ? h`<div class="w">${m.when}</div>` : '') + '</div>'; }
  R.checkin = function (b) {
    var done = get('checkin:' + b.session, false);
    var okHtml = '<div class="ok" tabindex="-1"><i>' + ICONS.check + '</i>You are checked in.<button type="button" class="pill ghost" data-uncheck style="margin-left:12px">Undo</button></div>';
    var inner = h`<p style="margin-bottom:12px"><b>${b.session}</b>` + (b.sub ? h` · ${b.sub}` : '') + '</p><div class="ci" data-checkin="' + esc(b.session) + '" data-code="' + esc(b.code) + '">' +
      (done ? okHtml : '<input placeholder="CODE" maxlength="12" aria-label="Check-in code" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done"><button class="btn ht sm" type="button">Check in</button><span class="msg" role="status" aria-live="polite" style="font-size:13px;font-weight:600"></span>') +
      (b.hint ? h`<div class="hint">${b.hint}</div>` : '') + '</div>';
    return card(b, inner);
  };
  R.replays = function (b) {
    var inner = '<div class="reps">' + b.items.map(function (r) { return '<button type="button" class="rep" data-replay="' + esc(r.title) + '">' + h`<img src="${r.poster}" alt="" loading="lazy" decoding="async">` + (r.len ? h`<span class="len">${r.len}</span>` : '') + '<div class="cap">' + h`<b>${r.title}</b><span>${[r.date, r.tag].filter(Boolean).join(' · ')}</span>` + '</div></button>'; }).join('') + '</div>';
    return card(b, inner);
  };
  R.player = function (b) {
    var now = b.now ? '<div class="nowbar">' + (b.live ? '<span class="chip live"><i></i>Live</span>' : chipHtml('Test picture · sample', 'soft')) + h`<b>${b.now.title}</b>` + (b.now.who ? h`<span>${b.now.who}</span>` : '') + (b.now.when ? h`<span>${b.now.when}</span>` : '') + '</div>' : '';
    var inner = '<div class="player" data-player data-stream="' + esc(b.stream || '/ht/img/hero-flyover.mp4') + '">' +
      '<div class="brand"><div style="display:flex;align-items:center;gap:10px"><img src="/ht/img/ht-wordmark-gold.png" alt="Huston-Tillotson University"><span class="t">' + esc(b.title || 'The live room') + '</span></div>' + (b.live ? '<span class="chip live"><i></i>Live</span>' : '') + '</div>' +
      '<div class="poster" style="background-image:url(' + esc(b.poster || '/ht/img/hero-flyover-poster.jpg') + ')"><button type="button" aria-label="Watch ' + esc(b.title || 'the live room') + '"><span aria-hidden="true">▶</span>&nbsp; Watch</button></div>' +
      '<img class="wm" src="/assets/logo-nav.webp" alt=""></div>' + now;
    var s = card({ id: b.id, title: b.cardTitle, meta: b.meta }, inner, 'dark'); return s.replace('<div class="bd">', '<div class="bd" style="padding:0">');
  };
  R.timeline = function (b) {
    var inner = '<div class="tl">' + b.items.map(function (t) { return '<div class="tli' + (t.done ? ' done' : '') + '">' + h`<em>${t.when}</em>` + (t.done ? '<span class="chip green" style="margin-left:8px;vertical-align:middle">Done</span>' : '') + h`<b>${t.title}</b>` + (t.text ? h`<p>${t.text}</p>` : '') + '</div>'; }).join('') + '</div>';
    return card(b, inner);
  };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  R.calendar = function (b) {
    var inner = b.items.map(function (c) {
      var d = c.date ? new Date(c.date + 'T12:00:00') : null;
      return '<div class="cal"><div class="d">' + (d ? h`<b>${d.getDate()}</b><span>${MON[d.getMonth()]}</span>` : h`<b>${c.day || ''}</b><span>${c.mon || ''}</span>`) + '</div><div class="b">' + h`<b>${c.title}</b>` + (c.where ? h`<span>${c.where}</span>` : '') + '</div>' + (c.tag ? '<span style="margin-left:auto">' + chipHtml(c.tag, c.tagCls || 'soft') + '</span>' : '') + '</div>';
    }).join('');
    return card(b, inner);
  };
  R.split = function (b) {
    var inner = '<div class="split' + (b.side === 'left' ? ' r' : '') + '"><div>' + (b.kicker ? h`<div class="k" style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ht-maroon);margin-bottom:8px">${b.kicker}</div>` : '') + h`<h2>${b.title}</h2>` + (b.text ? h`<p>${b.text}</p>` : '') +
      (b.bullets && b.bullets.length ? '<ul>' + b.bullets.map(function (x) { return h`<li>${x}</li>`; }).join('') + '</ul>' : '') + (b.cta ? '<div style="margin-top:16px">' + btn(b.cta) + '</div>' : '') + '</div>' +
      (b.image ? h`<div class="art"><img src="${b.image}" alt="${b.imageAlt || ''}" loading="lazy" decoding="async"></div>` : '') + '</div>';
    return card({ id: b.id, meta: b.meta }, inner);
  };
  R.steps = function (b) { return card(b, '<div class="steps">' + b.items.map(function (s) { return h`<div class="step"><em>${s.em}</em><h3>${s.h}</h3><p>${s.p}</p></div>`; }).join('') + '</div>'); };
  R.faq = function (b) { return card(b, '<div class="faq">' + b.items.map(function (q) { return h`<details><summary>${q.q}</summary><p>${q.a}</p></details>`; }).join('') + '</div>'); };
  R.notice = function (b) { return '<div class="notice rv' + (b.tone === 'maroon' ? ' maroon' : '') + '"' + (b.id ? h` id="${b.id}"` : '') + '>' + (b.html ? b.html : esc(b.text)) + '</div>'; };
  R.cta = function (b) { return '<section class="cta rv"' + (b.id ? h` id="${b.id}"` : '') + '><div>' + h`<h2>${b.title}</h2>` + (b.text ? h`<p>${b.text}</p>` : '') + '</div><div class="ctas">' + btn(b.primary) + (b.secondary ? btn(Object.assign({ style: 'ht-gold' }, b.secondary)) : '') + '</div></section>'; };
  R.table = function (b) { return card(b, '<div style="overflow-x:auto" tabindex="0" role="region" aria-label="' + esc(b.title || 'Table') + '"><table class="tbl"><thead><tr>' + b.cols.map(function (c) { return h`<th scope="col">${c}</th>`; }).join('') + '</tr></thead><tbody>' + b.rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return i === 0 ? h`<td><b>${c}</b></td>` : h`<td>${c}</td>`; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'); };
  R.install = function (b) {
    var android = /Android/i.test(navigator.userAgent || '');
    var how = android
      ? 'Open the browser menu, then tap <b>Add to Home screen</b>. It opens like an app, with its own icon.'
      : 'On an iPhone, open this page in Safari, tap Share, then <b>Add to Home Screen</b>. On Android, open the browser menu and tap <b>Add to Home screen</b>.';
    var inner = '<div class="install"><img src="/ht/img/icon-192.png" alt="" width="56" height="56"><div><b>Put the HT Hub on your phone</b><span>' + how + '</span></div></div>';
    return card({ id: b.id || 'install', title: b.title || 'The HT app', meta: b.meta || 'No app store needed' }, inner, 'sand');
  };
  R.html = function (b) { return card(b, b.html || ''); };

  /* ---------- page assembly ---------- */
  function tabsHtml(active) {
    var t = '<a class="ht-tab home' + (active === 'home' ? ' on' : '') + '"' + (active === 'home' ? ' aria-current="page"' : '') + ' href="' + HT.site.hub + '">' + ICONS.home + ' Home</a>';
    HT.order.forEach(function (k) { var s = HT.spaces[k]; if (!s) return; t += '<a class="ht-tab' + (k === active ? ' on' : '') + '"' + (k === active ? ' aria-current="page"' : '') + ' href="' + esc(HT.site.hub + k + '/') + '">' + esc(s.title) + '</a>'; });
    return t;
  }
  function render(key) {
    var space = key === 'home' ? HT.home : HT.spaces[key];
    var root = document.getElementById('htRoot'); if (!root || !space) return;
    var head = '<div class="ht-head"><div class="hub-wrap"><div>' +
      '<div class="ht-lockup"><img src="/ht/img/ht-wordmark-maroon.png" alt="Huston-Tillotson University"><span class="x" aria-hidden="true">×</span><span class="tma"><img src="/assets/logo-nav.webp" alt="">Taylormade Academy</span></div>' +
      h`<h1>${space.title === 'Home' ? 'The HT Hub' : space.title}</h1>` + (space.office ? h`<div class="kick" style="margin-top:8px">${space.office}</div>` : h`<div class="kick" style="margin-top:8px">${space.kicker || 'One campus, one hub'}</div>`) + (space.sub ? h`<p class="sub">${space.sub}</p>` : '') +
      '</div><div class="side"><span class="mono">' + esc(space.stamp || 'Preview · sample content') + '</span>' + (space.headCta ? btn(space.headCta) : '') + '</div></div></div>' +
      '<nav class="ht-tabs" aria-label="Spaces"><div class="hub-wrap">' + tabsHtml(key) + '</div></nav>';
    var main = [], side = [];
    (space.blocks || []).forEach(function (b) { var fn = R[b.type]; if (!fn) return; (b.side === true ? side : main).push(fn(b)); });
    var body = '<main class="ht-main" id="htMain" tabindex="-1"><div class="hub-wrap"><div class="ht-grid' + (side.length ? '' : ' one') + '">' + '<div class="ht-col">' + main.join('') + '</div>' + (side.length ? '<div class="ht-col">' + side.join('') + '</div>' : '') + '</div></div></main>';
    root.innerHTML = head + body;
    if (!side.length) { var g = root.querySelector('.ht-grid'); if (g) g.style.gridTemplateColumns = 'minmax(0,1fr)'; }
    wire(root, space);
    /* external links leave the hub in a new tab so the demo stays put */
    root.querySelectorAll('a[href^="http"]').forEach(function (a) { if (a.hostname !== location.hostname) { a.target = '_blank'; a.rel = 'noopener'; } });
    /* keep the active tab in view without moving the keyboard tab order */
    var on = root.querySelector('.ht-tab.on'), strip = root.querySelector('.ht-tabs .hub-wrap');
    if (on && strip && strip.scrollWidth > strip.clientWidth) {
      try { strip.scrollLeft = Math.max(0, on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2); } catch (e) {}
    }
    document.title = (space.title === 'Home' ? 'The HT Hub' : space.title + ' · The HT Hub') + ' · Huston-Tillotson × Taylormade Academy';
  }

  /* ---------- behaviors ---------- */
  function wire(root, space) {
    /* reveals */
    var rv = root.querySelectorAll('.rv');
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08 }); rv.forEach(function (n) { io.observe(n); }); }
    else rv.forEach(function (n) { n.classList.add('in'); });
    setTimeout(function () { rv.forEach(function (n) { n.classList.add('in'); }); }, 1800);
    /* progress bars */
    root.querySelectorAll('.prog i[data-w]').forEach(function (i) { requestAnimationFrame(function () { setTimeout(function () { i.style.width = i.getAttribute('data-w') + '%'; }, 150); }); });
    /* check-in */
    root.querySelectorAll('[data-checkin]').forEach(function (box) {
      var btnEl = box.querySelector('button'), inp = box.querySelector('input'), msg = box.querySelector('.msg'); if (!btnEl) return;
      function bad(t) { msg.textContent = t; msg.style.color = '#8f0000'; inp.setAttribute('aria-invalid', 'true'); }
      function go() { var v = (inp.value || '').trim().toUpperCase(); if (!v) { bad('Type the code from the screen.'); return; }
        if (v === String(box.getAttribute('data-code')).toUpperCase()) {
          set('checkin:' + box.getAttribute('data-checkin'), true);
          var hint = box.querySelector('.hint');
          box.innerHTML = '<div class="ok" tabindex="-1"><i>' + ICONS.check + '</i>You are checked in.<button type="button" class="pill ghost" data-uncheck style="margin-left:12px">Undo</button></div>' + (hint ? hint.outerHTML : '');
          var ok = box.querySelector('.ok'); if (ok) ok.focus();
          wireUncheck(box);
        } else bad('That code did not match. Try again.'); }
      btnEl.addEventListener('click', go); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      inp.addEventListener('input', function () { inp.removeAttribute('aria-invalid'); msg.textContent = ''; });
    });
    root.querySelectorAll('[data-checkin]').forEach(function (box) { wireUncheck(box); });
    function wireUncheck(box) {
      var u = box.querySelector('[data-uncheck]'); if (!u || u._w) return; u._w = 1;
      u.addEventListener('click', function () { set('checkin:' + box.getAttribute('data-checkin'), false); render(document.body.getAttribute('data-space') || 'home'); });
    }
    /* the looping portrait can be stopped */
    root.querySelectorAll('[data-vtoggle]').forEach(function (btn) {
      var v = btn.parentElement.querySelector('video'); if (!v) return;
      btn.addEventListener('click', function () {
        if (v.paused) { v.play(); btn.textContent = 'Pause'; btn.setAttribute('aria-pressed', 'true'); }
        else { v.pause(); btn.textContent = 'Play'; btn.setAttribute('aria-pressed', 'false'); }
      });
    });
    /* chat */
    root.querySelectorAll('form[data-chat]').forEach(function (f) {
      var room = f.getAttribute('data-chat'), scroll = f.parentElement.querySelector('[data-scroll]'); scroll.scrollTop = scroll.scrollHeight;
      f.addEventListener('submit', function (e) { e.preventDefault(); var inp = f.querySelector('input'), t = inp.value.trim(); if (!t) return;
        var m = { who: HT.me || 'You', text: t, when: 'Just now', me: true }; var arr = get('chat:' + room, []); arr.push(m); set('chat:' + room, arr.slice(-40));
        scroll.insertAdjacentHTML('beforeend', bub(m)); inp.value = ''; inp.focus(); scroll.scrollTop = scroll.scrollHeight; });
    });
    /* DM buttons (local) */
    root.querySelectorAll('[data-dm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = b.getAttribute('data-dm');
        var line = root.querySelector('form[data-chat]');
        if (line) {
          var card = line.closest('.hc') || line.parentElement;
          if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
          var inp = line.querySelector('input');
          if (inp) { inp.placeholder = 'Message ' + n; inp.focus(); }
          b.textContent = 'In the line below'; b.classList.add('on'); b.setAttribute('aria-label', 'Message ' + n + ', the line is open below');
        } else { b.textContent = 'Requested'; b.classList.add('on'); b.setAttribute('aria-label', 'Message requested to ' + n); b.setAttribute('aria-disabled', 'true'); }
      });
    });
    /* feed */
    root.querySelectorAll('[data-composer]').forEach(function (f) {
      var list = f.parentElement.querySelector('[data-posts]'), chans = f.parentElement.querySelector('[data-chans]');
      var cur = chans && chans.querySelector('.on') ? chans.querySelector('.on').getAttribute('data-chan') : '';
      function filter() { list.querySelectorAll('.post').forEach(function (p) { p.hidden = !!cur && p.getAttribute('data-chan') !== cur && p.getAttribute('data-chan') !== ''; }); }
      if (chans) chans.querySelectorAll('[data-chan]').forEach(function (c) { c.addEventListener('click', function () { chans.querySelectorAll('[data-chan]').forEach(function (x) { x.classList.remove('on'); x.classList.add('ghost'); x.setAttribute('aria-pressed', 'false'); }); c.classList.add('on'); c.classList.remove('ghost'); c.setAttribute('aria-pressed', 'true'); cur = c.getAttribute('data-chan'); filter(); }); });
      f.addEventListener('submit', function (e) { e.preventDefault(); var inp = f.querySelector('input'), t = inp.value.trim(); if (!t) return;
        var post = { who: HT.me || 'You', chan: cur, when: 'Just now', text: t, likes: 0 };
        var key = 'feed:' + (f.getAttribute('data-composer') || 'feed'); var arr = get(key, []); arr.unshift(post); set(key, arr.slice(0, 20));
        list.insertAdjacentHTML('afterbegin', postHtml(post, 'x')); inp.value = ''; inp.focus(); wireLikes(list); wireReplies(list, f); filter(); });
      wireLikes(list); wireReplies(list, f); filter();
    });
    function wireLikes(list) { list.querySelectorAll('[data-like]').forEach(function (b) { if (b._w) return; b._w = 1; b.addEventListener('click', function () { var s = b.querySelectorAll('span')[1]; var on = b.classList.toggle('on'); s.textContent = (+s.textContent) + (on ? 1 : -1); b.style.color = on ? '#8f0000' : ''; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', (on ? 'Liked, ' : 'Like, ') + s.textContent); }); }); }
    function wireReplies(list, form) { list.querySelectorAll('[data-reply]').forEach(function (b) { if (b._w) return; b._w = 1; b.addEventListener('click', function () { var inp = form && form.querySelector('input'); if (!inp) return; inp.value = '@' + b.getAttribute('data-reply') + ' '; inp.focus(); }); }); }
    /* directory search */
    root.querySelectorAll('[data-search]').forEach(function (inp) {
      var wrap = inp.closest('.bd'), rows = wrap.querySelectorAll('[data-q]'), none = wrap.querySelector('[data-none]');
      var count = wrap.querySelector('[data-count]');
      inp.addEventListener('input', function () { var q = inp.value.trim().toLowerCase(), n = 0; rows.forEach(function (r) { var ok = !q || r.getAttribute('data-q').indexOf(q) > -1; r.hidden = !ok; if (ok) n++; }); none.hidden = n > 0; if (count) count.textContent = n + (n === 1 ? ' person matches' : ' people match'); });
    });
    /* ics */
    root.querySelectorAll('[data-ics]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-ics');
        var blk = (space.blocks || []).filter(function (x) { return x.type === 'agenda' && (!id || x.id === id); })[0];
        if (!blk) return;
        downloadICS(blk);
        var was = b.innerHTML;
        b.innerHTML = 'Saved · open the file to add it'; b.classList.add('on');
        setTimeout(function () { b.innerHTML = was; b.classList.remove('on'); }, 4500);
      });
    });
    /* print just this agenda card */
    root.querySelectorAll('[data-print]').forEach(function (b) {
      b.addEventListener('click', function () {
        var card = b.closest('.hc'); if (!card) { window.print(); return; }
        root.querySelectorAll('.hc,.intro,.stats,.cta,.notice').forEach(function (n) { n.classList.remove('print-target'); });
        card.classList.add('print-target'); document.body.classList.add('print-one');
        window.print();
        setTimeout(function () { document.body.classList.remove('print-one'); card.classList.remove('print-target'); }, 800);
      });
    });
    /* a replay tile plays the sample picture in this page's room */
    root.querySelectorAll('[data-replay]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = root.querySelector('[data-player]');
        var title = b.getAttribute('data-replay');
        if (!p) { var live = root.querySelector('a[href$="/live/"]'); if (live) location.href = live.getAttribute('href'); return; }
        var nb = p.parentElement.querySelector('.nowbar b'); if (nb) nb.textContent = 'Replay, sample picture · ' + title;
        var host = p.closest('.hc') || p; if (host.scrollIntoView) host.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (!p.querySelector('video')) startPlayer(p);
      });
    });
    /* player */
    root.querySelectorAll('[data-player]').forEach(function (p) {
      var poster = p.querySelector('.poster'); poster.addEventListener('click', function () { startPlayer(p); });
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseTime(t) { var m = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(t || ''); if (!m) return [9, 0]; var hh = +m[1], mm = +(m[2] || 0); var ap = (m[3] || '').toUpperCase(); if (ap === 'PM' && hh < 12) hh += 12; if (ap === 'AM' && hh === 12) hh = 0; return [hh, mm]; }
  function icsText(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function downloadICS(blk) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Huston-Tillotson x Taylormade Academy//HT Hub//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:America/Chicago',
      'BEGIN:STANDARD', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST', 'END:STANDARD',
      'BEGIN:DAYLIGHT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT', 'END:DAYLIGHT',
      'END:VTIMEZONE'];
    var seq = 0;
    (blk.days || []).forEach(function (d) { if (!d.date) return; d.items.forEach(function (it) {
      var st = parseTime(it.time), en = it.end ? parseTime(it.end) : [st[0] + 1, st[1]]; var ds = d.date.replace(/-/g, '');
      seq++;
      lines.push('BEGIN:VEVENT',
        'UID:' + ds + '-' + seq + '-' + (blk.id || 'agenda') + '@ht.taylormadeacademy.com',
        'DTSTAMP:20260903T120000Z',
        'DTSTART;TZID=America/Chicago:' + ds + 'T' + pad(st[0]) + pad(st[1]) + '00',
        'DTEND;TZID=America/Chicago:' + ds + 'T' + pad(Math.min(en[0], 23)) + pad(en[1]) + '00',
        'SUMMARY:' + icsText((blk.event && blk.event.name ? blk.event.name + ' · ' : '') + it.title),
        'LOCATION:' + icsText(it.where || (blk.event && blk.event.place) || ''),
        'DESCRIPTION:' + icsText('Sample schedule prepared for Huston-Tillotson University.'),
        'END:VEVENT'); }); });
    lines.push('END:VCALENDAR');
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ((blk.event && blk.event.name) || 'ht-hub').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.ics'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function startPlayer(p) {
    var src = p.getAttribute('data-stream'), poster = p.querySelector('.poster');
    if (!poster) return;
    var posterHTML = poster.outerHTML;
    poster.querySelector('button').textContent = 'Loading…';
    var v = document.createElement('video'); v.playsInline = true; v.controls = true; v.loop = true; v.setAttribute('aria-label', 'Video for this room');
    var done = false;
    function fail(msg) {
      if (done) return; done = true;
      try { v.remove(); } catch (e) {}
      if (poster.parentElement) poster.remove();
      p.classList.remove('playing');
      var old = p.querySelector('.fail'); if (old) old.remove();
      p.insertAdjacentHTML('beforeend', '<div class="fail" role="alert"><span>' + esc(msg) + '</span><button type="button" class="pill" data-retry style="margin-left:12px">Try again</button></div>');
      var r = p.querySelector('[data-retry]');
      r.addEventListener('click', function () { p.querySelector('.fail').remove(); p.insertAdjacentHTML('afterbegin', posterHTML); var np = p.querySelector('.poster'); np.addEventListener('click', function () { startPlayer(p); }); startPlayer(p); });
      r.focus();
    }
    function go() {
      p.insertBefore(v, p.querySelector('.wm'));
      if (poster.parentElement) poster.remove();
      p.classList.add('playing');
      v.setAttribute('tabindex', '-1'); v.focus();
      v.play().catch(function () { v.muted = true; v.play().catch(function () {}); });
    }
    var watchdog = setTimeout(function () { if (v.readyState < 2) fail('The video could not load.'); }, 12000);
    v.addEventListener('loadeddata', function () { clearTimeout(watchdog); done = true; });
    v.addEventListener('error', function () { clearTimeout(watchdog); fail('The video could not load.'); });
    if (/\.mp4(\?|$)/i.test(src)) { v.src = src; go(); return; }
    if (v.canPlayType('application/vnd.apple.mpegurl')) { v.src = src; go(); return; }
    import('https://cdn.jsdelivr.net/npm/hls.js@1.5.13/+esm').then(function (m) { var Hls = m.default; if (!Hls.isSupported()) { clearTimeout(watchdog); fail('This browser cannot play this video. Try Chrome, Safari, or Edge.'); return; }
      var hl = new Hls({ liveSyncDurationCount: 3 }); hl.on(Hls.Events.ERROR, function (_, d) { if (d.fatal) { if (d.type === 'mediaError') hl.recoverMediaError(); else { clearTimeout(watchdog); fail('The video could not load.'); } } }); hl.loadSource(src); hl.attachMedia(v); go(); })
      .catch(function () { clearTimeout(watchdog); fail('The video player could not load. Check your connection or any blocker.'); });
  }

  /* ---------- auth (additive) ---------- */
  function boot() {
    if (/[?&]fresh\b/.test(location.search)) clearDemo();
    var bar = document.getElementById('htBar'); if (!bar) return;
    var next = encodeURIComponent(location.pathname);
    bar.innerHTML = '<div class="wrap"><span><b>Preview</b> · sample content, built for Huston-Tillotson University</span><span class="who"></span></div>';
    if (!window.BM_CONFIG) return;
    import('https://esm.sh/@supabase/supabase-js@2').then(function (m) {
      var sb = m.createClient(window.BM_CONFIG.SUPABASE_URL, window.BM_CONFIG.SUPABASE_KEY);
      return sb.auth.getSession().then(function (r) { var s = r.data && r.data.session; if (!s) return;
        var u = s.user, name = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || '').split('@')[0];
        return sb.from('ea_profiles').select('display_name').eq('user_id', u.id).maybeSingle().then(function (q) { if (q.data && q.data.display_name) name = q.data.display_name; }).catch(function () {}).then(function () {
          HT.me = name; var first = name.split(' ')[0];
          bar.querySelector('.who').innerHTML = '<span class="av">' + esc(initials(name)) + '</span><span>Signed in as <b>' + esc(name) + '</b></span>';
          var sb = document.querySelector('.site-header .btn.primary, .site-header .btn.gold');
          if (sb && /sign in/i.test(sb.textContent)) { sb.textContent = 'Your account'; sb.setAttribute('href', '/dashboard/'); }
          var hello = document.querySelector('.ht-head h1'); if (hello && document.body.getAttribute('data-space') === 'home') hello.textContent = 'Welcome back, ' + first + '.';
        }); });
    }).catch(function () {});
  }

  window.HTHub = { render: render, boot: boot, esc: esc, icon: icon };
  document.addEventListener('DOMContentLoaded', function () { var k = document.body.getAttribute('data-space') || 'home'; render(k); boot(); });
})();
