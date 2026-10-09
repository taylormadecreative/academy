/* js/ai101-stage.js — Nelson's animated screen for AI 101 (/ai101/class/stage/). He shares the window that holds it.
   → / Space / PageDown / click = next beat · ← / PageUp = back · F = full screen · R = restart a timer ·
   H = hide the corner clock. The corner also has buttons for back, next, restart timer and full screen. Each scene is a paused GSAP timeline with labels b0…b{n-1} and 'end'; a beat
   plays from its label to the next. A new press first finishes the running beat, so mashing the key (or a
   clicker double-firing) can never leave a scene half-drawn; a HELD key's auto-repeat is ignored. Reduced
   motion jumps straight to each end state. The spot is kept in the address (#scene.beat), so a reload in the
   middle of class comes back to the same slide. */
const kit = await import('./ai101-kit.js' + new URL(import.meta.url).search);
const { createDeck, isBehind, countdown, untilLabel, splitTokens } = kit;
const gsap = window.gsap;
gsap.defaults({ lazy: false }); // a jump (back, reduced motion) must draw in the same frame, not on the next tick
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DAY = document.getElementById('stg').dataset.date || ''; // the class date, from the course module
const CHECKS = [ // the run of show's hard time checks (CT): the clock turns gold if you're still on an earlier scene
  { at: 19 * 60 + 23, id: 'steer' },    // the 5-part demo should be done
  { at: 19 * 60 + 34, id: 'yourturn' }, // practice starts, wherever you are
  { at: 19 * 60 + 45, id: 'qa' },       // stop practice: the after tap, then questions
  { at: 19 * 60 + 56, id: 'next' },     // the invitation
].map((c) => ({ ...c, date: DAY }));

const canvas = document.getElementById('canvas');
// (10/9, Nelson: "redesign the whole stage … so people are blown away") the keynote look is the default (the page ships
// with .keynote, so it never flashes white); ?look=v1 is the original, kept as the fallback. Set before any timeline is
// built: they measure layout.
const KEYNOTE = new URLSearchParams(location.search).get('look') !== 'v1';
canvas.classList.toggle('keynote', KEYNOTE);
const scenes = [...canvas.querySelectorAll('.scene')].map((el) => ({ el, id: el.dataset.id, beats: +el.dataset.beats || 1, tl: null }));
const deck = createDeck(scenes.map((s) => s.beats));
const checks = CHECKS.map((c) => ({ ...c, scene: scenes.findIndex((s) => s.id === c.id) })).filter((c) => c.scene >= 0);
let running = null, shown = -1;

/* ---- entrances ----
   Every entrance is a fromTo with EXPLICIT end values, never a plain .from(). A .from() reads its end values
   from the element's current style when it initializes, and in a timeline we jump around in (back, reduced
   motion) that can happen after its hidden start was already written, so it "ends" hidden. Seen 10/6 on the
   sample scene's closing line under reduced motion. into() keeps the from-style call sites. */
const NEUTRAL = { autoAlpha: 1, opacity: 1, x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, '--bar': 1 };
const TIMING = ['duration', 'ease', 'stagger', 'delay'];
function into(tl, targets, from, pos) {
  const start = {}, end = {};
  for (const [k, v] of Object.entries(from)) (TIMING.includes(k) ? end : start)[k] = v;
  for (const k of Object.keys(start)) if (k in NEUTRAL) end[k] = NEUTRAL[k];
  return tl.fromTo(targets, start, end, pos);
}

/* ---- scene timelines: the scenes with their own motion; every other scene uses beatTimeline() ---- */
const colorOf = (el) => getComputedStyle(el).getPropertyValue('--c').trim();
const EASE_OUT = 'power4.out';     // ≈ cubic-bezier(.23,1,.32,1): strong ease-out for entrances
const EASE_MOVE = 'power2.inOut';  // things that travel across the screen (the gold bar)
const IN = KEYNOTE ? { autoAlpha: 0, y: 40, scale: 0.97, duration: 0.75, ease: 'expo.out' } // the keynote entrance: further, longer, softer landing
  : { autoAlpha: 0, y: 24, duration: 0.5, ease: EASE_OUT }; // the house entrance
const K = () => parseFloat(canvas.style.getPropertyValue('--k')) || 1;
function local(el, root) { // a box in canvas pixels (1920x1080), whatever the window's scale
  const a = el.getBoundingClientRect(), b = root.getBoundingClientRect(), k = K();
  return { x: (a.left - b.left) / k, y: (a.top - b.top) / k, w: a.width / k, h: a.height / k };
}
const HEADS = '.sc-h,.ti-h,.nl-h';
function appearBeat(tl, el, b) { // everything marked data-beat="b" fades up; gold bars inside sweep in
  let items = el.querySelectorAll(`[data-beat="${b}"]`), heads = [];
  if (KEYNOTE) { // keynote: a headline wipes down out of nothing as it rises (its own clip), then the rest lands
    heads = [...items].filter((x) => x.matches(HEADS) && !x.querySelector('.ti-line'));
    if (heads.length) tl.fromTo(heads, { autoAlpha: 0, y: 50, clipPath: 'inset(-10% -5% 100% -5%)' },
      { autoAlpha: 1, y: 0, clipPath: 'inset(-10% -5% -30% -5%)', duration: 0.9, ease: 'expo.out', stagger: 0.1 });
    items = [...items].filter((x) => !heads.includes(x));
  }
  if (items.length) into(tl, items, { ...IN, stagger: 0.08 }, heads.length ? '<0.15' : undefined); // with its headline, not after it
  const bars = [...items].flatMap((x) => [...x.querySelectorAll('.u-bar')]);
  if (bars.length) into(tl, bars, { '--bar': 0, duration: 0.45, ease: EASE_MOVE }, '-=0.2');
  return tl;
}
export const TIMELINES = {
  title(el) { // keynote: each headline line rises out of its own mask, then the little chat on the right writes itself
    const tl = gsap.timeline({ paused: true }).addLabel('b0'); appearBeat(tl, el, 0);
    if (KEYNOTE) {
      tl.fromTo(el.querySelectorAll('.ti-line > span'), { yPercent: 115 }, { yPercent: 0, duration: 1, stagger: 0.14, ease: 'expo.out' }, 0.05);
      into(tl, el.querySelector('.ti-me'), { autoAlpha: 0, y: 70, duration: 1.1, ease: 'expo.out' }, 0.35); // 10/9: Nelson rises in beside his title
    }
    tl.addLabel('b1'); appearBeat(tl, el, 1);
    return tl.addLabel('end');
  },
  laptop(el) { // Mac steps → the switch slides to Windows and the steps swap → "No app? The website works the same."
    const q = (c) => el.querySelector(c), mac = q('.lp-steps.mac'), win = q('.lp-steps.win');
    const SLIDE = 300; // one .lp-opt wide (css/ai101-stage.css)
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    into(tl, mac.children, { autoAlpha: 0, y: 24, stagger: 0.12, duration: 0.45, ease: EASE_OUT }, '-=0.25');
    tl.addLabel('b1').fromTo(q('.lp-knob'), { x: 0 }, { x: SLIDE, duration: 0.45, ease: EASE_MOVE })
      .fromTo(q('.lp-opt.mac'), { color: '#ffffff' }, { color: '#04123a', duration: 0.3 }, '<')
      .fromTo(q('.lp-opt.win'), { color: '#04123a' }, { color: '#ffffff', duration: 0.3 }, '<')
      .fromTo(mac, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -16, duration: 0.25 }, '<')
      .fromTo(win, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 });
    into(tl, win.children, { autoAlpha: 0, y: 24, stagger: 0.12, duration: 0.45, ease: EASE_OUT }, '<');
    tl.addLabel('b2'); into(tl, q('.lp-web'), { autoAlpha: 0, x: 60, duration: 0.5, ease: EASE_OUT });
    return tl.addLabel('end');
  },
  nolove(el) { // "Don't fall in love with one AI." The three trade places twice: they change all the time.
    const pills = [...el.querySelectorAll('.nl-pill')], SLOT = 380; // pill width + gap (css/ai101-stage.css)
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    into(tl, pills, { autoAlpha: 0, y: 30, scale: 0.9, stagger: 0.1, duration: 0.45, ease: 'back.out(1.4)' }, '-=0.2');
    let cur = [0, 1, 2];
    const shuffle = (slots) => { // slots[i] = where pill i goes; the one jumping furthest arcs up over the others
      const far = slots.reduce((m, sl, i) => (Math.abs(sl - cur[i]) > Math.abs(slots[m] - cur[m]) ? i : m), 0);
      pills.forEach((pl, i) => tl.to(pl, { x: (slots[i] - i) * SLOT, duration: 0.6, ease: EASE_MOVE }, i ? '<' : '>'));
      tl.to(pills[far], { y: -70, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 }, '<');
      cur = slots;
    };
    tl.addLabel('b1'); shuffle([1, 2, 0]); shuffle([2, 0, 1]);
    into(tl, el.querySelector('.nl-foot'), { ...IN, y: 30, duration: 0.55 }, '+=0.1');
    into(tl, el.querySelector('.nl-small'), IN, '-=0.25');
    return tl.addLabel('end');
  },
  prompt5(el) {
    const tl = gsap.timeline({ paused: true });
    const chips = el.querySelectorAll('.p5-chip'), segs = el.querySelectorAll('.p5-seg'), tags = el.querySelectorAll('.p5-tag');
    tl.addLabel('b0');
    into(tl, el.querySelector('.sc-h'), { y: 24, autoAlpha: 0, duration: 0.6, ease: EASE_OUT });
    into(tl, el.querySelector('.sc-h .u-bar'), { '--bar': 0, duration: 0.5, ease: EASE_MOVE }, '-=0.25');
    into(tl, chips, { y: 16, scale: 0.96, autoAlpha: 0, stagger: 0.06, duration: 0.45, ease: 'back.out(1.2)' }, '-=0.3');
    into(tl, el.querySelector('.p5-card'), { y: 16, autoAlpha: 0, duration: 0.45, ease: EASE_OUT }, '-=0.2');
    segs.forEach((seg, i) => {
      const c = colorOf(chips[i]);
      tl.addLabel('b' + (i + 1));
      into(tl, seg, { autoAlpha: 0, duration: 0.01 }); // not .set(): a zero-length tween ON a label fires when the beat before ends
      tl.to(chips[i], { scale: 1.06, backgroundColor: c, color: '#fff', duration: 0.25, ease: 'power2.out' });
      into(tl, seg.querySelectorAll('.w'), { autoAlpha: 0, y: 8, stagger: 0.025, duration: 0.3, ease: EASE_OUT }, '<');
      into(tl, tags[i], { autoAlpha: 0, scale: 0.85, duration: 0.3, ease: 'back.out(1.4)' }, '>-0.1');
      tl.to(chips[i], { scale: 1, duration: 0.2, ease: 'power2.out' });
    });
    tl.addLabel('b6')
      .to(tags, { scale: 1.08, duration: 0.16, stagger: 0.06, ease: 'power2.out', yoyo: true, repeat: 1 }); // all five, working together
    into(tl, el.querySelector('.p5-foot'), { y: 16, autoAlpha: 0, duration: 0.5, ease: EASE_OUT }, '-=0.1');
    return tl.addLabel('end');
  },
  chat(el) { // (10/9, Nelson: "real looking chat box interfaces") the whole loop inside a real-looking Claude window: you type
    // and send (the box drops to the bottom, like the real app), Claude "thinks" (its star turns) and writes back a note with
    // [blanks], "Reply to make it better" (the box lights up), your reply sends, the better note writes itself with every
    // new fact lit. The three steps beside it say what's happening. (10/8: an answer never appears with nothing typed.)
    const q = (c) => el.querySelector(c), app = q('.ch-app'), body = q('.ch-app .aw-body'), thread = q('.ch-app .aw-thread');
    const comp = q('.ch-comp'), greet = q('.cl-greet'), send = q('.ch-comp .cl-send'), ph = q('.cl-ph'), ph2 = q('.cl-ph2');
    const t1 = q('.ch-typed.t1'), t2 = q('.ch-typed.t2'), u1 = q('.ch-u1'), u2 = q('.ch-u2'), a1 = q('.ch-a1'), a2 = q('.ch-a2');
    const v1 = q('.ch-ans-text.v1'), v2 = q('.ch-ans-text.v2'), tag = q('.cw-tag');
    const B = local(body, el), C = local(comp, el);                      // measure first: everything is laid out, shown or not
    const lift = (B.y + B.h * 0.5 - C.h / 2) - C.y;                       // a new chat: the box sits mid-window
    const room = C.y - 28, off = (m) => { const r = local(m, el); return Math.max(0, r.y + r.h - room); };
    const RING = '0 0 0 4px #fdc921, 0 4px 20px rgba(31,30,29,.06)', FLAT = '0 0 0 0px #fdc921, 0 4px 20px rgba(31,30,29,.06)';
    const tl = gsap.timeline({ paused: true });
    const show = (x, pos) => tl.fromTo(x, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, pos);
    const hide = (x, pos, d = 0.15) => tl.fromTo(x, { autoAlpha: 1 }, { autoAlpha: 0, duration: d, immediateRender: false }, pos);
    const think = (a) => { const s = a.querySelector('.cl-think'); // Claude's star turns while it writes
      tl.fromTo(s, { autoAlpha: 0, rotation: 0 }, { autoAlpha: 1, duration: 0.12 }).to(s, { rotation: 120, duration: 0.5, ease: 'none' }).to(s, { autoAlpha: 0, duration: 0.12 }); };
    const press = () => tl.to(send, { scale: 0.86, duration: 0.08, yoyo: true, repeat: 1 });
    tl.addLabel('b0'); appearBeat(tl, el, 0); into(tl, app, IN, '<');
    tl.fromTo(comp, { y: lift, boxShadow: FLAT }, { y: lift, boxShadow: FLAT, duration: 0.01 }, 0);
    [t1, t2, ph2, tag, u1, u2, a1, a2, v2].forEach((x) => tl.fromTo(x, { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 }, 0));
    hide(ph, '+=0.35', 0.1); show(t1, '<');
    into(tl, t1.querySelectorAll('.w'), { autoAlpha: 0, duration: 0.05, stagger: 0.07 });           // you type it
    press(); hide(t1, '>'); hide(greet, '<', 0.3);
    tl.to(comp, { y: 0, duration: 0.6, ease: EASE_MOVE }, '<');                                       // the box drops to the bottom
    tl.fromTo(u1, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: EASE_OUT, immediateRender: false }, '<0.25');
    show(ph2, '<');
    tl.addLabel('b1'); appearBeat(tl, el, 1); show(a1, '<'); think(a1);                               // Claude writes back
    if (off(a1)) tl.to(thread, { y: -off(a1), duration: 0.5, ease: EASE_MOVE }, '<');
    into(tl, v1.querySelectorAll('.w'), { autoAlpha: 0, duration: 0.05, stagger: 0.035 }, '>-0.05');
    tl.addLabel('b2'); appearBeat(tl, el, 2);                                                         // reply to make it better
    tl.fromTo(comp, { boxShadow: FLAT }, { boxShadow: RING, duration: 0.4, immediateRender: false }, '<');
    tl.fromTo(tag, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: EASE_OUT, immediateRender: false }, '<');
    tl.addLabel('b3'); hide(ph2, '<', 0.1); show(t2, '<');
    into(tl, t2.querySelectorAll('.w'), { autoAlpha: 0, duration: 0.05, stagger: 0.05 });
    press(); hide(t2, '>'); hide(tag, '<', 0.25);
    tl.fromTo(comp, { boxShadow: RING }, { boxShadow: FLAT, duration: 0.3, immediateRender: false }, '<');
    tl.fromTo(u2, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: EASE_OUT, immediateRender: false }, '<0.1');
    if (off(u2)) tl.to(thread, { y: -off(u2), duration: 0.5, ease: EASE_MOVE }, '<');
    show(ph2, '<');
    tl.addLabel('b4'); appearBeat(tl, el, 4); show(a2, '<'); show(v2, '<'); think(a2);              // the better note
    if (off(a2)) tl.to(thread, { y: -off(a2), duration: 0.6, ease: EASE_MOVE }, '<');
    into(tl, v2.querySelectorAll('.w'), { autoAlpha: 0, duration: 0.05, stagger: 0.024 }, '>-0.05');
    tl.fromTo(v2.querySelectorAll('.ch-new'), { backgroundColor: 'rgba(253,201,33,0)' },  // light up what the reply added
      { backgroundColor: 'rgba(253,201,33,0.55)', duration: 0.3, stagger: 0.12, ease: 'power1.out' });
    return tl.addLabel('end');
  },
  words(el) { // AI ⊃ generative AI ⊃ LLM; training data streams in; the chatbot is the app around it; then: it can hallucinate
    const r = (c) => el.querySelector('.wd-ring.' + c), d = (i) => el.querySelector('.wd-def.d' + i);
    const pop = { scale: 0.7, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.3)' };
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); into(tl, r('r1'), pop); into(tl, d(0), IN, '-=0.3');
    tl.addLabel('b1'); into(tl, r('r2'), pop); into(tl, d(1), IN, '-=0.3');
    tl.addLabel('b2'); into(tl, r('r3'), pop);
    into(tl, el.querySelectorAll('.wd-page'), { x: -460, y: (i) => (i - 2.5) * 44, rotation: -20, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: 'power2.inOut' }, '-=0.1');
    into(tl, el.querySelector('.wd-pages em'), { autoAlpha: 0, duration: 0.3 });
    into(tl, d(2), IN, '-=0.6');
    tl.addLabel('b3'); into(tl, el.querySelector('.wd-app'), { scale: 1.15, autoAlpha: 0, duration: 0.6, ease: EASE_OUT }); into(tl, d(3), IN, '-=0.3');
    tl.addLabel('b4'); into(tl, el.querySelector('.wd-warn'), { autoAlpha: 0, y: 30, scale: 0.96, duration: 0.5, ease: 'back.out(1.3)' }); // 10/8: never trust it blindly
    return tl.addLabel('end');
  },
  bland(el) { // (10/9) the same request in two real-looking Claude windows: the thin prompt gets a generic post; the 5-part
    // prompt gets one that sounds like this bakery. Each answer writes itself.
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    into(tl, el.querySelectorAll('.bl-win.gray .bl-a .w'), { autoAlpha: 0, duration: 0.05, stagger: 0.03 }, '-=0.2');
    tl.addLabel('b1'); appearBeat(tl, el, 1);
    into(tl, el.querySelectorAll('.bl-win.color .bl-a .w'), { autoAlpha: 0, duration: 0.05, stagger: 0.025 }, '-=0.2');
    return tl.addLabel('end');
  },
  steer(el) { // (10/9) the three follow-ups in a real-looking ChatGPT window. The chat keeps every answer and scrolls (like the
    // real thing); the newest answer flashes gold; the word count beside it follows the newest answer.
    const q = (c) => el.querySelector(c), app = q('.st-app'), thread = q('.st-app .aw-thread'), comp = q('.st-app .gp-comp'), n = q('.st-n');
    const v = (i) => q('.st-v.v' + i), m = (i) => q('.st-me.m' + i), a = (i) => q('.st-a' + i);
    const words = (i) => v(i).textContent.trim().split(/\s+/).length;
    const room = local(comp, el).y - 26, off = (x) => { const r = local(x, el); return Math.max(0, r.y + r.h - room); }; // measure first
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); into(tl, app, IN); into(tl, q('.sw-side'), IN, '<0.1');
    tl.fromTo(thread, { y: -off(a(0)) }, { y: -off(a(0)), duration: 0.01 }, 0);
    [1, 2, 3].forEach((i) => {
      tl.addLabel('b' + i);
      into(tl, m(i), { autoAlpha: 0, y: 30, duration: 0.35, ease: EASE_OUT });                       // your follow-up
      tl.to(thread, { y: -off(a(i)), duration: 0.6, ease: EASE_MOVE }, '<');
      into(tl, a(i), { autoAlpha: 0, y: 12, duration: 0.4, ease: EASE_OUT }, '>-0.15');             // the new answer
      if (i < 3) {
        tl.fromTo(v(i), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, '<')
          .fromTo(a(i), { backgroundColor: 'rgba(253,201,33,0.35)' }, { backgroundColor: 'rgba(253,201,33,0)', duration: 0.9, immediateRender: false }, '<')
          .to(n, { textContent: words(i), snap: { textContent: 1 }, duration: 0.5 }, '<');
      } else into(tl, a(3).querySelectorAll('.st-opt'), { autoAlpha: 0, x: -16, stagger: 0.12, duration: 0.35, ease: EASE_OUT }, '<');
    });
    return tl.addLabel('end');
  },
  models(el) { // (10/9, Nelson: "we also didn't talk about models") Claude's real model menu opens from the model name under
    // the box; each model gets which plan has it; then what bigger and smaller mean, and the rule
    const q = (c) => el.querySelector(c), menu = q('.md-menu'), chip = q('.md-comp .cl-model');
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0); into(tl, q('.md-app'), IN, '<0.1');
    tl.fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 }, 0);
    tl.addLabel('b1').to(chip, { scale: 0.92, duration: 0.08, yoyo: true, repeat: 1 })              // tap the model name
      .fromTo(menu, { autoAlpha: 0, scale: 0.96, y: -10 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.35, ease: EASE_OUT, immediateRender: false });
    into(tl, menu.querySelectorAll('.md-it'), { autoAlpha: 0, x: -12, stagger: 0.06, duration: 0.3, ease: EASE_OUT }, '<0.05');
    tl.addLabel('b2'); into(tl, menu.querySelectorAll('.md-tag'), { autoAlpha: 0, scale: 0.8, stagger: 0.08, duration: 0.3, ease: 'back.out(1.6)' });
    appearBeat(tl, el, 2);
    tl.addLabel('b3'); appearBeat(tl, el, 3);
    return tl.addLabel('end');
  },
  frontier(el) { // (10/9, Nelson: "explain frontier models and AGI … make it creative … cool") the mountain. The markup is the END
    // state (the class page shows it as is). b0: the climbers and the gold frontier line. b1: the years tick, the line climbs, the
    // three overtake each other on the way up and land level, last year's best stay behind. b2: the clouds part on "AGI?". b3: the rule.
    const q = (c) => el.querySelector(c), qa = (c) => [...el.querySelectorAll(c)];
    const line = q('.fr-line'), draw = q('.fr-line-draw'), year = q('.fr-year'), climbers = qa('.fr-c'), ghosts = qa('.fr-ghost');
    const clouds = qa('.fr-cloud'), agi = qa('.fr-agi'), from = +year.dataset.from, to = +year.textContent;
    const endOf = (g) => { // the END translation from the markup, kept before GSAP rewrites the transform (and reused on a rebuild)
      if (!g.dataset.end) g.dataset.end = g.getAttribute('transform') || 'translate(0 0)';
      const m = g.dataset.end.match(/-?[\d.]+/g); return { x: +m[0], y: +m[1] };
    };
    const lineEnd = endOf(line), climbEnd = climbers.map(endOf);
    const at0 = (t, v) => tl.fromTo(t, v, { ...v, duration: 0.01 }, 0); // the start state, written at time 0
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0');
    at0(line, { y: +line.dataset.y0 }); climbers.forEach((c) => at0(c, { x: +c.dataset.x0, y: +c.dataset.y0 }));
    at0(ghosts, { autoAlpha: 0 }); at0(agi, { autoAlpha: 0 }); at0(clouds, { x: 0, y: 0, opacity: 0.96 }); at0(year, { textContent: from });
    appearBeat(tl, el, 0); into(tl, q('.fr-art'), IN, '<0.1');
    into(tl, qa('.fr-dot'), { autoAlpha: 0, scale: 0.3, transformOrigin: '50% 50%', stagger: 0.04, duration: 0.3, ease: 'back.out(2)' }, '<0.25');
    into(tl, climbers, { autoAlpha: 0, scale: 0.3, transformOrigin: '50% 50%', stagger: 0.08, duration: 0.35, ease: 'back.out(2)' }, '<0.1');
    tl.fromTo(draw, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, transformOrigin: '0% 50%', duration: 0.5, ease: EASE_MOVE }, '<0.1');
    into(tl, [q('.fr-line-glow'), q('.fr-line-k'), q('.fr-line-sub')], { autoAlpha: 0, duration: 0.3 }, '<0.25');
    tl.addLabel('b1');
    tl.to(year, { textContent: to, snap: { textContent: 1 }, duration: 1.3, ease: 'none' }, 'b1')
      .to(line, { y: lineEnd.y, duration: 1.3, ease: EASE_MOVE }, 'b1')
      .fromTo(ghosts, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: false }, 'b1+=0.25');
    const paces = ['power3.out', 'power2.in', 'sine.inOut']; // different speeds, so they pass each other on the way up
    climbers.forEach((c, i) => tl.to(c, { x: climbEnd[i].x, y: climbEnd[i].y, duration: 1.15 + i * 0.08, ease: paces[i % 3] }, 'b1'));
    appearBeat(tl, el, 1);
    tl.addLabel('b2');
    tl.to(clouds[0], { x: -150, y: 10, opacity: 0.5, duration: 1, ease: EASE_MOVE }, 'b2').to(clouds[1], { x: 150, y: 10, opacity: 0.5, duration: 1, ease: EASE_MOVE }, 'b2')
      .fromTo(agi, { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, transformOrigin: '50% 50%', duration: 0.6, ease: 'back.out(1.8)', immediateRender: false }, 'b2+=0.45');
    appearBeat(tl, el, 2);
    tl.addLabel('b3'); appearBeat(tl, el, 3);
    return tl.addLabel('end');
  },
  words2026(el) { // (10/9, Nelson: "google says these are terms everyone should know in 2026") a word storm: all 16 blow in from
    // all over and land in their three groups; then the four a beginner meets first light up gold, with a line each; then the tip
    const chips = [...el.querySelectorAll('.w6-chip')], pick = chips.filter((c) => c.classList.contains('pick')), rest = chips.filter((c) => !pick.includes(c));
    const rnd = (i, k) => (Math.sin((i + 1) * k) * 10000) % 1; // a fixed scatter in -1..1, so every rebuild blows the same storm
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    into(tl, chips, { autoAlpha: 0, x: (i) => rnd(i, 12.9898) * 520, y: (i) => rnd(i, 78.233) * 320, rotation: (i) => rnd(i, 37.719) * 28,
      scale: 0.6, duration: 0.75, stagger: 0.035, ease: 'expo.out' }, '<0.15');
    tl.addLabel('b1').to(rest, { opacity: 0.4, duration: 0.4 }, 'b1')
      .to(pick, { backgroundColor: '#fdc921', borderColor: '#fdc921', color: '#04123a', scale: 1.06, duration: 0.45, stagger: 0.08, ease: 'back.out(2)' }, 'b1');
    appearBeat(tl, el, 1);
    tl.addLabel('b2'); appearBeat(tl, el, 2);
    return tl.addLabel('end');
  },
  tokens(el) { // the sentence breaks into the pieces an AI counts
    const box = el.querySelector('.tk-chips'), sent = el.querySelector('.tk-sentence'), n = el.querySelector('.tk-n');
    const toks = splitTokens(box.dataset.text);
    box.replaceChildren(...toks.map((t, i) => { const c = document.createElement('i'); c.className = 'tk-chip'; c.style.setProperty('--i', String(i % 6)); c.textContent = t.trim(); return c; }));
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0); into(tl, sent, IN, '-=0.2');
    tl.addLabel('b1').to(sent, { autoAlpha: 0, y: -20, duration: 0.3 }).to(box, { autoAlpha: 1, duration: 0.01 });
    into(tl, [...box.children], { autoAlpha: 0, y: -30, scale: 0.8, stagger: 0.07, duration: 0.35, ease: 'back.out(1.6)' });
    tl.to(n, { textContent: toks.length, snap: { textContent: 1 }, duration: toks.length * 0.07 }, '<');
    return tl.addLabel('end');
  },
  window(el) { // (10/8 rebuild) your whole chat, re-read for every reply; longer = slower, uses your limit, costs more;
    // full = the start falls out (the AI can't see Ann's name any more). The meter counts the words actually on screen.
    const chat = el.querySelector('.wn-chat'), stack = el.querySelector('.wn-stack'), msgs = [...stack.children];
    const n = el.querySelector('.wn-n'), bar = el.querySelector('.wn-bar i'), full = el.querySelector('.wn-full');
    const wc = (k) => msgs.slice(0, k).reduce((a, m) => a + m.textContent.trim().split(/\s+/).length, 0);
    const SEEN = 6, cap = wc(SEEN) / 0.85;                                     // 6 messages fill it to 85%
    const inner = chat.clientHeight - parseFloat(getComputedStyle(chat).paddingTop) - parseFloat(getComputedStyle(chat).paddingBottom);
    const last = msgs[msgs.length - 1], shift = Math.max(0, last.offsetTop + last.offsetHeight - stack.offsetTop - inner); // measure first
    const gone = msgs.filter((m) => m.offsetTop - stack.offsetTop + m.offsetHeight <= shift + 4);
    const count = (k, d) => tl.to(n, { textContent: wc(k), snap: { textContent: 1 }, duration: d }, '<')
      .to(bar, { scaleX: Math.min(1, wc(k) / cap), duration: d, ease: EASE_MOVE }, '<');
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    msgs.slice(0, 2).forEach((m, i) => { into(tl, m, { autoAlpha: 0, y: 16, duration: 0.35, ease: EASE_OUT }, i ? '>' : '-=0.1'); count(i + 1, 0.35); });
    tl.addLabel('b1');
    msgs.slice(2, SEEN).forEach((m, i) => { into(tl, m, { autoAlpha: 0, y: 16, duration: 0.3, ease: EASE_OUT }, i ? '>-0.05' : '>'); count(i + 3, 0.3); });
    into(tl, el.querySelector('.wn-costs'), IN); // not a data-beat: the last click swaps it out (and every data-beat ends drawn)
    tl.addLabel('b2');
    msgs.slice(SEEN).forEach((m, i) => {
      into(tl, m, { autoAlpha: 0, y: 16, duration: 0.35, ease: EASE_OUT }, i ? '>+0.15' : '>');
      if (i === 0) tl.to(stack, { y: -shift, duration: 0.7, ease: EASE_MOVE }, '<').to(gone, { autoAlpha: 0.12, duration: 0.5 }, '<')
        .to(bar, { scaleX: 1, backgroundColor: '#fdc921', duration: 0.5 }, '<').to(full, { autoAlpha: 1, duration: 0.3 }, '<0.2');
    });
    appearBeat(tl, el, 2);
    tl.addLabel('b3').fromTo(el.querySelector('.wn-costs'), { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -30, duration: 0.3, immediateRender: false });
    appearBeat(tl, el, 3); // (10/9, Nelson) so which chat? Same subject: stay. New subject: new chat. Too long: sum it up.
    into(tl, el.querySelectorAll('.wn-rules p'), { autoAlpha: 0, x: 30, stagger: 0.12, duration: 0.35, ease: EASE_OUT }, '-=0.3');
    return tl.addLabel('end');
  },
  check(el) { // it predicts the likeliest word, says a made-up fact with confidence, CHECK IT, never paste
    // (10/8) the right side says HOW it guesses (beat 1) and WHY that goes wrong (beat 2); (10/9) then USE SEARCH, and which
    // sources to trust (beat 4); then it turns into Never paste (beat 5)
    const how = el.querySelector('.ck-how'), why = el.querySelector('.ck-why'), explain = el.querySelector('.ck-explain'), search = el.querySelector('.ck-search');
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    into(tl, [...el.querySelectorAll('.ck-guesses li'), el.querySelector('.ck-note')], { autoAlpha: 0, x: -20, stagger: 0.1, duration: 0.3, ease: EASE_OUT });
    into(tl, el.querySelectorAll('.ck-bar'), { scaleX: 0, transformOrigin: 'left center', stagger: 0.1, duration: 0.5, ease: EASE_OUT }, '<0.1');
    tl.to(el.querySelector('.ck-blank'), { autoAlpha: 0, duration: 0.2 }).to(el.querySelector('.ck-fill'), { autoAlpha: 1, duration: 0.3 });
    into(tl, how, { autoAlpha: 0, x: 40, duration: 0.45, ease: EASE_OUT });
    tl.addLabel('b1'); appearBeat(tl, el, 1); into(tl, why, { autoAlpha: 0, x: 40, duration: 0.45, ease: EASE_OUT }, '-=0.2');
    tl.addLabel('b2').fromTo(el.querySelector('.ck-stamp'), { autoAlpha: 0, scale: 2.2, rotation: -24 }, { autoAlpha: 1, scale: 1, rotation: -10, duration: 0.35, ease: 'power4.in' })
      .to(el.querySelector('.ck-claim'), { x: 8, duration: 0.05, yoyo: true, repeat: 3 });
    into(tl, el.querySelectorAll('.ck-list li'), { autoAlpha: 0, y: 20, stagger: 0.08, duration: 0.3, ease: EASE_OUT });
    tl.addLabel('b3').fromTo(explain, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -30, duration: 0.3, immediateRender: false }); into(tl, search, IN);
    into(tl, el.querySelectorAll('.ck-src'), { autoAlpha: 0, x: 30, stagger: 0.15, duration: 0.35, ease: EASE_OUT }, '-=0.2');
    tl.addLabel('b4').fromTo(search, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -30, duration: 0.3, immediateRender: false }); appearBeat(tl, el, 4);
    into(tl, el.querySelectorAll('.ck-safe li'), { autoAlpha: 0, x: 30, stagger: 0.07, duration: 0.3, ease: EASE_OUT }, '-=0.2');
    return tl.addLabel('end');
  },
  bye(el) { // (10/9, Nelson: "not very creative or colorful") the cards pop in, the phone with the badge rises and a light
    // sweeps across it; last click: thank you, the follow codes, and confetti in the five part colours off the phone
    const q = (c) => el.querySelector(c), phone = q('.by-phone-in');
    const p = local(q('.by-phone'), el), cx = p.x + p.w / 2, cy = p.y + p.h * 0.3; // measure first
    const COLS = ['#0b40e0', '#a16207', '#0b7a53', '#c2410c', '#7048e8', '#fdc921'];  // Role Task Context Format Example + gold
    const bits = Array.from({ length: 42 }, (_, i) => {
      const b = document.createElement('i'); b.className = 'by-bit'; b.style.background = COLS[i % COLS.length]; el.appendChild(b); return b; });
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    into(tl, phone, { autoAlpha: 0, y: 160, duration: 0.8, ease: 'back.out(1.2)' }, '-=0.35');
    tl.fromTo(q('.by-shine'), { x: 0 }, { x: p.w * 1.9, duration: 1.1, ease: 'power2.inOut' }); // a light across the badge
    tl.addLabel('b1'); appearBeat(tl, el, 1);
    bits.forEach((b, i) => { // a fixed spread (no Math.random), so back / reduced motion always land the same
      const a = (i / bits.length) * Math.PI * 2 + (i % 3) * 0.21, r = 240 + ((i * 47) % 260);
      tl.fromTo(b, { autoAlpha: 1, x: cx, y: cy, rotation: 0, scale: 0.5 },
        { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.85 + 160, rotation: (i % 2 ? 1 : -1) * (200 + i * 23), scale: 1,
          duration: 1.5, ease: 'power3.out', immediateRender: false }, 'b1')
        .to(b, { autoAlpha: 0, duration: 0.5 }, 'b1+=1.2');
    });
    return tl.addLabel('end');
  },
  save(el) { // one "About me" card snaps onto every new chat
    const card = el.querySelector('.sv-card'), wins = [...el.querySelectorAll('.sv-win')];
    const c = local(card, el), slots = wins.map((w) => local(w.querySelector('.sv-slot'), el));   // measure first
    const clones = slots.map(() => { const x = card.cloneNode(true); x.className = 'sv-clone'; x.removeAttribute('data-beat'); el.appendChild(x); return x; });
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    clones.forEach((x) => gsap.set(x, { left: c.x, top: c.y, width: c.w, autoAlpha: 0 }));
    tl.addLabel('b1'); into(tl, wins, { autoAlpha: 0, y: 40, stagger: 0.12, duration: 0.4, ease: EASE_OUT });
    clones.forEach((x, i) => tl.to(x, { autoAlpha: 1, duration: 0.01 }, i ? '>-0.4' : '>-0.2')
      .to(x, { left: slots[i].x, top: slots[i].y, width: slots[i].w, fontSize: 17, duration: 0.5, ease: EASE_MOVE }));
    into(tl, el.querySelectorAll('[data-beat="1"]'), IN, '-=0.3'); // the tool names land with the last card, not after it
    // (10/9) 3rd click: each window gives way to that app's real settings screen, the box to paste into ringed in gold
    tl.addLabel('b2').fromTo([...wins, ...clones], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false });
    into(tl, el.querySelectorAll('.sv-shot'), { autoAlpha: 0, y: 30, scale: 0.96, stagger: 0.12, duration: 0.6, ease: 'expo.out' }, '-=0.1');
    return tl.addLabel('end');
  },
  next(el) { // redoing the work every chat → an agent doing the job on repeat → the Oct 23 workshop
    const A = el.querySelector('.nx-a'), B = el.querySelector('.nx-b'), C = el.querySelector('.nx-c');
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); into(tl, A.querySelector('.sc-h'), IN);
    into(tl, A.querySelectorAll('.nx-card'), { autoAlpha: 0, y: 80, stagger: 0.35, duration: 0.45, ease: EASE_OUT });
    tl.addLabel('b1').to(A, { autoAlpha: 0, y: -30, duration: 0.35 }).fromTo(B, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 });
    into(tl, B.querySelector('.sc-h'), IN);
    into(tl, B.querySelector('.nx-agent'), { scale: 0.7, autoAlpha: 0, duration: 0.5, ease: 'back.out(1.6)' });
    into(tl, B.querySelectorAll('.nx-job'), { autoAlpha: 0, x: 40, stagger: 0.25, duration: 0.35, ease: EASE_OUT });
    tl.addLabel('b2').to(B, { autoAlpha: 0, y: -30, duration: 0.35 }).fromTo(C, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 });
    into(tl, [...C.children], { ...IN, stagger: 0.1 });
    return tl.addLabel('end');
  },
};
function beatTimeline(el) { // every scene without its own builder: one beat per data-beat group
  const n = +el.dataset.beats || 1, tl = gsap.timeline({ paused: true });
  for (let b = 0; b < n; b++) { tl.addLabel('b' + b); appearBeat(tl, el, b); tl.to({}, { duration: 0.01 }); }
  return tl.addLabel('end');
}
const timeline = (s) => (s.tl ||= (TIMELINES[s.id] || beatTimeline)(s.el));
const labelAfter = (tl, beat) => (('b' + (beat + 1)) in tl.labels ? 'b' + (beat + 1) : 'end');

/* ---- playback ---- */
function finishRunning() { if (running) { running.progress(1); running = null; } }
function show(index, animate = false) {
  if (shown === index) return;
  const was = shown >= 0 ? scenes[shown].el : null, el = scenes[index].el;
  scenes.forEach((s) => { // a fast clicker can start a new change mid-transition: land the last one first
    if (!s.el.classList.contains('leaving') && !gsap.isTweening(s.el)) return;
    gsap.killTweensOf(s.el); s.el.classList.remove('leaving'); gsap.set(s.el, { clearProps: 'opacity,visibility,transform,filter' });
  });
  scenes.forEach((s, i) => s.el.classList.toggle('on', i === index));
  if (KEYNOTE && animate && was && !REDUCED) { // keynote: the old scene slides off and softens; the new one arrives sharp
    was.classList.add('leaving');
    gsap.fromTo(was, { autoAlpha: 1, x: 0, filter: 'blur(0px)' }, { autoAlpha: 0, x: -70, filter: 'blur(6px)', duration: 0.2, ease: 'power2.in',
      onComplete: () => { was.classList.remove('leaving'); gsap.set(was, { clearProps: 'opacity,visibility,transform,filter' }); } });
    gsap.fromTo(el, { autoAlpha: 0, x: 110, filter: 'blur(8px)' },
      { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 0.7, delay: 0.17, ease: 'expo.out', clearProps: 'opacity,visibility,transform,filter' }); // starts as the old one is nearly gone: two text scenes never sit on top of each other (they smear on a call)
  }
  shown = index; startTimers(el, false); rail(index, animate);
}

/* ---- keynote: the eight steps along the bottom. The step on screen is gold; the ones behind you are white. ---- */
const railEl = document.getElementById('stgRail');
const LAST_STEP = scenes.findIndex((s) => s.id === 'yourturn');
let railAt = -1;
function rail(index, animate) {
  if (!railEl || !KEYNOTE) return;
  const m = /(\d+)/.exec(scenes[index].el.dataset.tagN || ''), n = m ? +m[1] : (index > LAST_STEP ? 9 : 0);
  if (n === railAt) return;
  railAt = n;
  railEl.classList.toggle('off', n === 0); // before class (the countdown) there's no step yet
  railEl.querySelectorAll('li').forEach((li) => {
    const k = +li.dataset.n; li.classList.toggle('done', k < n); li.classList.toggle('now', k === n);
    if (k === n && animate && !REDUCED) gsap.fromTo(li.querySelector('i'), { scaleX: 0 }, { scaleX: 1, duration: 0.9, delay: 0.25, ease: 'expo.out', transformOrigin: 'left center' });
  });
}
function play(p) { // animate the beat p.beat of scene p.scene
  finishRunning(); show(p.scene, true);
  const tl = timeline(scenes[p.scene]);
  const from = 'b' + p.beat, to = labelAfter(tl, p.beat);
  if (REDUCED) { tl.seek(to, false); return; }
  if (!(from in tl.labels)) { tl.seek(to, false); return; }
  tl.seek(from, false); running = tl.tweenFromTo(from, to, { onComplete: () => { running = null; } });
}
function settle(p) { // jump to the END state of beat p.beat, no animation (used by back)
  finishRunning(); show(p.scene);
  const tl = timeline(scenes[p.scene]); tl.seek(labelAfter(tl, p.beat), false);
}
const next = () => { const before = deck.pos(), p = deck.next(); if (p.scene !== before.scene || p.beat !== before.beat) play(p); else finishRunning(); hud(); };
const prev = () => { const p = deck.prev(); settle(p); hud(); };
const go = (i) => { const p = deck.go(i); play(p); hud(); };

/* ---- timers: [data-timer="seconds"] counts down from the FIRST time its scene shows and keeps counting if you
   step away and come back (R restarts it); [data-until="iso"] counts down to a moment (the 7:00 start) ---- */
let tick = null;
const timerEnds = new Map();
function startTimers(el, restart) {
  clearInterval(tick);
  const t = el.querySelector('[data-timer]'), u = el.querySelector('[data-until]');
  if (!t && !u) return;
  if (t && (restart || !timerEnds.has(el.dataset.id))) timerEnds.set(el.dataset.id, Date.now() + (+t.dataset.timer) * 1000);
  const endAt = t ? timerEnds.get(el.dataset.id) : 0;
  const draw = () => {
    if (t) { const left = endAt - Date.now(); t.textContent = countdown(left); t.classList.toggle('done', left <= 0); }
    if (u) { const left = Date.parse(u.dataset.until) - Date.now(); u.textContent = left > 0 ? untilLabel(left) : 'Starting now'; }
  };
  draw(); tick = setInterval(draw, 250);
}

/* ---- HUD: scene count + CT clock, gold when behind a hard time check ---- */
const hudPos = document.getElementById('hudPos'), hudClock = document.getElementById('hudClock'), hudTimer = document.getElementById('hudTimer');
const CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
function hud() {
  const p = deck.pos();
  if (location.hash !== `#${p.scene}.${p.beat}`) history.replaceState(null, '', `#${p.scene}.${p.beat}`); // a reload comes back here
  hudPos.textContent = `${p.scene + 1} / ${scenes.length}`;
  hudTimer.hidden = !scenes[p.scene].el.querySelector('[data-timer]');
  hudClock.textContent = CLOCK.format(new Date()) + ' CT';
  hudClock.classList.toggle('behind', isBehind(Date.now(), p.scene, checks));
  tag(p);
}
setInterval(hud, 15000);

/* ---- the corner tag (10/9, Nelson: "cues on the stage so people can try it themselves … and tag the stage scenes"):
   the class page step this scene goes with, from the scene's data-tag-n / data-tag-t; on a scene with data-try, the
   gold "Try it" line slides in once the scene is fully on screen (its last beat): watch first, then do. It's not a
   [data-beat] element, so the beat checks never count it. ---- */
const tagEl = document.getElementById('stgTag'), tagN = document.getElementById('stgTagN'), tagT = document.getElementById('stgTagT');
const tryEl = document.getElementById('stgTry'), tryText = document.getElementById('stgTryText');
let tagKey = '';
function tag(p) {
  const d = scenes[p.scene].el.dataset, showTry = !!d.try && p.beat >= (+d.beats || 1) - 1, key = p.scene + '|' + showTry;
  if (key === tagKey) return; // the 15 s clock tick must not replay the slide-in
  tagKey = key;
  tagEl.hidden = !d.tagN;
  tagN.textContent = d.tagN || ''; tagT.textContent = d.tagT || ''; tagT.hidden = !d.tagT;
  tryText.textContent = d.try || '';
  gsap.killTweensOf(tryEl);
  if (!showTry) { tryEl.hidden = true; return; }
  tryEl.hidden = false;
  if (REDUCED) gsap.set(tryEl, { autoAlpha: 1, x: 0 });
  else gsap.fromTo(tryEl, { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 0.4, ease: EASE_OUT });
}

/* ---- scale the 1920x1080 canvas into the window, letterboxed ---- */
function fit() {
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  canvas.style.setProperty('--k', k);
  canvas.style.setProperty('--x', (innerWidth - 1920 * k) / 2 + 'px');
  canvas.style.setProperty('--y', (innerHeight - 1080 * k) / 2 + 'px');
}
addEventListener('resize', fit); fit();

/* ---- input ---- */
addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.repeat) return; // a held key must not race through the beats
  const k = ev.key;
  if (k === 'ArrowRight' || k === ' ' || k === 'PageDown') { ev.preventDefault(); next(); }
  else if (k === 'ArrowLeft' || k === 'PageUp') { ev.preventDefault(); prev(); }
  else if (k === 'f' || k === 'F') toggleFull();
  else if (k === 'r' || k === 'R') restartTimer();
  else if (k === 'h' || k === 'H') hudClock.classList.toggle('off');
  else if (k === 'Home') go(0);
});
document.getElementById('stg').addEventListener('click', next);
/* click controls in the corner (10/8, Nelson: "add arrows too so i can click"): the same actions as the keys. A
   mousedown never takes focus, so the next Space or Enter can't press the button a second time. */
function toggleFull() { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); }
function restartTimer() { startTimers(scenes[deck.pos().scene].el, true); }
for (const [id, fn] of [['hudBack', prev], ['hudNext', next], ['hudTimer', restartTimer], ['hudFull', toggleFull]]) {
  const b = document.getElementById(id);
  b.addEventListener('mousedown', (ev) => ev.preventDefault());
  b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); });
}
const hudFull = document.getElementById('hudFull');
document.addEventListener('fullscreenchange', () => { const on = !!document.fullscreenElement; hudFull.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen'); hudFull.title = on ? 'Exit full screen (F key)' : 'Full screen (F key)'; });

/* ---- sign-in wall (fails open: a dead CDN or a session error must never blank Nelson's screen) ---- */
(async () => {
  try {
    const CFG = window.BM_CONFIG || {};
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const { data, error } = await createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY).auth.getSession();
    if (error) { console.warn('stage: session check failed, staying open', error); return; }
    if (!data || !data.session) {
      const a = document.querySelector('#stgGate a[data-next]'); // sign in, then come back to this exact slide
      if (a) a.href = '/login/?next=' + encodeURIComponent(location.pathname + location.hash);
      document.getElementById('stgGate').hidden = false;
    }
  } catch (e) { console.warn('stage: sign-in check skipped', e); }
})();

const start = /^#(\d+)\.(\d+)$/.exec(location.hash); // a reload lands on the slide it left, drawn
if (start) settle(deck.go(+start[1], +start[2])); else play(deck.pos());
hud();
// the last scene's phone shows the real badge: the same drawing as the class page (js/ai101-badge.js), reading "Your name"
(async () => {
  const cv = document.querySelector('.by-badge'), data = document.querySelector('.by-data');
  if (!cv || !data) return;
  try {
    const { drawBadge } = await import('./ai101-badge.js' + new URL(import.meta.url).search);
    const logo = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = '/assets/logo-mark.png'; });
    if (document.fonts && document.fonts.load) await Promise.all(['700 120px "Space Grotesk"', '600 46px "Space Grotesk"', '800 30px Inter', '500 54px Inter', '600 32px Inter']
      .map((f) => document.fonts.load(f))).catch(() => {});
    drawBadge(cv.getContext('2d'), { words: JSON.parse(data.textContent), name: cv.dataset.name, logo });
    cv.dataset.drawn = '1';
  } catch (e) { console.warn('[stage] badge', e); }
})();
window.__stage = { ready: true, pos: () => deck.pos(), go, next, prev, checks, indexOf: (id) => scenes.findIndex((s) => s.id === id) };
