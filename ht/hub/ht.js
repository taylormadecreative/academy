/* The HT Hub — Huston-Tillotson × Taylormade Academy. Shared runtime.
   Renders a space from window.HT (see docs/superpowers/specs/ht-hub-schema.md), then tries to greet a signed-in Academy member.
   Everything renders for everyone (preview with sample content); auth is additive, never blocking. */
(function () {
  'use strict';
  var HT = window.HT || (window.HT = {});
  var LS = function (k) { return 'ht:' + k; };
  /* our own ?v= — read while this script is still the current one (null after DOMContentLoaded).
     The room module and its CSS load with the same stamp, so a cache-first service worker frees
     them whenever ht/build.mjs rewrites it. */
  var V = (function () { try { var s = document.currentScript && document.currentScript.src; var m = s && /[?&]v=([A-Za-z0-9]+)/.exec(s); return m ? '?v=' + m[1] : ''; } catch (e) { return ''; } })();
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
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5.1.7c0 1.8-2.6 2.2-2.6 4.3M12 17.2h.01"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 018 0v3.5"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6.5A1.5 1.5 0 005 4.5v15A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    slides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.3-8.6-8.6C2.2 8.2 4.2 5 7.4 5c2 0 3.5 1.1 4.6 2.6C13.1 6.1 14.6 5 16.6 5c3.2 0 5.2 3.2 4 6.4C19 15.7 12 20 12 20z"/></svg>',
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8.5l3.5 3.5 7-8"/></svg>'
  };
  Object.keys(ICONS).forEach(function (k) { ICONS[k] = ICONS[k].replace('<svg', '<svg aria-hidden="true" focusable="false"'); });
  function icon(n) { return ICONS[n] || ICONS.star; }

  /* ---------- block renderers ---------- */
  function card(b, inner, cls) {
    var head = (b.title || b.meta) ? '<div class="hd">' + (b.title ? h`<h2>${b.title}</h2>` : '<span></span>') + (b.meta ? h`<span class="m">${b.meta}</span>` : '') + '</div>' : '';
    return '<section class="hc rv ' + (cls || '') + '"' + (b.id ? h` id="${b.id}"` : '') + '>' + head + '<div class="bd">' + inner + '</div></section>';
  }
  /* One status language with the app pages (the Trust page's chips, the badge states): a small uppercase
     text label, maroon when it says something good or current, muted ink otherwise, with a line icon when
     one helps. No filled pills, no colored dots. The old cls values ('green', 'soft', 'sample', 'nextup')
     still arrive from the data files; they only pick the tone now. */
  function smallIcon(n) { return icon(n).replace('<svg', '<svg width="13" height="13"'); }
  function labelIcon(t) {
    return /^(restricted|closed)$/i.test(t) ? 'lock' : /^(done|owner|host|taking mentees|open to internships|replies same day)$/i.test(t) ? 'check' : /^live|replay/i.test(t) ? 'play' : '';
  }
  function chipHtml(t, cls) {
    if (!t) return '';
    var tone = (cls === 'green' || cls === 'nextup' || /^(restricted|closed)$/i.test(t)) ? 'strong' : 'quiet';
    var ic = labelIcon(String(t));
    return '<span class="chip lbl" data-tone="' + tone + '">' + (ic ? smallIcon(ic) : '') + h`<span>${t}</span></span>`;
  }
  /* Primary actions are the app's maroon button. Gold stays only as the single accent inside a maroon
     banner (R.cta passes gold:true for its primary), the way the app's leadership hero does it. */
  function btn(c, gold) {
    if (!c) return '';
    var style = c.style || 'ht';
    if (style === 'ht-gold' && !gold) style = 'ht';
    return h`<a class="btn ${style}" href="${c.href}">${c.label}</a>`;
  }
  /* Ada is one character everywhere: the Hub's AI guide. Older data lines still say "student ambassador". */
  var ADA_ALT = 'Ada, the Hub\u2019s AI guide';
  function adaLine(s) { return String(s || '').replace(/Ada · HT student ambassador · sample line/g, 'Ada, the Hub\u2019s AI guide · sample').replace(/Ada · HT student ambassador/g, 'Ada, the Hub\u2019s AI guide'); }
  /* /ht/img/r-*.jpg are renderings of the campus plan, not photographs of buildings that stand today. */
  function isRendering(src) { return /\/img\/r-/.test(String(src || '')); }
  function renderingCap(src) { return isRendering(src) ? '<figcaption class="ht-render-cap">Campus plan rendering</figcaption>' : ''; }
  function artHtml(src, alt, eager) {
    return (isRendering(src) ? '<figure class="art">' : '<div class="art">') + h`<img src="${src}" alt="${alt || ''}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` + renderingCap(src) + (isRendering(src) ? '</figure>' : '</div>');
  }

  var R = {};
  R.intro = function (b) {
    var art = '';
    if (b.video) {
      var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      art = h`<div class="art"><video muted loop playsinline ${still ? '' : 'autoplay'} preload="none" poster="${b.poster || ''}" aria-label="${b.imageAlt || 'A short looping portrait'}"><source src="${b.video}" type="video/mp4"></video>` +
        '<button type="button" class="pill ghost" data-vtoggle aria-pressed="' + (!still) + '" style="position:absolute;left:12px;bottom:12px;background:rgba(255,255,255,.92)">' + (still ? 'Play' : 'Pause') + '</button></div>';
    }
    else if (b.image) art = artHtml(b.image, b.imageAlt, true);
    var ada = b.ada ? '<div class="ada" style="margin-top:18px">' + h`<img src="${HT.site.adaPoster}" alt="${ADA_ALT}"><div><b>Ada says</b><p>${b.ada.text}</p>` + (b.ada.when ? h`<div class="w">${adaLine(b.ada.when)}</div>` : '') + '</div></div>' : '';
    return '<section class="intro rv' + (art ? '' : ' plain') + '"' + (b.id ? h` id="${b.id}"` : '') + '><div>' +
      (b.kicker ? h`<div class="k">${b.kicker}</div>` : '') + h`<h2>${b.title}</h2>` + (b.text ? h`<p>${b.text}</p>` : '') +
      (b.ctas && b.ctas.length ? '<div class="ctas">' + b.ctas.map(btn).join('') + '</div>' : '') + ada + '</div>' + art + '</section>';
  };
  R.ada = function (b) { return '<section class="ada rv"' + (b.id ? h` id="${b.id}"` : '') + '>' + h`<img src="${HT.site.adaPoster}" alt="${ADA_ALT}"><div><b>${b.label || 'Ada says'}</b><p>${b.text}</p>` + (b.when ? h`<div class="w">${adaLine(b.when)}</div>` : '') + '</div></section>'; };
  R.stats = function (b) { return '<section class="stats rv"' + (b.id ? h` id="${b.id}"` : '') + '>' + b.items.map(function (s) { return h`<div class="stat"><b>${s.n}</b><span>${s.label}</span></div>`; }).join('') + '</section>'; };
  R.cards = function (b) {
    var inner = '<div class="cards">' + b.items.map(function (c) {
      var tag = c.href ? 'a' : 'div';
      return '<' + tag + ' class="card"' + (c.href ? h` href="${c.href}"` : '') + '>' + (c.img ? h`<div class="img"><img src="${c.img}" alt="${c.href ? '' : (c.alt || '')}" loading="lazy" decoding="async">` + renderingCap(c.img) + '</div>' : '') +
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
      return '<div class="person">' + h`<span class="av${p.gold ? ' g' : ''}">${p.init || initials(p.name)}</span><div><b>${p.name}</b><span>${adaLine([p.role, p.org].filter(Boolean).join(' · '))}</span>` + (p.tag ? chipHtml(p.tag, p.tagCls || 'soft') : '') + '</div>' +
        (b.dm ? '<div class="act"><button class="pill ghost" type="button" data-dm="' + esc(p.name) + '" aria-label="Message ' + esc(p.name) + '">Message</button></div>' : '') + '</div>';
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
      return '<div class="ann"><div>' + h`<p>${a.text}</p><div class="w">${adaLine([a.who, a.when].filter(Boolean).join(' · '))}</div>` + '</div></div>';
    }).join('');
    return card(b, inner || '<div class="empty">Nothing posted yet.</div>');
  };
  R.materials = function (b) {
    var inner = b.items.map(function (m) {
      var kind = String(m.kind || 'DOC').toUpperCase();
      var glyph = (kind === 'PLAY' || kind === 'REC') ? 'play' : kind === 'DECK' ? 'slides' : 'file';
      return '<div class="mat">' + '<span class="k" aria-hidden="true">' + icon(glyph) + '</span>' + h`<div><b>${m.title}</b>` + (m.sub ? h`<span>${m.sub}</span>` : '') + (!m.href && m.restricted ? chipHtml('Restricted') : '') + '</div>' + (m.href ? h`<a class="lnk" href="${m.href}" aria-label="Open ${m.title}">Open</a>` : '') + '</div>';
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
      '<div class="acts"><button type="button" data-like="' + i + '" aria-pressed="false" aria-label="Like, ' + n + '"><span aria-hidden="true" class="ic">' + smallIcon('heart') + '</span><span>' + n + '</span></button>' +
      '<button type="button" data-reply="' + esc(p.who) + '">Reply</button></div></div>';
  }
  R.chat = function (b) {
    var msgs = (b.seed || []).concat(get('chat:' + b.room, []));
    var priv = /private/i.test(b.meta || '') || /private/i.test(b.title || '');
    var ph = b.placeholder || (priv ? 'Message your host' : 'Say something to the room');
    var inner = '<div class="chat"><div class="scroll" data-scroll role="log" aria-live="polite" aria-label="Messages" tabindex="0">' + msgs.map(bub).join('') + '</div><form data-chat="' + esc(b.room) + '"><input placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '" maxlength="400"><button type="submit">Send</button></form></div>';
    var s = card(b, inner); return s.replace('<div class="bd">', '<div class="bd" style="padding:0">');
  };
  function bub(m) { return '<div class="bub' + (m.me ? ' me' : '') + '">' + h`<div class="who">${adaLine(m.who)}</div><p>${m.text}</p>` + (m.when ? h`<div class="w">${m.when}</div>` : '') + '</div>'; }
  R.checkin = function (b) {
    var done = get('checkin:' + b.session, false);
    var okHtml = '<div class="ok" tabindex="-1"><i>' + ICONS.check + '</i>You are checked in.<button type="button" class="pill ghost" data-uncheck style="margin-left:12px">Undo</button></div>';
    var inner = h`<p style="margin-bottom:12px"><b>${b.session}</b>` + (b.sub ? h` · ${b.sub}` : '') + '</p><div class="ci" data-checkin="' + esc(b.session) + '" data-code="' + esc(b.code) + '">' +
      (done ? okHtml : '<input placeholder="CODE" maxlength="12" aria-label="Check-in code" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done"><button class="btn ht sm" type="button">Check in</button><span class="msg" role="status" aria-live="polite" style="font-size:13px;font-weight:600"></span>') +
      (b.hint ? h`<div class="hint">${b.hint}</div>` : '') + '</div>';
    return card(b, inner);
  };
  R.replays = function (b) {
    var inner = '<div class="reps">' + b.items.map(function (r) { return '<button type="button" class="rep" data-replay="' + esc(r.title) + '">' + h`<img src="${r.poster}" alt="" loading="lazy" decoding="async">` + (isRendering(r.poster) ? '<span class="ht-render-cap">Campus plan rendering</span>' : '') + (r.len ? h`<span class="len">${r.len}</span>` : '') + '<div class="cap">' + h`<b>${r.title}</b><span>${[r.date, r.tag].filter(Boolean).join(' · ')}</span>` + '</div></button>'; }).join('') + '</div>';
    return card(b, inner);
  };
  R.player = function (b) {
    var now = b.now ? '<div class="nowbar">' + (b.live ? '<span class="flag">Live</span>' : chipHtml('Test picture · sample', 'soft')) + h`<b>${b.now.title}</b>` + (b.now.who ? h`<span>${b.now.who}</span>` : '') + (b.now.when ? h`<span>${b.now.when}</span>` : '') + '</div>' : '';
    var inner = '<div class="player" data-player data-stream="' + esc(b.stream || '/ht/img/hero-flyover.mp4') + '">' +
      '<div class="brand"><div style="display:flex;align-items:center;gap:10px"><img src="/ht/img/ht-wordmark-gold.png" alt="Huston-Tillotson University"><span class="t">' + esc(b.title || 'The live room') + '</span></div>' + (b.live ? '<span class="flag">Live</span>' : '') + '</div>' +
      '<div class="poster" style="background-image:url(' + esc(b.poster || '/ht/img/hero-flyover-poster.jpg') + ')"><button type="button" aria-label="Watch ' + esc(b.title || 'the live room') + '">' + smallIcon('play') + ' Watch</button>' + (isRendering(b.poster) ? '<span class="ht-render-cap">Campus plan rendering</span>' : '') + '</div>' +
      '<img class="wm" src="/assets/logo-nav.webp" alt=""></div>' + now;
    var s = card({ id: b.id, title: b.cardTitle, meta: b.meta }, inner, 'dark'); return s.replace('<div class="bd">', '<div class="bd" style="padding:0">');
  };
  /* the HT class room: the mount the room module fills, and the cards/host card above it.
     Inert until ht/hub/room.js loads (wire() imports it when this block is on the page). */
  /* the replay page (spec 2026-09-17 §2.2): ht/hub/replay.js fills this block from the class tables */
  R.replay = function (b) { return '<div class="ht-replay" id="htReplay"' + (b.id ? h` data-id="${b.id}"` : '') + '><p class="ht-room-loading">Finding the replay&hellip;</p></div>'; };
  R.room = function (b) {
    var inner = '<div data-room><div class="ht-room-ctl"><p class="ht-room-loading">Opening the room&hellip;</p></div><div id="rtkMount"></div></div>';
    var s = card({ id: b.id, title: b.cardTitle, meta: b.meta }, inner, 'dark'); return s.replace('<div class="bd">', '<div class="bd" style="padding:0">');
  };
  R.timeline = function (b) {
    var inner = '<div class="tl">' + b.items.map(function (t) { return '<div class="tli' + (t.done ? ' done' : '') + '">' + h`<em>${t.when}</em>` + (t.done ? chipHtml('Done', 'green').replace('class="chip lbl"', 'class="chip lbl" style="margin-left:10px;vertical-align:middle"') : '') + h`<b>${t.title}</b>` + (t.text ? h`<p>${t.text}</p>` : '') + '</div>'; }).join('') + '</div>';
    return card(b, inner);
  };
  /* Integer yyyymmdd comparison: no Date parsing, so no timezone drift on "is this past?". */
  function dnum(v) { return +String(v || '').replace(/-/g, '') || 0; }
  function today() { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var KIND = { exam: ['Exams', ''], deadline: ['Deadline', ''], closed: ['No classes', 'soft'], ceremony: ['Ceremony', 'green'], registration: ['Registration', 'soft'], advising: ['Advising', 'soft'], housing: ['Housing', 'soft'], term: ['Term', 'soft'] };
  /* past | now (today falls inside it) | ahead */
  function whenOf(d, end) { var t = today(), a = dnum(d), b = dnum(end) || a; return b < t ? 'past' : (a <= t ? 'now' : 'ahead'); }
  function longDate(d, end) {
    var a = new Date(d + 'T12:00:00');
    var txt = DAYS[a.getDay()] + ', ' + MON[a.getMonth()] + ' ' + a.getDate();
    if (end && end !== d) { var b = new Date(end + 'T12:00:00'); txt += ' to ' + DAYS[b.getDay()] + ', ' + MON[b.getMonth()] + ' ' + b.getDate(); }
    return txt;
  }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  R.calendar = function (b) {
    var flagged = false;
    var inner = b.items.map(function (c) {
      var d = c.date ? new Date(c.date + 'T12:00:00') : null;
      var w = c.date ? whenOf(c.date, c.end) : '';
      var flag = '';
      if (w === 'now') flag = '<span class="flag">Today</span>';
      else if (w === 'ahead' && !flagged) { flagged = true; flag = chipHtml('Next', 'nextup'); }
      return '<div class="cal' + (w ? ' is-' + w : '') + '"><div class="d">' + (d ? h`<b>${d.getDate()}</b><span>${MON[d.getMonth()]}</span>` : h`<b>${c.day || ''}</b><span>${c.mon || ''}</span>`) + '</div><div class="b">' + h`<b>${c.title}</b>` + (c.where ? h`<span>${c.where}</span>` : '') + '</div>' + ((c.tag || flag) ? '<span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' + flag + (c.tag ? chipHtml(c.tag, c.tagCls || 'soft') : '') + '</span>' : '') + '</div>';
    }).join('');
    return card(b, inner);
  };
  /* The published academic year: one live list, filtered by term, that knows what today is. */
  R.year = function (b) {
    var items = (b.items || []).slice().sort(function (x, y) { return dnum(x.d) - dnum(y.d); });
    var nextSeen = false;
    var rows = items.map(function (c) {
      var w = whenOf(c.d, c.end), a = new Date(c.d + 'T12:00:00');
      var isNext = w === 'ahead' && !nextSeen; if (isNext) nextSeen = true;
      var k = KIND[c.kind] || KIND.term;
      var span = c.end && c.end !== c.d;
      var flag = w === 'now' ? '<span class="flag">' + (span ? 'On now' : 'Today') + '</span>' : (isNext ? chipHtml('Next up', 'nextup') : '');
      return '<div class="yr is-' + w + (isNext ? ' nx' : '') + '" data-term="' + esc(c.term) + '" data-when="' + w + '">' +
        '<div class="d">' + h`<b>${a.getDate()}</b><span>${MON[a.getMonth()]}</span>` + '</div>' +
        '<div class="b">' + h`<b>${c.t}</b><span>${longDate(c.d, c.end)}${c.note ? ' · ' + c.note : ''}</span>` + '</div>' +
        '<div class="f">' + flag + chipHtml(k[0], k[1]) + '</div></div>';
    }).join('');
    var terms = (b.terms || []).map(function (t) { return '<button class="pill ghost" type="button" data-yr="' + esc(t.key) + '">' + esc(t.label) + '</button>'; }).join('');
    var head = '<div class="yrbar"><button class="pill on" type="button" data-yr="next">What\u2019s next</button>' + terms + '</div>';
    var tools = '<div class="yrtools"><button class="pill" type="button" data-yics>' + ICONS.calendar.replace('viewBox', 'width="14" height="14" viewBox') + ' Add these to your calendar</button><button class="pill ghost" type="button" data-print>Print this list</button></div>';
    var src = b.source ? '<p class="yrsrc">' + h`${b.source}` + (b.sourceHref ? h` <a href="${b.sourceHref}" target="_blank" rel="noopener">View the published calendar</a>` : '') + '</p>' : '';
    return card(b, head + '<div class="yrlist" data-yearlist>' + rows + '</div><div class="empty" data-yrnone hidden role="status">Nothing left on the calendar for that term.</div>' + tools + src, 'year');
  };
  R.split = function (b) {
    var inner = '<div class="split' + (b.side === 'left' ? ' r' : '') + '"><div>' + (b.kicker ? h`<div class="k" style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ht-maroon);margin-bottom:8px">${b.kicker}</div>` : '') + h`<h2>${b.title}</h2>` + (b.text ? h`<p>${b.text}</p>` : '') +
      (b.bullets && b.bullets.length ? '<ul>' + b.bullets.map(function (x) { return '<li>' + smallIcon('check') + h`<span>${x}</span></li>`; }).join('') + '</ul>' : '') + (b.cta ? '<div style="margin-top:16px">' + btn(b.cta) + '</div>' : '') + '</div>' +
      (b.image ? artHtml(b.image, b.imageAlt) : '') + '</div>';
    return card({ id: b.id, meta: b.meta }, inner);
  };
  R.steps = function (b) { return card(b, '<div class="steps">' + b.items.map(function (s) { return h`<div class="step"><em>${s.em}</em><h3>${s.h}</h3><p>${s.p}</p></div>`; }).join('') + '</div>'); };
  R.faq = function (b) { return card(b, '<div class="faq">' + b.items.map(function (q) { return h`<details><summary>${q.q}</summary><p>${q.a}</p></details>`; }).join('') + '</div>'); };
  R.notice = function (b) { return '<div class="notice rv' + (b.tone === 'maroon' ? ' maroon' : '') + '"' + (b.id ? h` id="${b.id}"` : '') + '>' + (b.html ? b.html : esc(b.text)) + '</div>'; };
  R.cta = function (b) { return '<section class="cta rv"' + (b.id ? h` id="${b.id}"` : '') + '><div>' + h`<h2>${b.title}</h2>` + (b.text ? h`<p>${b.text}</p>` : '') + '</div><div class="ctas">' + btn(b.primary, true) + (b.secondary ? btn(Object.assign({ style: 'ht-line' }, b.secondary)) : '') + '</div></section>'; };
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
  function tabsHtml(pageKey) {
    var moreCurrent = ['events','calendar','live','legacy-live','session','replay','success','trust'].indexOf(pageKey) !== -1;
    var demoRole = new URLSearchParams(location.search).get('demo');
    function link(k, label, glyph, current) {
      var href = HT.site.hub + (k === 'home' ? '' : k + '/');
      return '<a href="' + esc(href) + '"' + (current ? ' aria-current="page"' : '') + '>' + icon(glyph) + '<span>' + esc(label) + '</span></a>';
    }
    var menu = link('home','Today','home',pageKey === 'home') + link('courses','Learning','book',pageKey === 'courses') +
      link('community','Community','users',pageKey === 'community') + link('messages','Messages','chat',pageKey === 'messages' || pageKey === 'people') + link('spaces','Campus','grid',pageKey === 'spaces' || (HT.order || []).indexOf(pageKey) !== -1);
    var more = '<details class="campus-nav-more"><summary' + (moreCurrent ? ' aria-current="page"' : '') + '>' + icon('grid') + '<span>More</span><span class="campus-nav-more-chevron" aria-hidden="true">⌄</span></summary><div class="campus-nav-more-panel" aria-label="More campus destinations">' +
      link('events','Events','calendar',pageKey === 'events') + link('live','Classrooms','play',['live','legacy-live','session','replay'].indexOf(pageKey) !== -1) + (['staff','leadership'].indexOf(demoRole) !== -1 ? link('success','Student success','shield',pageKey === 'success') : '') + link('trust','Security & integrations','door',pageKey === 'trust') + link('calendar','Academic calendar','calendar',pageKey === 'calendar') + link('support','Get help','help',false).replace('<a ','<a class="campus-more-phone" ') + link('welcome','Hub guide','book',false).replace('<a ','<a class="campus-more-phone" ') + '</div></details>';
    var stripItems = [['events','Events','calendar'],['live','Classrooms','play']].concat(['staff','leadership'].indexOf(demoRole) !== -1 ? [['success','Student success','shield']] : []).concat([['trust','Security & integrations','door'],['calendar','Calendar','calendar'],['support','Get help','help'],['welcome','Guide','book']]);
    var strip = '<nav class="campus-phone-strip" aria-label="More destinations">' + stripItems.map(function (it) { return link(it[0], it[1], it[2], pageKey === it[0]); }).join('') + '</nav>';
    return '<nav class="campus-nav campus-nav-communication" aria-label="Main navigation"><div class="campus-nav-inner">' + menu + '<div class="campus-nav-end">' + more + '</div></div></nav>' + strip;
  }
  function breadcrumbHtml(key, title) {
    var parent = key === 'calendar' ? ['events', 'Events'] : ['session','replay','legacy-live'].indexOf(key) !== -1 ? ['live', 'Classrooms'] : ['spaces', 'Around campus'];
    var parentHref = HT.site.hub + parent[0] + '/';
    return '<nav class="campus-breadcrumb" aria-label="Breadcrumb"><ol><li><a href="' + esc(parentHref) + '">' + esc(parent[1]) + '</a></li><li aria-current="page">' + esc(title) + '</li></ol></nav>';
  }
  function firstVisitGuide(key, space) {
    var title = space.title === 'Home' ? 'The HT Hub' : space.title;
    var demo = new URLSearchParams(location.search).get('demo') || 'campus';
    var storageKey = 'ht-hub-page-guide:v1:' + encodeURIComponent(demo + ':preview:' + key);
    var wasSeen = false;
    try { wasSeen = localStorage.getItem(storageKey) === 'seen'; } catch (_) {}
    var intro = (space.blocks || []).find(function (block) { return block.type === 'intro' && block.title; });
    var instruction;
    if (key === 'calendar') instruction = 'Choose “What’s next” or a term to narrow the dates, then add the dates you need to your calendar.';
    else if (['session','replay'].indexOf(key) !== -1) instruction = 'Check the course and session details first, then use the controls to join the class or watch its recording.';
    else if (key === 'legacy-live') instruction = 'Choose the campus session or cohort classroom you need. Its page brings the schedule, room, and available replay together.';
    else if (space.headCta && space.headCta.label) instruction = 'For a quick first step, choose “' + space.headCta.label + '” above. The sections below contain the rest of this space’s resources.';
    else instruction = 'Start with “' + (intro ? intro.title : title) + '” below, then use its links and the sections that follow to explore ' + (space.office || title) + '.';
    if (wasSeen) return '';
    var open = '';
    return '<details class="campus-page-guide ht-page-guide" data-campus-page-guide="' + esc(storageKey) + '"' + open + '><summary><span><strong>First time here?</strong><span>How this page works</span></span><span class="campus-page-guide-chevron" aria-hidden="true">⌄</span></summary><div class="campus-page-guide-content"><div><p class="campus-eyebrow">Start here</p><p>' + esc(instruction) + '</p></div><div class="campus-page-guide-actions"><a class="campus-button campus-button-secondary campus-button-small" href="' + esc(HT.site.hub + 'welcome/') + '">Full site guide</a><button type="button" class="campus-onboarding-text-button" data-page-guide-done>Got it</button></div></div></details>';
  }
  /* The cabinet tour. It starts on the new work (success, insights, a course with Ada, grading,
     badges, the IT page) and then walks every space. Steps may switch the demo role; ?tour=1 keeps
     the rail visible for student and staff stops. */
  function tourLabel(step) {
    return ({ success: 'Student success', insights: 'Insights', trust: 'Security', live: 'Classrooms', learn: 'Badges' })[step.key] ||
      (step.key === 'courses' ? (step.role === 'staff' ? 'Grading' : 'Ask Ada') : step.key[0].toUpperCase() + step.key.slice(1));
  }
  function tourHref(step) {
    var q = new URLSearchParams(Object.assign({ demo: step.role || 'leadership' }, step.query || {}, { tour: '1' }));
    return HT.site.hub + step.key + '/?' + q.toString();
  }
  function leadershipDemoRail(key) {
    var params = new URLSearchParams(location.search), demo = params.get('demo') || '';
    if (demo !== 'leadership' && params.get('tour') !== '1') return '';
    var journey = HT.leadershipWalkthrough || [];
    var index = journey.findIndex(function (step) { return step.key === key && (step.role || 'leadership') === demo; });
    if (index < 0 && demo === 'leadership') index = journey.findIndex(function (step) { return step.key === key && !step.role; });
    if (index < 0) return '';
    var current = journey[index], previous = journey[index - 1], next = journey[index + 1];
    var forward = next
      ? '<a class="campus-leadership-next" href="' + esc(tourHref(next)) + '">Next: ' + esc(tourLabel(next)) + ' <span aria-hidden="true">→</span></a>'
      : '<a class="campus-leadership-next" href="' + esc(HT.site.hub + '?demo=leadership') + '">Finish the tour <span aria-hidden="true">✓</span></a>';
    var roleNote = current.role ? ' <span class="campus-leadership-role">Viewing as ' + esc(current.role === 'staff' ? 'the instructor' : 'a student') + '</span>' : '';
    return '<section class="campus-leadership-tour" aria-labelledby="campusLeadershipTourTitle"><div class="campus-leadership-tour-top"><p class="campus-eyebrow">Guided tour · sample journey' + roleNote + '</p><span>Stop <b>' + (index + 1) + '</b> of ' + journey.length + '</span></div><div class="campus-leadership-tour-body"><div><h2 id="campusLeadershipTourTitle">' + esc(current.title) + '</h2><p>' + esc(current.detail) + '</p></div><nav aria-label="Tour navigation">' + (previous ? '<a class="campus-leadership-previous" href="' + esc(tourHref(previous)) + '">← ' + esc(tourLabel(previous)) + '</a>' : '<a class="campus-leadership-previous" href="' + esc(HT.site.hub + '?demo=leadership') + '">← Today</a>') + forward + '</nav></div><progress value="' + (index + 1) + '" max="' + journey.length + '" aria-label="Tour progress"></progress></section>';
  }
  window.HTTour = { href: tourHref, steps: function () { return HT.leadershipWalkthrough || []; } };
  function staticDemoHeader(role) {
    if (['student', 'staff', 'leadership'].indexOf(role) === -1) return;
    var header = document.querySelector('.site-header .nav-cta');
    if (!header) return;
    var persona = { student: 'Jordan R.', staff: 'Morgan T.', leadership: 'Avery W.' }[role];
    var initials = persona.split(' ').map(function (w) { return w[0]; }).join('');
    header.innerHTML = '<a class="navlink campus-header-guide" href="' + esc(HT.site.hub + 'welcome/?demo=' + role) + '">Guide</a><a class="navlink campus-header-help" href="' + esc(HT.site.hub + 'support/?demo=' + role) + '">Get help</a><a class="campus-account" href="' + esc(HT.site.hub + '?demo=' + role) + '" aria-label="' + esc(persona) + ', sample account"><span class="campus-avatar">' + esc(initials) + '</span><span>' + esc(persona) + '</span></a>';
  }
  /* The same demo strip the app pages carry, so a space never looks like a different product. */
  function demoStrip(role) {
    if (['student', 'staff', 'leadership'].indexOf(role) === -1) return '';
    var roles = [['student', 'Student'], ['staff', 'Faculty & staff'], ['leadership', 'Leadership']];
    return '<div class="campus-demo"><div><strong>Interactive demo</strong><span>Sample people and records, not university data. Changes stay in this browser.</span></div><label for="campusDemoRole">View as</label><select id="campusDemoRole">' + roles.map(function (item) { return '<option value="' + item[0] + '"' + (item[0] === role ? ' selected' : '') + '>' + item[1] + '</option>'; }).join('') + '</select></div>';
  }
  function render(key) {
    var space = key === 'home' ? HT.home : HT.spaces[key];
    var root = document.getElementById('htRoot'); if (!root || !space) return;
    document.body.classList.add('ht-space-page');
    var main = [], side = [];
    (space.blocks || []).forEach(function (b) { var fn = R[b.type]; if (!fn) return; (b.side === true ? side : main).push(fn(b)); });
    var pageTitle = space.title === 'Home' ? 'The HT Hub' : space.title;
    var roleNow = new URLSearchParams(location.search).get('demo');
    var head = tabsHtml(key) + '<div class="campus-container ht-space-container">' + demoStrip(roleNow) + breadcrumbHtml(key, pageTitle) + '<header class="campus-page-head ht-space-page-head" aria-labelledby="htSpaceTitle"><div>' +
      h`<p class="campus-eyebrow">${space.office || space.kicker || 'Huston-Tillotson University'}</p><h1 id="htSpaceTitle">${pageTitle}</h1>` + (space.sub ? h`<p>${space.sub}</p>` : '') +
      '</div><div class="campus-head-actions">' + (demoStrip(roleNow) ? '' : '<span class="ht-space-stamp">' + esc(space.stamp || 'Preview · sample content') + '</span>') + (space.headCta ? btn(space.headCta) : '') + '</div></header>' +
      '<main class="campus-main ht-space-main" id="htMain" tabindex="-1">' + firstVisitGuide(key, space) + leadershipDemoRail(key) + '<div class="ht-grid' + (side.length ? '' : ' one') + '">' + '<div class="ht-col">' + main.join('') + '</div>' + (side.length ? '<div class="ht-col">' + side.join('') + '</div>' : '') + '</div></main></div>' +
      '<nav class="campus-mobile-nav" aria-label="Mobile navigation">' +
      [['home','home','Today'],['courses','book','Learning'],['community','users','Community'],['messages','chat','Messages'],['spaces','grid','Campus']].map(function (item) {
        var current = item[0] === 'spaces' ? (HT.order || []).indexOf(key) !== -1 || key === 'spaces' : item[0] === 'courses' ? ['courses','learn'].indexOf(key) !== -1 : item[0] === 'community' ? key === 'community' : item[0] === 'messages' ? ['messages','people'].indexOf(key) !== -1 : item[0] === 'home' && key === 'home';
        return '<a href="' + esc(HT.site.hub + (item[0] === 'home' ? '' : item[0] + '/')) + '"' + (current ? ' aria-current="page"' : '') + '>' + icon(item[1]) + '<span>' + esc(item[2]) + '</span></a>';
      }).join('') + '</nav>';
    root.innerHTML = head;
    /* Keep the chosen workspace when returning from a reference calendar or
       office preview, without creating or changing any demo records. */
    var demoRole = new URLSearchParams(location.search).get('demo');
    if (['student', 'staff', 'leadership'].indexOf(demoRole) !== -1) {
      document.body.classList.add('ht-interactive-demo');
      var previewBar = document.getElementById('htBar'); if (previewBar) previewBar.hidden = true;
      var picker = document.getElementById('campusDemoRole');
      if (picker) picker.addEventListener('change', function () { var url = new URL(location.href); url.searchParams.set('demo', picker.value); location.assign(url.pathname + url.search + url.hash); });
      document.body.classList.toggle('ht-leadership-demo', demoRole === 'leadership');
      staticDemoHeader(demoRole);
      document.querySelectorAll('a[href^="/ht/hub/"]').forEach(function (a) {
        var destination = new URL(a.getAttribute('href'), location.origin);
        destination.searchParams.set('demo', demoRole);
        a.setAttribute('href', destination.pathname + destination.search + destination.hash);
      });
    }
    if (!side.length) { var g = root.querySelector('.ht-grid'); if (g) g.style.gridTemplateColumns = 'minmax(0,1fr)'; }
    wire(root, space);
    /* external links leave the hub in a new tab so the demo stays put */
    root.querySelectorAll('a[href^="http"]').forEach(function (a) { if (a.hostname !== location.hostname) { a.target = '_blank'; a.rel = 'noopener'; } });
    document.title = (space.title === 'Home' ? 'The HT Hub' : space.title + ' · The HT Hub') + ' · Huston-Tillotson × Taylormade Academy';
  }

  /* ---------- behaviors ---------- */
  function wire(root, space) {
    var pageGuideClick = function (event) {
      var button = event.target.closest && event.target.closest('[data-page-guide-done]');
      if (!button || !root.contains(button)) return;
      var details = button.closest('[data-campus-page-guide]');
      if (!details) return;
      try { localStorage.setItem(details.getAttribute('data-campus-page-guide'), 'seen'); } catch (_) {}
      details.open = false;
      var summary = details.querySelector('summary'); if (summary) summary.focus({ preventScroll: true });
    };
    var pageGuideToggle = function (event) {
      var details = event.target;
      if (!details || !details.matches || !details.matches('[data-campus-page-guide]') || !root.contains(details) || details.open) return;
      try { localStorage.setItem(details.getAttribute('data-campus-page-guide'), 'seen'); } catch (_) {}
    };
    root.addEventListener('click', pageGuideClick);
    root.addEventListener('toggle', pageGuideToggle, true);
    /* reveals */
    var rv = root.querySelectorAll('.rv');
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08 }); rv.forEach(function (n) { io.observe(n); }); }
    else rv.forEach(function (n) { n.classList.add('in'); });
    setTimeout(function () { rv.forEach(function (n) { n.classList.add('in'); }); }, 1800);
    /* progress bars */
    root.querySelectorAll('.prog i[data-w]').forEach(function (i) { requestAnimationFrame(function () { setTimeout(function () { i.style.width = i.getAttribute('data-w') + '%'; }, 150); }); });
    /* check-in */
    root.querySelectorAll('[data-checkin]').forEach(function (box) {
      var btnEl = box.querySelector('button:not([data-uncheck])'), inp = box.querySelector('input'), msg = box.querySelector('.msg');
      /* already checked in: the box holds only the Undo button, so there is nothing here to wire */
      if (!inp || !btnEl || !msg) return;
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
    /* the academic year: term filter, and the whole visible list as all-day calendar events */
    root.querySelectorAll('[data-yearlist]').forEach(function (list) {
      var wrap = list.closest('.bd'); if (!wrap) return;
      var rows = list.querySelectorAll('.yr'), btns = wrap.querySelectorAll('[data-yr]'), none = wrap.querySelector('[data-yrnone]');
      var view = 'next', AHEAD = 8;
      function apply() {
        var shown = 0, n = 0;
        rows.forEach(function (r) {
          var ok;
          if (view === 'next') { ok = r.getAttribute('data-when') !== 'past' && n < AHEAD; if (ok) n++; }
          else ok = r.getAttribute('data-term') === view;
          r.hidden = !ok; if (ok) shown++;
        });
        if (none) none.hidden = shown > 0;
        btns.forEach(function (b) { var on = b.getAttribute('data-yr') === view; b.classList.toggle('on', on); b.classList.toggle('ghost', !on); b.setAttribute('aria-pressed', String(on)); });
      }
      btns.forEach(function (b) { b.addEventListener('click', function () { view = b.getAttribute('data-yr'); apply(); }); });
      apply();
      var dl = wrap.querySelector('[data-yics]');
      if (dl) dl.addEventListener('click', function () {
        var blk = (space.blocks || []).filter(function (x) { return x.type === 'year'; })[0]; if (!blk) return;
        var keep = {}; rows.forEach(function (r, i) { if (!r.hidden) keep[i] = 1; });
        var items = (blk.items || []).slice().sort(function (x, y) { return dnum(x.d) - dnum(y.d); }).filter(function (_, i) { return keep[i]; });
        downloadYearICS(blk, items, view);
      });
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
        if (!p) {
          var rm = root.querySelector('[data-room]');
          if (rm) { var hc = rm.closest('.hc') || rm; if (hc.scrollIntoView) hc.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
          var live = root.querySelector('a[href$="/live/"]'); if (live) location.href = live.getAttribute('href'); return;
        }
        var nb = p.parentElement.querySelector('.nowbar b'); if (nb) nb.textContent = 'Replay, sample picture · ' + title;
        var host = p.closest('.hc') || p; if (host.scrollIntoView) host.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (!p.querySelector('video')) startPlayer(p);
      });
    });
    /* player */
    root.querySelectorAll('[data-player]').forEach(function (p) {
      var poster = p.querySelector('.poster'); poster.addEventListener('click', function () { startPlayer(p); });
    });
    /* the class room: one module, loaded only where the block is */
    if (root.querySelector('[data-room]')) {
      import('/ht/hub/room.js' + V).catch(function (e) {
        var c = root.querySelector('.ht-room-ctl');
        if (c) c.innerHTML = '<p class="ht-room-loading">The room could not load. Reload to try again.</p>';
        try { console.error('ht room', e); } catch (x) {}
      });
    }
    /* the replay page: the same shape — one module, loaded only where its block is */
    if (root.querySelector('#htReplay')) {
      import('/ht/hub/replay.js' + V).catch(function (e) {
        var c = root.querySelector('#htReplay .ht-room-loading');
        if (c) c.textContent = 'The replay page could not load. Reload to try again.';
        try { console.error('ht replay', e); } catch (x) {}
      });
    }
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseTime(t) { var m = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(t || ''); if (!m) return [9, 0]; var hh = +m[1], mm = +(m[2] || 0); var ap = (m[3] || '').toUpperCase(); if (ap === 'PM' && hh < 12) hh += 12; if (ap === 'AM' && hh === 12) hh = 0; return [hh, mm]; }
  /* RFC 5545: content lines fold at 75 octets, continuation lines start with a space.
     Counted in UTF-8 bytes, never splitting a character or a surrogate pair. */
  function icsFold(line) {
    if (line.length < 60) return line;
    var enc = window.TextEncoder ? new TextEncoder() : null, out = '', cur = '', n = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch >= '\uD800' && ch <= '\uDBFF' && i + 1 < line.length) ch += line[++i];
      var b = enc ? enc.encode(ch).length : 1;
      if (n + b > 73) { out += cur + '\r\n '; cur = ''; n = 1; }
      cur += ch; n += b;
    }
    return out + cur;
  }
  function icsJoin(lines) { return lines.map(icsFold).join('\r\n'); }
  function icsText(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function nextDay(d) { var x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + 1); return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()); }
  /* Academic dates are all-day events: DATE values, DTEND exclusive. */
  function downloadYearICS(blk, items, view) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Huston-Tillotson x Taylormade Academy//HT Hub//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsText(blk.calName || 'Huston-Tillotson academic calendar')];
    items.forEach(function (c, i) {
      lines.push('BEGIN:VEVENT',
        'UID:' + c.d.replace(/-/g, '') + '-' + i + '-htyear@ht.taylormadeacademy.com',
        'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
        'DTSTART;VALUE=DATE:' + c.d.replace(/-/g, ''),
        'DTEND;VALUE=DATE:' + nextDay(c.end || c.d),
        'SUMMARY:' + icsText(c.t),
        'DESCRIPTION:' + icsText((c.note ? c.note + '. ' : '') + 'Huston-Tillotson University published academic calendar. Dates and events are subject to change.'),
        'TRANSP:TRANSPARENT',
        'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var blob = new Blob([icsJoin(lines)], { type: 'text/calendar' }); var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'ht-academic-calendar-' + (view || 'all') + '.ics';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
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
    var blob = new Blob([icsJoin(lines)], { type: 'text/calendar' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ((blk.event && blk.event.name) || 'ht-hub').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.ics'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
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
    var calendarPage = document.body.getAttribute('data-space') === 'calendar';
    var sessionPage = ['session','replay'].indexOf(document.body.getAttribute('data-space')) !== -1 && /^htc-[a-f0-9]{24}$/.test(new URLSearchParams(location.search).get('room') || '');
    bar.innerHTML = '<div class="wrap"><span>' + (sessionPage ? '<b>HT classroom</b> · access follows this session’s campus and cohort membership' : calendarPage ? '<b>Academic calendar</b> · reference dates from the University’s published calendar' : '<b>Preview</b> · sample content, built for Huston-Tillotson University') + '</span><span class="who"></span></div>';
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

  document.addEventListener('click', function (e) { document.querySelectorAll('.campus-nav-more[open]').forEach(function (m) { if (!m.contains(e.target)) m.open = false; }); });
  document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; var m = document.querySelector('.campus-nav-more[open]'); if (m) { m.open = false; var sm = m.querySelector('summary'); if (sm) sm.focus(); } });
  window.HTHub = { render: render, boot: boot, esc: esc, icon: icon, leadershipDemoRail: leadershipDemoRail };
  document.addEventListener('DOMContentLoaded', function () {
    var k = document.body.getAttribute('data-space') || 'home';
    if (k === 'messages') k = 'people';
    var params = new URLSearchParams(location.search), demo = params.get('demo');
    var isDemo = ['student','staff','leadership'].indexOf(demo) !== -1;
    if (isDemo) document.querySelectorAll('a[href="/ht/hub/welcome/"]').forEach(function(link) { link.href = '/ht/hub/welcome/?demo=' + encodeURIComponent(demo); });
    if (isDemo && ['session','replay','legacy-live'].indexOf(k) !== -1) { location.replace('/ht/hub/live/?demo=' + encodeURIComponent(demo)); return; }
    if (k === 'live' && params.has('k') && !isDemo) k = 'legacy-live';
    if (['home','welcome','courses','learn','events','community','people','spaces','support','staff','insights','live','success','trust'].indexOf(k) !== -1) {
      import('/ht/hub/campus-app.js' + V).then(function(m){return m.mountCampus(k);}).catch(function(){
        var root=document.getElementById('htRoot');
        if(root)root.innerHTML='<main id="htMain" class="hub-wrap" style="padding-block:60px"><h1>The Hub could not open.</h1><p>Check your connection and reload this page.</p><button class="btn ht" type="button" id="htCampusReload">Try again</button></main>';
        var b=document.getElementById('htCampusReload');if(b)b.addEventListener('click',function(){location.reload();});
      });
      return;
    }
    render(k); boot();
  });
})();
