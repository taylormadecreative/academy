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
const IN = { autoAlpha: 0, y: 24, duration: 0.5, ease: EASE_OUT }; // the house entrance
const K = () => parseFloat(canvas.style.getPropertyValue('--k')) || 1;
function local(el, root) { // a box in canvas pixels (1920x1080), whatever the window's scale
  const a = el.getBoundingClientRect(), b = root.getBoundingClientRect(), k = K();
  return { x: (a.left - b.left) / k, y: (a.top - b.top) / k, w: a.width / k, h: a.height / k };
}
function appearBeat(tl, el, b) { // everything marked data-beat="b" fades up; gold bars inside sweep in
  const items = el.querySelectorAll(`[data-beat="${b}"]`);
  if (items.length) into(tl, items, { ...IN, stagger: 0.08 });
  const bars = [...items].flatMap((x) => [...x.querySelectorAll('.u-bar')]);
  if (bars.length) into(tl, bars, { '--bar': 0, duration: 0.45, ease: EASE_MOVE }, '-=0.2');
  return tl;
}
export const TIMELINES = {
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
  chat(el) { // the prompt types itself into You and STAYS there; a copy flies into the AI, the answer writes itself,
    // the loop draws back: "make it better". (10/8, Nelson: an answer with nothing typed "doesn't make sense".)
    // 10/9 (Nelson: "actually show the reply that makes it better"): the first answer is a bland note with blanks; your
    // reply types in under your prompt and flies in the same way; the better answer writes itself with the new parts lit.
    const q = (c) => el.querySelector(c), ai = q('.ch-ai'), typed = q('.ch-typed'), reply = q('.ch-reply');
    const bub = q('.ch-bubble'), bub2 = q('.ch-bubble.b2'), dots = el.querySelectorAll('.ch-dots i');
    const t = local(typed, el), r = local(reply, el);                  // measure first: entrances move things
    gsap.set(bub, { boxSizing: 'border-box', width: t.w, maxWidth: 'none' }); // each copy wraps exactly like its message
    gsap.set(bub2, { boxSizing: 'border-box', width: r.w, maxWidth: 'none' });
    const b = local(ai, el), s = local(bub, el), s2 = local(bub2, el);
    const path = q('.ch-loop .ch-line'), head = q('.ch-loop .ch-head'), len = path.getTotalLength();
    const tl = gsap.timeline({ paused: true });
    const send = (copy, from, at) => tl // lift a copy off the message, fly it into the AI, the AI "thinks"
      .fromTo(copy, { autoAlpha: 0, x: from.x - at.x, y: from.y - at.y, scale: 1 }, { autoAlpha: 1, duration: 0.01 })
      .to(copy, { x: b.x + b.w / 2 - (at.x + at.w / 2), y: b.y + b.h / 2 - (at.y + at.h / 2), scale: 0.35, duration: 0.9, ease: 'power2.inOut' })
      .to(copy, { autoAlpha: 0, duration: 0.2 })
      .to(dots, { y: -12, duration: 0.25, stagger: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '<');
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    into(tl, typed.querySelectorAll('.w'), { autoAlpha: 0, duration: 0.05, stagger: 0.06 }, '-=0.1'); // you type it
    send(bub, t, s);
    tl.addLabel('b1'); appearBeat(tl, el, 1);
    into(tl, q('.ch-ans-text.v1').querySelectorAll('.w'), { autoAlpha: 0, duration: 0.05, stagger: 0.04 }, '-=0.2');
    tl.addLabel('b2').fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1, ease: EASE_MOVE });
    into(tl, head, { autoAlpha: 0, duration: 0.15 });                    // the arrowhead lands when the line arrives
    appearBeat(tl, el, 2);
    tl.addLabel('b3'); appearBeat(tl, el, 3);                             // "then reply": it types in under the prompt
    into(tl, reply.querySelectorAll('.w'), { autoAlpha: 0, duration: 0.05, stagger: 0.05 }, '-=0.1');
    send(bub2, r, s2);
    const v1 = q('.ch-ans-text.v1'), v2 = q('.ch-ans-text.v2');
    tl.addLabel('b4')                                                     // the better answer replaces the bland one
      .fromTo([q('.ch-h1'), v1], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.25, immediateRender: false })
      .fromTo([q('.ch-h2'), v2], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, '<');
    into(tl, v2.querySelectorAll('.w'), { autoAlpha: 0, duration: 0.05, stagger: 0.04 }, '-=0.1');
    tl.fromTo(v2.querySelectorAll('.ch-new'), { backgroundColor: 'rgba(253,201,33,0)' },  // light up what the reply added
      { backgroundColor: 'rgba(253,201,33,0.55)', duration: 0.35, stagger: 0.18, ease: 'power1.out' });
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
  bland(el) { // a thin prompt gets gray filler; the same ask with detail gets a specific answer
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); appearBeat(tl, el, 0);
    into(tl, el.querySelectorAll('.bl-card.gray .bl-bar'), { scaleX: 0, transformOrigin: 'left center', stagger: 0.1, duration: 0.4, ease: EASE_OUT }, '-=0.2');
    tl.addLabel('b1'); appearBeat(tl, el, 1);
    into(tl, el.querySelectorAll('.bl-card.color .bl-bar'), { scaleX: 0, transformOrigin: 'left center', stagger: 0.1, duration: 0.4, ease: EASE_OUT }, '-=0.2');
    return tl.addLabel('end');
  },
  steer(el) { // three follow-ups change one answer; the word count drops, the voice changes, options fan out
    const v = (i) => el.querySelector('.st-v.v' + i), m = (i) => el.querySelector('.st-me.m' + i), n = el.querySelector('.st-n'), ans = el.querySelector('.st-ans');
    const words = (i) => v(i).textContent.trim().split(/\s+/).length;
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('b0'); into(tl, el.querySelector('.st-ans'), IN);
    [1, 2].forEach((i) => {
      tl.addLabel('b' + i); into(tl, m(i), { autoAlpha: 0, x: 60, duration: 0.4, ease: EASE_OUT });
      tl.to(v(i - 1), { autoAlpha: 0, duration: 0.25 }).to(v(i), { autoAlpha: 1, duration: 0.35 })
        .to(n, { textContent: words(i), snap: { textContent: 1 }, duration: 0.5 }, '<')
        .fromTo(ans, { backgroundColor: '#fff6da' }, { backgroundColor: '#ffffff', duration: 0.9, immediateRender: false }, '<'); // a gold flash: it changed
    });
    tl.addLabel('b3'); into(tl, m(3), { autoAlpha: 0, x: 60, duration: 0.4, ease: EASE_OUT });
    into(tl, el.querySelectorAll('.st-opt'), { autoAlpha: 0, y: 30, rotation: (i) => (i - 1) * 6, stagger: 0.12, duration: 0.45, ease: 'back.out(1.4)' });
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
function show(index) {
  if (shown === index) return;
  scenes.forEach((s, i) => s.el.classList.toggle('on', i === index));
  shown = index; startTimers(scenes[index].el, false);
}
function play(p) { // animate the beat p.beat of scene p.scene
  finishRunning(); show(p.scene);
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
window.__stage = { ready: true, pos: () => deck.pos(), go, next, prev, checks, indexOf: (id) => scenes.findIndex((s) => s.id === id) };
