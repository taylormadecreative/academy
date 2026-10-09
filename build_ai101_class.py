"""/ai101/class/ (the follow-along page) and /ai101/class/stage/ (Nelson's animated screen) — AI 101, Oct 9.

All the words live in ai101_course.py; this file only turns them into pages. build_site.py renders both,
so the class page gets the real header and footer. Both are noindex and walled behind a free Academy
sign-in IN THE BROWSER: a sign-up wall, not a lock. The HTML is public, so check_public_copy() refuses to
build a page carrying the list-only price, a room key, or anything on the private list (see _guard_rules).
"""
import hashlib, html, json, os, pathlib, re, sys, urllib.parse
from ai101_course import (EVENT, OUTCOMES, FOLLOW, FOLLOW_LINE, TOOL_ORDER, TOOLS, START_HERE, PARTS, DEMO, DEMO_ALT, STEPS,
                          FOLLOW_UPS, LIBRARY, LEVEL_UPS, TEN_THINGS, FIX_IT, NEVER_PASTE, NEVER_PASTE_SLIP, WORDS_FULL, WORDS_STEP2,
                          WHATS_NEXT, PULSE_Q, PULSE_ENDS, PULSE_NOTE, PRACTICE_TAPS, CHECK_ITEMS, ACCESS,
                          OS_ORDER, OS_NAMES, OS_ON, INSTALL, MAC_WHICH, INSTALL_WEB, NO_LOVE, SETUP,
                          STRENGTHS, STRENGTHS_H, STRENGTHS_INTRO, STRENGTHS_FOOT, TRUST_WARN, STAGE_STEP, STAGE_TAG_OTHER, STAGE_TRY, BADGE,
                          SHOTS, SHOTS_NOTE)

e = html.escape
BAKERY = DEMO["parts"]

_BUILT_IN = ((r"\$\s?65\b", "the list-only $65 price"), (r"[?&](?:amp;)?k=[A-Za-z0-9_-]{6,}", "a room key"))
_GUARD = pathlib.Path(__file__).with_name("public-copy-guard.local")
_warned = []

def _guard_rules():
    """The built-in rules plus the private list. The private list (the Eventbrite code, and anything else that must
    never be public) lives in public-copy-guard.local next to this file, or wherever PUBLIC_COPY_GUARD points. Git
    ignores *.local: naming the code here would publish it. One rule per line: a regex, a TAB, then why."""
    rules, f = list(_BUILT_IN), pathlib.Path(os.environ.get("PUBLIC_COPY_GUARD") or _GUARD)
    if not f.exists():
        if not _warned: _warned.append(1); print(f"build_ai101_class: no private list at {f}; built-in checks only", file=sys.stderr)
        return rules
    for line in f.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith("#"):
            pat, _, why = line.partition("\t")
            rules.append((pat.strip(), why.strip() or "a private code"))
    return rules

LIST_PRICE_WHY = "the list-only $65 price"

def check_public_copy(page, allow_list_price=False):
    """allow_list_price: the STAGE only (Nelson 10/8: "show $65 on the stage too"). The Eventbrite code, room keys and the
    rest of the private list are refused everywhere, the stage included."""
    for pat, why in _guard_rules():
        if allow_list_price and why == LIST_PRICE_WHY: continue
        if re.search(pat, page):
            raise SystemExit(f"build_ai101_class: {why} must never be in a public page")
    return page

def qr_svg(url, title):
    import qrcode, qrcode.image.svg
    svg = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2).to_string(encoding="unicode")
    svg = re.sub(r"<\?xml[^>]*\?>\s*", "", svg)
    return svg.replace("<svg ", f'<svg role="img" aria-label="{e(title)}" class="qr" ', 1)

def words(text):
    """Each word in its own span so a scene can draw a sentence word by word."""
    return " ".join(f'<span class="w" data-anim>{e(w)}</span>' for w in text.split(" "))

P5_ROW = ""  # filled once the app-window helpers exist (they're defined further down): Claude's + / model / send row

def _scene_prompt5():
    chips = "".join(f'<li class="p5-chip" data-part="{p['key']}" data-anim><b>{p['letter']}</b><span>{e(p['name'])}</span></li>' for p in PARTS)
    segs = "".join(f'<span class="p5-seg" data-part="{p['key']}" data-anim>{words(BAKERY[p['key']])}<i class="p5-tag" data-anim>{e(p['name'])}</i></span> '
                   for p in PARTS)
    return f"""<section class="scene sc-prompt5" data-id="prompt5" data-beats="7" aria-label="The 5-part prompt">
<h2 class="sc-h" data-anim>The <span class="u-bar">5-part</span> prompt</h2>
<ol class="p5-chips">{chips}</ol>
<div class="p5-card" data-anim><p class="p5-text">{segs}</p>{P5_ROW}</div>
<p class="p5-foot" data-anim>Five parts. One great answer.</p>
</section>"""


from ai101_course import STAGE, STAGE_DEAL, STAGE_RAIL, MODELS, GOOD, FRONTIER

IG, FB = FOLLOW["instagram"], FOLLOW["facebook"]

def _sc(id_, beats, label, inner):
    return f'<section class="scene sc-{id_}" data-id="{id_}" data-beats="{beats}" aria-label="{e(label)}">{inner}</section>'

def _qr_card(url, title, head, sub, beat=0, cls=""):
    return f'<figure class="qr-card {cls}" data-beat="{beat}">{qr_svg(url, title)}<figcaption><b>{e(head)}</b>{e(sub)}</figcaption></figure>'

FB_QR = lambda beat=0, cls="": _qr_card(FB['url'], 'QR code for the Taylormade Academy Facebook group', 'Join the Facebook group', FB['handle'], beat, cls)
IG_QR = lambda beat=0, cls="", sub="on Instagram": _qr_card(IG['url'], 'QR code for Nelson on Instagram', 'Follow ' + IG['handle'], sub, beat, cls)

def _scene_soon():
    return _sc("soon", 1, "Starting soon", f"""<div class="so-grid"><div>
<p class="sc-kicker" data-beat="0">Taylormade Academy · free live class</p>
<h2 class="sc-h" data-beat="0">{e(STAGE['soon_h'])}</h2>
<p class="so-count" data-beat="0"><span data-until="{EVENT['starts_utc']}">--:--</span></p>
<p class="sc-sub" data-beat="0">{e(STAGE['soon_sub'])}</p>
<p class="so-room" data-beat="0">{e(STAGE['soon_room'])}</p></div>
<div class="so-qrs">{_qr_card(EVENT['class_url'], 'QR code for your AI 101 class page', 'Your class page', 'taylormadeacademy.com/ai101/class', 0, 'main')}</div>
<div class="so-follow">{IG_QR(0, 'row')}{FB_QR(0, 'row')}</div></div>""")

def _scene_title():
    return _sc("title", 2, "AI 101", f"""<div class="ti-lock" data-beat="0"><img src="/assets/logo-mark.webp" alt="" width="84" height="84"><span>Taylormade <b>Academy</b></span></div>
<p class="sc-kicker" data-beat="0">{e(STAGE['title_kicker'])}</p>
<h1 class="ti-h" data-beat="0"><span class="ti-line"><span>AI 101.</span></span><span class="ti-line"><span>Learn to <span class="u-bar">talk</span> to AI.</span></span></h1>
<p class="sc-sub" data-beat="1">{e(STAGE['title_sub'])}</p>
<p class="ti-tap" data-beat="1">{e(STAGE['title_tap'])}</p>
<div class="ti-chat" aria-hidden="true"><p class="tc-b you">{e(STAGE['chat_prompt'])}</p><p class="tc-b ai"><i class="tc-dots"><i></i><i></i><i></i></i></p>
<p class="tc-b ai tc-ans">{e(STAGE['chat_better'].replace('*', '').replace(chr(10), ' '))}</p><p class="tc-b you">{e(STAGE['title_chat_reply'])}</p></div>""")

def _scene_follow():
    return _sc("follow", 2, "Follow me", f"""<h2 class="sc-h" data-beat="0">{e(FOLLOW_LINE)}</h2>
<div class="fo-row">{IG_QR(0, 'big')}{FB_QR(1, 'big')}</div>""")

def _bar_last(text):
    """The house headline move: the gold bar under the last word ("Get it on your laptop." → bar under "laptop")."""
    head, _, last = text.rstrip(".").rpartition(" ")
    return f'{e(head)} <span class="u-bar">{e(last)}</span>' + ("." if text.endswith(".") else "")

def _scene_laptop():
    """Mac, then Windows (the switch slides across, like the one on the class page), then the website fallback."""
    rows = lambda items: "".join(f'<li><b>{i}</b><span>{e(t)}</span></li>' for i, t in enumerate(items, 1))
    return _sc("laptop", 3, "Get it on your laptop", f"""<h2 class="sc-h sm" data-beat="0">{_bar_last(STAGE['laptop_h'])}</h2>
<div class="lp-grid"><div class="lp-main">
<div class="lp-switch" data-beat="0" aria-hidden="true"><i class="lp-knob"></i><span class="lp-opt mac">Mac</span><span class="lp-opt win">Windows</span></div>
<div class="lp-sets"><ol class="lp-steps mac">{rows(STAGE['laptop_mac'])}</ol><ol class="lp-steps win" aria-label="Windows">{rows(STAGE['laptop_win'])}</ol></div>
<p class="lp-also" data-beat="0">{e(STAGE['laptop_also'])}</p></div>
<div class="lp-web" data-beat="2"><h3>{e(STAGE['laptop_web_h'])}</h3><p>{e(STAGE['laptop_web'])}</p><p class="lp-work">{e(STAGE['laptop_work'])}</p><p class="lp-page">{e(STAGE['laptop_page'])}</p></div></div>""")

def _scene_nolove():
    """His line, full screen: the three tools keep trading places. Learn the skill, not the app."""
    h = e(NO_LOVE['h']).replace(" love ", ' <span class="u-bar">love</span> ', 1)
    pills = "".join(f'<li class="nl-pill">{e(t)}</li>' for t in STAGE["nolove_tools"])
    return _sc("nolove", 2, NO_LOVE["h"], f"""<h2 class="sc-h nl-h" data-beat="0">{h}</h2>
<p class="sc-sub" data-beat="0">{e(STAGE['nolove_sub'])}</p>
<ul class="nl-pills" aria-label="Claude, ChatGPT and Gemini">{pills}</ul>
<p class="nl-foot">{e(STAGE['nolove_foot'])}</p><p class="nl-small">{e(STAGE['nolove_small'])}</p>""")

def _scene_strengths():
    """One column per click: Nelson's pick for each AI, with two short facts under it."""
    cols = "".join(f'<div class="sg-col" data-beat="{i}"><p class="sg-n">{e(n)}</p><p class="sg-pick">{e(pick)}</p>'
                   f'<ul>{"".join(f"<li>{e(pt)}</li>" for pt in pts)}</ul></div>' for i, (n, pick, pts) in enumerate(STAGE["strengths"]))
    return _sc("strengths", 3, STAGE["strengths_h"], f"""<h2 class="sc-h sm" data-beat="0">{_bar_last(STAGE['strengths_h'])}</h2>
<div class="sg-row">{cols}</div><p class="sg-foot" data-beat="2">{e(STAGE['strengths_foot'])}</p>""")

def _note(text):
    """A chat answer, word by word: \\n = a line break, [x] = a blank the AI can't fill, *x* = a part the reply added."""
    def seg(part):
        if part.startswith("[") and part.endswith("]"): return f'<span class="ch-blank">{words(part)}</span>'
        if part.startswith("*") and part.endswith("*"): return f'<mark class="ch-new">{words(part[1:-1])}</mark>'
        return words(part.strip()) if part.strip() else ""
    def line(t):
        out = ""
        for part in re.split(r"(\[[^\]]*\]|\*[^*]*\*)", t):
            if not part: continue
            h = seg(part)
            if not h: continue
            glue = "" if not out or part[:1] in ",.!" else " "
            out += glue + h
        return out
    return "<br>".join(line(t) for t in text.split("\n"))

# ---- real-looking app windows (10/9, Nelson: "I want the presentations to be better with real looking chat box interfaces").
# Drawn from his own screens that morning: Claude = warm off-white, answers in a serif, your messages in a soft grey bubble,
# the orange send button and the model under the box; ChatGPT = white, your messages in a black pill, "Ask ChatGPT".
# No logos, no names, no chat history: just the parts of the screen people will look for.
SVG_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
SVG_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
SVG_MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
SVG_SPARK = ('<svg class="cl-spark" viewBox="0 0 24 24" aria-hidden="true">' + "".join(
    f'<rect x="11" y="1.5" width="2" height="9" rx="1" transform="rotate({k * 30} 12 12)"/>' for k in range(12)) + '</svg>')
SVG_ICONS = "".join(f'<i class="gp-ico">{p}</i>' for p in (  # ChatGPT's left rail: home, library, history, explore (shapes only)
    '<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
    '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="12" height="14" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v12"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/></svg>'))

def _bar():
    return '<div class="aw-bar"><i></i><i></i><i></i></div>'

def _cl_comp(extra_cls="", inner=""):
    """Claude's message box: what you type, then + on the left, the model and the orange send button on the right."""
    return (f'<div class="cl-comp {extra_cls}"><div class="cl-in">{inner}</div><div class="cl-row"><span class="cl-plus">{SVG_PLUS}</span>'
            f'<span class="cl-model">{e(STAGE["app_model"])} <i>&#8964;</i></span><span class="cl-send">{SVG_UP}</span></div></div>')

P5_ROW = (f'<div class="cl-row p5-row"><span class="cl-plus">{SVG_PLUS}</span><span class="cl-model">{e(STAGE["app_model"])} <i>&#8964;</i></span>'
          f'<span class="cl-send">{SVG_UP}</span></div>')

def _scene_chat():
    # 10/9: the whole loop inside a real-looking Claude window. 1 you type and send (the box drops to the bottom, like the
    # real app), 2 Claude writes back (a note with [blanks] it can't fill), 3 "Reply to make it better" (the box lights up),
    # 4 your reply types in and sends, 5 the better note writes itself with every new fact lit. Three steps beside it say
    # what's happening (Nelson 10/8: every scene says why).
    steps = (f'<li data-beat="0"><b>1</b><span>{e(STAGE["chat_s1"])}</span></li><li data-beat="1"><b>2</b><span>{e(STAGE["chat_s2"])}</span></li>'
             f'<li data-beat="2"><b>3</b><span>{e(STAGE["chat_loop"])}</span></li>')
    typed = (f'<span class="cl-ph">{e(STAGE["app_ph"])}</span><span class="cl-ph2">{e(STAGE["app_reply_ph"])}</span>'
             f'<span class="ch-typed t1">{words(STAGE["chat_prompt"])}</span><span class="ch-typed t2">{words(STAGE["chat_reply"])}</span>')
    return _sc("chat", 5, "How a chat works", f"""<h2 class="sc-h sm">How a chat works</h2>
<div class="cw-grid"><div class="cw-side"><ol class="cw-steps">{steps}</ol><p class="cw-skill" data-beat="4">{e(STAGE['chat_skill'])}</p></div>
<div class="aw cl ch-app">{_bar()}<div class="aw-body">
<p class="cl-greet">{SVG_SPARK}<span>{e(STAGE['app_greet'])}</span></p>
<div class="aw-thread"><p class="cl-user ch-u1">{e(STAGE['chat_prompt'])}</p>
<div class="cl-ai ch-a1"><i class="cl-think">{SVG_SPARK}</i><p class="ch-ans-text v1">{_note(STAGE['chat_answer'])}</p></div>
<p class="cl-user ch-u2 ch-reply">{e(STAGE['chat_reply'])}</p>
<div class="cl-ai ch-a2"><i class="cl-think">{SVG_SPARK}</i><p class="ch-ans-text v2">{_note(STAGE['chat_better'])}</p></div></div>
{_cl_comp("ch-comp", typed)}<p class="cw-tag">{e(STAGE['chat_loop'])}</p></div></div></div>""")

def _scene_words():
    w = STAGE["words"]
    pages = "".join('<i class="wd-page"></i>' for _ in range(6))
    defs = "".join(f'<p class="wd-def d{i}"><b>{e(a)}</b> {e(b)}</p>' for i, (a, b) in enumerate(w))
    return _sc("words", 5, "The words", f"""<h2 class="sc-h sm">The words</h2>
<div class="wd-grid"><div class="wd-rings" aria-hidden="true">
<div class="wd-ring r1"><span>AI</span></div><div class="wd-ring r2"><span>Generative AI</span></div><div class="wd-ring r3"><span>LLM</span></div>
<div class="wd-pages">{pages}<em>{e(STAGE['words_data'])}</em></div>
<div class="wd-app"><span class="wd-app-bar"><i></i><i></i><i></i></span><span class="wd-app-l">Chatbot</span></div></div>
<div class="wd-defs">{defs}<p class="wd-def d3">{e(STAGE['words_chatbot'])}</p>
<div class="wd-warn" data-beat="4"><b>{e(STAGE['words_warn_h'])}</b><span>{e(STAGE['words_warn'])}</span><em>{e(STAGE['words_warn_rule'])}</em></div></div></div>""")

def _bars(widths, cls):
    return "".join(f'<i class="bl-bar" style="--w:{w}%"></i>' for w in widths)

def _scene_bland():
    # 10/9 (Nelson: "real looking chat box interfaces"): the same request twice, in two real-looking Claude windows. Left: the
    # thin prompt and the generic post it gets. Right: the 5-part prompt and the post that sounds like one bakery.
    def win(cls, beat, prompt, answer, note):
        return (f'<div class="bl-col" data-beat="{beat}"><div class="aw cl bl-win {cls}">{_bar()}<div class="aw-body"><div class="aw-thread">'
                f'<p class="cl-user bl-q">{e(prompt)}</p><div class="cl-ai"><p class="bl-a">{words(answer)}</p></div></div></div></div>'
                f'<p class="bl-note">{e(note)}</p></div>')
    return _sc("bland", 2, "Why answers are bland", f"""<h2 class="sc-h sm" data-beat="0">{e(STAGE['bland_foot'])}</h2>
<div class="bl-row">{win("gray", 0, STAGE['bland_left_h'], STAGE['bland_answer'], STAGE['bland_left_note'])}
{win("color", 1, GOOD, STAGE['steer_answer'], STAGE['bland_right_note'])}</div>
<p class="st-note bl-ex">{e(STAGE['steer_note'])}</p>""")

def _gp_comp():
    return (f'<div class="gp-comp"><span class="gp-plus">{SVG_PLUS}</span><span class="gp-ph">{e(STAGE["gpt_ph"])}</span>'
            f'<span class="gp-mic">{SVG_MIC}</span><span class="gp-send">{SVG_UP}</span></div>')

def _scene_steer():
    # 10/9: the same three follow-ups inside a real-looking ChatGPT window. The chat keeps every answer (like the real
    # thing) and scrolls; the newest answer lights up gold for a moment; the word count beside it follows the newest answer.
    fu = DEMO["follow_ups"]
    opts = "".join(f'<li class="st-opt">{e(o)}</li>' for o in STAGE["steer_options"])
    first = GOOD  # the 5-part prompt from Step 4: steering starts from its answer
    return _sc("steer", 4, "Steer it", f"""<h2 class="sc-h sm">Steer it. <span class="u-bar">Don't</span> start over.</h2>
<div class="sw-grid"><div class="sw-side"><p class="sw-lead">{e(STAGE['steer_lead'])}</p>
<p class="st-count">This answer: <b class="st-n">{len(STAGE['steer_answer'].split())}</b> words</p><p class="st-note">{e(STAGE['steer_note'])}</p></div>
<div class="aw gp st-app">{_bar()}<div class="aw-body"><div class="gp-rail">{SVG_ICONS}</div><div class="gp-top"><span class="on">Chat</span><span>Work</span></div>
<div class="aw-thread"><p class="gp-user st-u0">{e(first)}</p>
<div class="gp-ai st-a0"><p class="st-v v0">{e(STAGE['steer_answer'])}</p></div>
<p class="gp-user st-me m1">{e(fu[0])}</p><div class="gp-ai st-a1"><p class="st-v v1">{e(STAGE['steer_short'])}</p></div>
<p class="gp-user st-me m2">{e(fu[1])}</p><div class="gp-ai st-a2"><p class="st-v v2">{e(STAGE['steer_grandma'])}</p></div>
<p class="gp-user st-me m3">{e(fu[2])}</p><div class="gp-ai st-a3"><ol class="st-opts">{opts}</ol></div></div>
{_gp_comp()}</div></div></div>""")

def _scene_models():
    # 10/9 (Nelson: "we also didn't talk about models … sonnet and fable for claude"): Claude's real model menu (his screen,
    # 10/9), each model with its own one-line description and which plan has it; then what bigger and smaller mean.
    M = MODELS
    items = "".join(f'<div class="md-it{" on" if n == M["pick"] else ""}"><div><b>{e(n)}</b><span>{e(d)}</span></div>'
                    f'<em class="md-tag{" free" if p == "Free" else ""}">{e(p)}</em>{"<i class=md-check>&#10003;</i>" if n == M["pick"] else ""}</div>'
                    for n, d, p in M["claude"])
    notes = "".join(f'<p class="md-note" data-beat="2"><b>{e(k)}</b> {e(v)}</p>' for k, v in M["notes"])
    return _sc("models", 4, "Pick a model", f"""<h2 class="sc-h sm" data-beat="0">{_bar_last(M['h'])}</h2>
<p class="sc-sub" data-beat="0">{e(M['sub'])}</p>
<div class="md-grid"><div class="aw cl md-app">{_bar()}<div class="aw-body">
<div class="md-menu">{items}<div class="md-sep"></div><div class="md-row"><span>{e(M['effort'][0])}</span><span class="md-dim">{e(M['effort'][1])} &#8250;</span></div>
<div class="md-row"><span>{e(M['more'])}</span><span class="md-dim">&#8250;</span></div></div>
{_cl_comp("md-comp", '<span class="cl-ph">' + e(STAGE["app_ph"]) + '</span>')}</div></div>
<div class="md-side">{notes}<p class="md-rule" data-beat="3">{e(M['rule'])}</p><p class="md-also" data-beat="3">{e(M['also'])}</p></div></div>""")

# The frontier mountain (10/9, Nelson: "explain what frontier models are and AGI is … make it creative … cool"), shared by the
# stage scene and the class page. The markup is the END state: the gold line high up, Claude, ChatGPT and Gemini level at it,
# last year's best left lower ("everyday now"), the clouds parted on the "AGI?" peak. The stage climbs into it from data-x0/y0.
_FR_F0, _FR_F1 = 470, 300   # the frontier line: where it starts, where it ends (SVG y; the SVG is drawn 1:1 on the stage)
_FR_CLIMB = (("Claude", (430, 482), (812, 312)), ("ChatGPT", (600, 470), (566, 312)), ("Gemini", (786, 486), (690, 312)))
_FR_STARS = ((70, 160), (150, 70), (250, 200), (330, 110), (430, 60), (860, 70), (930, 180), (1010, 110), (980, 250), (200, 300))
_FR_LOW = ((360, 600), (500, 646), (660, 586), (820, 628), (950, 672), (570, 700), (420, 690))

def _mountain(label):
    F = FRONTIER
    stars = "".join(f'<circle cx="{x}" cy="{y}" r="2.6"/>' for x, y in _FR_STARS)
    low = "".join(f'<circle class="fr-dot" cx="{x}" cy="{y}" r="9"/>' for x, y in _FR_LOW)
    ghosts = "".join(f'<circle class="fr-ghost" cx="{x0}" cy="{y0}" r="12"/>' for _, (x0, y0), _ in _FR_CLIMB)
    gx, gy = _FR_CLIMB[0][1]
    climbers = "".join(
        f'<g class="fr-c" data-x0="{x0}" data-y0="{y0}" transform="translate({x1} {y1})"><circle r="15" class="fr-c-dot"/>'
        f'<text y="-28" text-anchor="middle" class="fr-c-name">{e(n)}</text></g>' for n, (x0, y0), (x1, y1) in _FR_CLIMB)
    return f"""<svg class="fr-art" viewBox="0 0 1080 720" width="1080" height="720" role="img" aria-label="{e(label)}">
<defs><linearGradient id="frSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2f86"/><stop offset="1" stop-color="#04123a"/></linearGradient>
<linearGradient id="frRock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a55c4"/><stop offset=".55" stop-color="#143a9a"/><stop offset="1" stop-color="#0a2366"/></linearGradient>
<radialGradient id="frGlow"><stop offset="0" stop-color="#fdc921" stop-opacity=".75"/><stop offset="1" stop-color="#fdc921" stop-opacity="0"/></radialGradient></defs>
<style>.fr-back{{fill:#0c2a78;opacity:.8}}.fr-rock{{fill:url(#frRock);stroke:rgba(255,255,255,.22);stroke-width:2;stroke-linejoin:round}}
.fr-snow{{fill:#eef3ff}}.fr-trail{{fill:none;stroke:rgba(255,255,255,.32);stroke-width:3;stroke-dasharray:2 12;stroke-linecap:round;stroke-linejoin:round}}
.fr-dot{{fill:#8aa2e0;opacity:.8}}circle.fr-ghost{{fill:#9db7ff;opacity:.9}}text.fr-ghost{{fill:#d5e0ff;font:600 24px var(--font,Inter,sans-serif)}}
.fr-line-glow{{stroke:#fdc921;stroke-opacity:.28;stroke-width:16;stroke-linecap:round}}.fr-line-draw{{stroke:#fdc921;stroke-width:5;stroke-linecap:round}}
.fr-line-k{{fill:#fdc921;font:800 26px var(--display,'Space Grotesk',sans-serif);letter-spacing:.12em}}.fr-line-sub{{fill:#dbe4ff;font:500 24px var(--font,Inter,sans-serif)}}
.fr-c-dot{{fill:#fff;stroke:#fdc921;stroke-width:6}}.fr-c-name{{fill:#fff;font:700 24px var(--display,'Space Grotesk',sans-serif);paint-order:stroke;stroke:#04123a;stroke-width:6px;stroke-linejoin:round}}
.fr-cloud{{fill:#e6edff}}.fr-peak{{fill:#fdc921;font:800 46px var(--display,'Space Grotesk',sans-serif);paint-order:stroke;stroke:#04123a;stroke-width:8px;stroke-linejoin:round}}
.fr-year{{fill:#fdc921;font:800 64px var(--display,'Space Grotesk',sans-serif);letter-spacing:-.02em}}</style>
<rect class="fr-sky" width="1080" height="720" rx="36" fill="url(#frSky)"/>
<g class="fr-stars" fill="#fff" opacity=".55">{stars}</g>
<text class="fr-year" x="56" y="104" data-from="{F['years'][0]}">{F['years'][1]}</text>
<circle class="fr-agi fr-glow" cx="640" cy="112" r="120" fill="url(#frGlow)"/>
<path class="fr-back" d="M0 720 L0 520 L120 430 L230 488 L330 330 L430 400 L520 720 Z"/>
<path class="fr-rock" d="M0 720 L170 520 L250 560 L380 380 L450 420 L560 230 L640 112 L720 210 L790 170 L900 380 L980 350 L1080 520 L1080 720 Z"/>
<path class="fr-snow" d="M596 196 L640 112 L694 200 L668 186 L646 204 L622 186 Z"/>
<path class="fr-trail" d="M360 720 L430 640 L520 612 L470 540 L600 486 L560 410 L660 340 L600 268 L652 196"/>
<g class="fr-low">{low}</g>
<g class="fr-ghosts">{ghosts}<text class="fr-ghost fr-ghost-l" x="{gx - 24}" y="{gy + 46}" text-anchor="end">{e(F['everyday'])}</text></g>
<g class="fr-line" data-y0="{_FR_F0}" transform="translate(0 {_FR_F1})"><line class="fr-line-glow" x1="40" y1="0" x2="1040" y2="0"/>
<line class="fr-line-draw" x1="40" y1="0" x2="1040" y2="0"/><text class="fr-line-k" x="40" y="-22">{e(F['line'].upper())}</text>
<text class="fr-line-sub" x="40" y="34">{e(F['line_sub'])}</text></g>
{climbers}
<g class="fr-cloud fr-cloud-l" transform="translate(-150 10)" opacity=".5"><ellipse cx="560" cy="128" rx="110" ry="46"/><ellipse cx="618" cy="96" rx="80" ry="52"/><ellipse cx="520" cy="166" rx="96" ry="34"/></g>
<g class="fr-cloud fr-cloud-r" transform="translate(150 10)" opacity=".5"><ellipse cx="706" cy="104" rx="90" ry="50"/><ellipse cx="760" cy="140" rx="104" ry="42"/><ellipse cx="672" cy="164" rx="86" ry="32"/></g>
<text class="fr-agi fr-peak" x="640" y="66" text-anchor="middle">{e(F['peak'])}</text>
</svg>"""

def _scene_frontier():
    F = FRONTIER
    return _sc("frontier", 4, "Frontier models and AGI", f"""<h2 class="sc-h sm" data-beat="0">{_bar_last(F['h'])}</h2>
<div class="fr-grid"><div class="fr-side">
<p class="fr-def" data-beat="0"><b>{e(F['frontier_k'])}:</b> {e(F['stage_frontier'])}</p>
<p class="fr-def" data-beat="1">{e(F['stage_moving'])}</p>
<p class="fr-def" data-beat="2"><b>{e(F['agi_k'])}:</b> {e(F['stage_agi'])}</p>
<p class="fr-rule" data-beat="3">{e(F['rule'])}</p></div>
{_mountain("A mountain at night. AI models climb it. A gold line marks the frontier, the highest any AI has climbed today, and it keeps rising. The peak above the clouds is labeled AGI, with a question mark.")}</div>""")

def _scene_tokens():
    return _sc("tokens", 2, "Tokens", f"""<h2 class="sc-h sm" data-beat="0">{e(STAGE['tokens_h'])}</h2>
<p class="sc-sub" data-beat="0">{e(STAGE['tokens_sub'])}</p>
<p class="tk-sentence">{e(STAGE['tokens_sentence'])}</p><div class="tk-chips" data-text="{e(STAGE['tokens_sentence'])}"></div>
<p class="tk-count"><b class="tk-n">0</b> tokens <span>(about)</span></p>""")

def _scene_window():
    """(10/8 rebuild) 1: it's your whole chat, re-read for every reply (the meter counts the words on screen).
    2: a longer chat = more to read: slower, uses up your limit, costs more. 3: full, so the start (Ann's name) falls out."""
    msgs = "".join(f'<p class="wn-msg {who}">{e(t)}</p>' for who, t in STAGE["window_msgs"])
    costs = "".join(f"<li>{e(c)}</li>" for c in STAGE["window_costs"])
    rules = "".join(f"<p><b>{e(k)}</b> {e(v)}</p>" for k, v in STAGE["window_rules"])  # 10/9: 4: same subject = same chat
    return _sc("window", 4, "The context window", f"""<h2 class="sc-h sm" data-beat="0">{e(STAGE['window_h'])}</h2>
<p class="sc-sub" data-beat="0">{e(STAGE['window_sub'])}</p>
<div class="wn-grid"><div class="wn-chat" data-beat="0"><div class="wn-stack">{msgs}</div></div>
<div class="wn-side"><div class="wn-meter" data-beat="0"><p class="wn-meter-l">{e(STAGE['window_meter'])}</p>
<p class="wn-num"><b class="wn-n">0</b> words</p><div class="wn-bar"><i></i><span class="wn-full">Full</span></div><p class="wn-line">{e(STAGE['window_line1'])}</p></div>
<div class="wn-swap"><div class="wn-costs"><p>{e(STAGE['window_more'])}</p><ul>{costs}</ul><p class="wn-cost-note">{e(STAGE['window_cost_note'])}</p></div>
<div class="wn-rules" data-beat="3">{rules}</div></div>
<p class="wn-tip" data-beat="2">{e(STAGE['window_tip'])}</p></div></div>
<p class="wn-ex">{e(STAGE['window_example'])}</p>""")

def _scene_check():
    g = "".join(f'<li><span>{e(w)}</span><i class="ck-bar" style="--w:{v}%"></i></li>' for w, v in STAGE["check_guesses"])
    ck = "".join(f"<li>{e(x)}</li>" for x in STAGE["check_list"])
    safe = "".join(f"<li>{e(x)}</li>" for x in STAGE["safe_items"])
    return _sc("check", 5, "Check it, and keep it safe", f"""<div class="ck-grid"><div class="ck-left">
<h2 class="sc-h sm" data-beat="0">{e(STAGE['check_h'])}</h2>
<p class="ck-sentence" data-beat="0">{e(STAGE['check_sentence'])} <span class="ck-slot"><span class="ck-blank">_____</span><span class="ck-fill">{e(STAGE['check_fill'])}</span></span></p>
<ol class="ck-guesses">{g}</ol><p class="ck-note">{e(STAGE['check_guess_note'])}</p>
<div class="ck-claim" data-beat="1"><p>{e(STAGE['check_claim'])}</p><span>{e(STAGE['check_claim_note'])}</span><b class="ck-stamp">Check it</b></div>
<ul class="ck-list">{ck}</ul></div>
<div class="ck-right"><div class="ck-explain"><div class="ck-how"><b>{e(STAGE['check_how_k'])}</b><p>{e(STAGE['check_how'])}</p></div>
<div class="ck-why"><b>{e(STAGE['check_why_k'])}</b><p>{e(STAGE['check_why'])}</p></div></div>
<div class="ck-search"><b>{e(STAGE['check_search_k'])}</b><p>{e(STAGE['check_search'])}</p>
<p class="ck-src ok"><i>{e(STAGE['check_trust'][0])}</i>{e(STAGE['check_trust'][1])}</p><p class="ck-src no"><i>{e(STAGE['check_skip'][0])}</i>{e(STAGE['check_skip'][1])}</p>
<p class="ck-search-foot">{e(STAGE['check_search_foot'])}</p></div>
<div class="ck-safe" data-beat="4"><h3>{e(STAGE['safe_h'])}</h3><ul>{safe}</ul><p>{e(STAGE['safe_foot'])}</p></div></div></div>""")

def _scene_save():
    tools = "".join(f'<p><b>{e(TOOLS[t]["name"])}</b><span>{e(TOOLS[t]["save_short"])}</span></p>' for t in TOOL_ORDER)
    # 10/9 (Nelson: "show the real dashboards on this part but remove my personal information"): a 3rd click turns each
    # new-chat window into that app's real settings screen (ai101/class/shots/{tool}-save.webp, the class page's own files)
    def real(t):
        p = SHOT_DIR / f"{t}-save.webp"
        src = f"/ai101/class/shots/{p.name}?v={hashlib.md5(p.read_bytes()).hexdigest()[:10]}"
        return (f'<figure class="sv-shot {t}" data-beat="2"><img src="{e(src)}" alt="{e(SHOTS["save"]["alt"].format(name=TOOLS[t]["name"]))}"'
                f' loading="lazy" decoding="async"></figure>')
    wins = "".join(f'<div class="sv-cell"><div class="sv-win"><span class="sv-bar"><i></i><i></i><i></i></span><span class="sv-new">New chat</span><div class="sv-slot"></div></div>{real(t)}</div>'
                   for t in TOOL_ORDER)
    return _sc("save", 3, "Save it once", f"""<h2 class="sc-h sm" data-beat="0">{e(STAGE['save_h'])}</h2>
<div class="sv-card" data-beat="0">{e(STAGE['save_card'])}</div><div class="sv-wins">{wins}</div>
<div class="sv-tools" data-beat="1">{tools}</div>""")

def _scene_yourturn():
    parts = "".join(f'<li data-part="{p["key"]}"><b>{p["letter"]}</b><span><strong>{e(p["name"])}</strong> {e(p["ask"])}</span></li>' for p in PARTS)
    return _sc("yourturn", 1, "Your turn", f"""<div class="yt-grid"><div>
<h2 class="sc-h" data-beat="0">{e(STAGE['yourturn_h'])}</h2><p class="yt-timer" data-beat="0" data-timer="660">11:00</p>
<p class="sc-sub" data-beat="0">{e(STAGE['yourturn_share'])}</p></div><ol class="yt-parts" data-beat="0">{parts}</ol></div>""")

def _scene_qa():
    return _sc("qa", 1, "Questions", f"""<h2 class="sc-h" data-beat="0">{e(STAGE['qa_h'])}</h2>
<p class="yt-timer" data-beat="0" data-timer="600">10:00</p><p class="sc-sub" data-beat="0">{e(STAGE['qa_sub'])}</p>""")

def _scene_next():
    jobs = "".join(f'<li class="nx-job"><i>✓</i>{e(j)}</li>' for j in STAGE["next_jobs"])
    cards = "".join(f'<div class="nx-card c{i}">{e(STAGE["next_card"])}</div>' for i in range(3))
    return _sc("next", 3, "What's next", f"""<div class="nx-a"><h2 class="sc-h sm">{e(STAGE['next_h1'])}</h2><div class="nx-stack">{cards}</div></div>
<div class="nx-b"><h2 class="sc-h sm">{e(STAGE['next_h2'])}</h2><div class="nx-agent"><span class="nx-spin" aria-hidden="true">↻</span><b>Your agent</b></div><ul class="nx-jobs">{jobs}</ul></div>
<div class="nx-c"><div class="nx-c-t"><p class="sc-kicker">The next workshop</p><h2 class="sc-h">{e(EVENT['next_title'])}</h2>
<p class="nx-when">{e(EVENT['next_when'])}<br>{e(EVENT['next_where'])}</p><p class="nx-url">taylormadeacademy.com/agent</p>
<p class="nx-deal"><b>{e(STAGE_DEAL['next_h'])}</b>{e(STAGE_DEAL['next_p'])}</p></div>
{_qr_card('https://taylormadeacademy.com' + EVENT['next_href'], 'QR code for the Build Your First AI Agent page', 'See the workshop', 'taylormadeacademy.com/agent', 0, 'big')}</div>""")

def _scene_bye():
    # 10/9 (Nelson: "not very creative or colorful"): the two things to do as bright cards (1 review, 2 your badge), the
    # 9 PM offer as a navy strip, and their badge on a phone, drawn by js/ai101-badge.js (the class page's own drawing).
    # Last click: thank you, the follow codes, and confetti in the five part colours off the phone.
    review = qr_svg(EVENT['class_url'] + '#review', 'QR code to leave a review')
    return _sc("bye", 2, "Before you go", f"""<div class="by-grid"><div class="by-left">
<h2 class="sc-h" data-beat="0">{e(STAGE['bye_h'])}</h2>
<div class="by-cards"><div class="by-card by-review" data-beat="0"><div><i class="by-n">1</i><b>{e(STAGE['bye_review_t'])}</b><p>{e(STAGE['bye_review_s'])}</p></div><div class="by-qr">{review}</div></div>
<div class="by-card by-share" data-beat="0"><i class="by-n">2</i><b>{e(STAGE['bye_badge_t'])}</b><p>{e(STAGE['bye_badge_s'])}</p><p class="by-tag">{e(STAGE['bye_badge_tag'])}</p></div>
<div class="by-deal-row" data-beat="0"><i class="by-n">3</i><p class="by-deal">{e(STAGE_DEAL['bye'])}</p></div></div>
<p class="by-thanks" data-beat="1">{e(STAGE['bye_thanks'])}</p>
<div class="so-follow">{IG_QR(1, 'row')}{FB_QR(1, 'row')}</div></div>
<div class="by-right"><div class="by-disc" aria-hidden="true"></div><div class="by-phone"><div class="by-phone-in">
<canvas class="by-badge" width="1080" height="1920" role="img" aria-label="{e(STAGE['bye_badge_alt'])}" data-name="{e(STAGE['bye_badge_name'])}"></canvas><i class="by-shine" aria-hidden="true"></i></div></div></div></div>
<script type="application/json" class="by-data">{_badge_words()}</script>""")

SCENE_MARKUP = {"soon": _scene_soon, "title": _scene_title, "follow": _scene_follow, "laptop": _scene_laptop, "nolove": _scene_nolove, "strengths": _scene_strengths,
                "chat": _scene_chat, "words": _scene_words, "models": _scene_models, "frontier": _scene_frontier,
                "bland": _scene_bland, "prompt5": _scene_prompt5, "steer": _scene_steer, "tokens": _scene_tokens, "window": _scene_window,
                "check": _scene_check, "save": _scene_save, "yourturn": _scene_yourturn, "qa": _scene_qa, "next": _scene_next, "bye": _scene_bye}
STAGE_ORDER = ["soon", "title", "follow", "laptop", "nolove", "strengths", "chat", "words", "models", "frontier", "bland", "prompt5", "steer", "tokens", "window", "check", "save",
               "yourturn", "qa", "next", "bye"]

# Click controls for Nelson (10/8 rehearsal: "add arrows too so i can click … so i dont have to remember keys").
# They sit in the corner HUD, outside #stg, so a click here never also counts as a click on the slide.
_HUD_ICON = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="{}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
HUD_BUTTONS = (
    f'<button type="button" class="stg-btn" id="hudBack" tabindex="-1" aria-label="Back one step" title="Back (← key)">{_HUD_ICON.format("M10 3L5 8l5 5")}</button>'
    '<span id="hudPos" aria-hidden="true"></span>'
    f'<button type="button" class="stg-btn" id="hudNext" tabindex="-1" aria-label="Next step" title="Next (→ key)">{_HUD_ICON.format("M6 3l5 5-5 5")}</button>'
    '<button type="button" class="stg-btn stg-btn-text" id="hudTimer" tabindex="-1" title="Start the timer over (R key)" hidden>Restart timer</button>'
    f'<button type="button" class="stg-btn" id="hudFull" tabindex="-1" aria-label="Full screen" title="Full screen (F key)">{_HUD_ICON.format("M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4")}</button>'
)

_SCENE_OPEN = re.compile(r'(<section class="scene [^"]*" data-id="([^"]+)" data-beats="\d+" aria-label="[^"]*")')

def _tag_scenes(markup):
    """The corner tag's words ride on each scene: data-tag-n / data-tag-t (its class page step) and data-try (Nelson 10/9).
    Added AFTER aria-label, which the curriculum build parses up to."""
    def add(m):
        id_ = m.group(2)
        n = STAGE_STEP.get(id_)
        tag_n, tag_t = (f"Step {n}", STEPS[n - 1]["title"]) if n else (STAGE_TAG_OTHER.get(id_, ""), "")
        extra = (f' data-tag-n="{e(tag_n)}" data-tag-t="{e(tag_t)}"' if tag_n else "") + (f' data-try="{e(STAGE_TRY[id_])}"' if id_ in STAGE_TRY else "")
        return m.group(1) + extra
    out, count = _SCENE_OPEN.subn(add, markup)
    assert count == len(STAGE_ORDER), f"tagged {count} scenes, expected {len(STAGE_ORDER)}"
    return out

def _rail():
    """v2 (the keynote look): the class's eight steps along the bottom; the step on screen is gold. Decoration for the
    room (the corner tag says the same in words), so it's hidden from screen readers. Plus three small brand sparkles."""
    steps = "".join(f'<li data-n="{i}"><i></i><span>{e(t)}</span></li>' for i, t in enumerate(STAGE_RAIL, 1))
    spark = '<svg viewBox="0 0 24 24"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z"/></svg>'
    return (f'<div class="stg-rail" id="stgRail" aria-hidden="true"><span class="sr-brand"><img src="/assets/logo-mark.webp" alt="" width="34" height="34">AI 101</span>'
            f'<ol>{steps}</ol></div><div class="stg-spark" aria-hidden="true">{spark * 3}</div>')

def stage_page(head, ver):
    h = head("AI 101 stage — Taylormade Academy", "Nelson's screen for the AI 101 class.", "/ai101/class/stage/").replace(
        "</head>", f'<meta name="robots" content="noindex">\n<link rel="stylesheet" href="/css/ai101-class.css?v={ver}">\n'
                   f'<link rel="stylesheet" href="/css/ai101-stage.css?v={ver}">\n</head>')
    scenes = _tag_scenes("\n".join(SCENE_MARKUP[s]() for s in STAGE_ORDER))
    page = h + f"""
<div class="stg" id="stg" data-date="{EVENT['date']}"><div class="stg-canvas keynote" id="canvas">
{scenes}
{_rail()}
<div class="stg-tag" id="stgTag" hidden><div class="st-try" id="stgTry" hidden><b>Try it</b><span id="stgTryText"></span></div><div class="st-pill"><span class="st-k">Class page</span><b id="stgTagN"></b><span id="stgTagT"></span></div></div>
</div></div>
<div class="stg-hud" id="hud">{HUD_BUTTONS}<span id="hudClock" aria-hidden="true"></span></div>
<div class="stg-gate" id="stgGate" hidden><div><h1>Sign in to open the stage.</h1><p><a class="btn gold" href="/login/?next=%2Fai101%2Fclass%2Fstage%2F" data-next>Sign in <span class="arr" aria-hidden="true">&rarr;</span></a></p></div></div>
<script src="/js/vendor/gsap.min.js?v={ver}"></script>
<script src="/js/config.js?v={ver}"></script>
<script type="module" src="/js/ai101-stage.js?v={ver}"></script>
</body></html>"""
    return check_public_copy(page, allow_list_price=True)  # Nelson 10/8: the stage shows the 48-hour $65 price

from build_ai101 import _DIAGRAM, _DIAGRAM_V

CHECK_SVG = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

def marked(text):
    """Escape, then mark each [BRACKET] so people see what to swap. Copy reads textContent, so what's copied is unchanged."""
    return re.sub(r"\[([^\]]+)\]", r'<mark class="ph">[\1]</mark>', e(text))

def prompt_box(label, text, note="", name=None):
    n = f'<p class="a1c-pr-note">{e(note)}</p>' if note else ""
    return (f'<figure class="a1c-pr"><figcaption>{e(label)}</figcaption><pre>{marked(text)}</pre>{n}'
            f'<button class="btn ghost xs a1c-copy" type="button" data-copy aria-label="Copy: {e(name or label)}">Copy</button></figure>')

def tool_lines(key, cls="a1c-tool"):
    return "".join(f'<p class="{cls}" data-for="{t}">{e(TOOLS[t][key])}</p>' for t in TOOL_ORDER)

def tool_switch():
    btns = "".join(f'<button type="button" data-pick-tool="{t}" aria-pressed="{str(t == "claude").lower()}">{e(TOOLS[t]["name"])}</button>' for t in TOOL_ORDER)
    return f'<div class="a1c-switch" role="group" aria-label="Which AI are you using?">{btns}</div>'

NEW_TAB = '<span class="sr"> (opens in a new tab)</span>'

def os_switch():
    btns = "".join(f'<button type="button" data-pick-os="{o}" aria-pressed="{str(o == "mac").lower()}">{e(OS_NAMES[o])}</button>' for o in OS_ORDER)
    return f'<div class="a1c-switch a1c-os" role="group" aria-label="Which computer are you using?">{btns}</div>'

def picks():
    """Step 2's two switches side by side: the AI (the same switch as Start here, kept in step by the script) and the computer."""
    return (f'<div class="a1c-picks"><div><span class="a1c-pick-l" aria-hidden="true">Your AI</span>{tool_switch()}</div>'
            f'<div><span class="a1c-pick-l" aria-hidden="true">Your computer</span>{os_switch()}</div></div><p class="sr" id="osSay" role="status"></p>')

def install():
    """The switch, then one card per tool x computer (CSS shows the one that matches both switches)."""
    cards = ""
    for t in TOOL_ORDER:
        i = INSTALL[t]
        for o in OS_ORDER:
            btn = f'<a class="btn gold sm" href="{e(i["get_url"])}" target="_blank" rel="noopener">Open {e(i["get"])}{NEW_TAB}</a>'
            steps = "".join(f"<li><div>{e(x)}{btn if n == 0 else ''}</div></li>" for n, x in enumerate(i[o]))  # the button sits under "Go to…"
            which = f'<p class="a1c-needs">{e(MAC_WHICH)}</p>' if o == "mac" else ""
            cards += (f'<div class="a1c-install" data-for="{t}" data-os-for="{o}"><p class="a1c-install-h">{e(TOOLS[t]["name"])} {e(OS_ON[o])}</p>'
                      f'<ol>{steps}</ol><p class="a1c-needs">{e(i[o + "_needs"])}</p>{which}</div>')
    return picks() + cards

def setup():
    """Setting up the free account, one card per tool (the AI switch shows one). The same steps work in the app or the website."""
    return "".join(f'<div class="a1c-setup" data-for="{t}"><p class="a1c-install-h">Set up your free {e(TOOLS[t]["name"])} account</p>'
                   f'<ol>{"".join(f"<li>{e(x)}</li>" for x in SETUP[t]["steps"])}</ol><p class="a1c-needs">{e(SETUP[t]["note"])}</p></div>' for t in TOOL_ORDER)

def install_web():
    return "".join(f'<p class="a1c-tool" data-for="{t}">{e(INSTALL_WEB.format(site=TOOLS[t]["site"], name=TOOLS[t]["name"]))}</p>' for t in TOOL_ORDER)

PICK_LABEL = "Nelson's pick for"

def strengths():
    """Each AI's strong suit, all three side by side (not switched): the headline is Nelson's pick, the lines are checked facts."""
    cards = "".join(f'<div class="a1c-suit" data-suit="{x["tool"]}"><p class="a1c-suit-n">{e(TOOLS[x["tool"]]["name"])}</p>'
                    f'<p class="a1c-suit-pick"><span>{e(PICK_LABEL)}</span> {e(x["pick"])}</p>'
                    f'<ul>{"".join(f"<li>{e(pt)}</li>" for pt in x["points"])}</ul></div>' for x in STRENGTHS)
    return (f'<section class="a1c-suits" aria-label="{e(STRENGTHS_H)}"><p class="a1c-suits-h">{e(STRENGTHS_H)}</p><p class="a1c-suits-sub">{e(STRENGTHS_INTRO)}</p>'
            f'<div class="a1c-suits-row">{cards}</div><p class="a1c-needs">{e(STRENGTHS_FOOT)}</p></section>')

def trust():
    return f'<div class="a1c-trust" role="note"><p class="a1c-trust-h">{e(TRUST_WARN["h"])}</p><p>{e(TRUST_WARN["body"])}</p></div>'

SHOT_DIR = pathlib.Path(__file__).with_name("ai101") / "class" / "shots"

def shot(key):
    """A real screen of each app (SHOTS), one figure per tool that has a file; the AI switch shows the one you picked.
    Tap it to open it full size. ?v= is the file's hash: sw.js serves images cache-first, so a replaced screen needs a new URL."""
    from PIL import Image
    out = ""
    for t in TOOL_ORDER:
        p = SHOT_DIR / f"{t}-{key}.webp"
        if not p.exists(): continue
        with Image.open(p) as im: w, h = im.size
        src = f"/ai101/class/shots/{p.name}?v={hashlib.md5(p.read_bytes()).hexdigest()[:10]}"
        name, s = TOOLS[t]["name"], SHOTS[key]
        out += (f'<figure class="a1c-shot" data-for="{t}"><a href="{e(src)}" target="_blank" rel="noopener">'
                f'<img src="{e(src)}" width="{w}" height="{h}" alt="{e(s["alt"].format(name=name))}" loading="lazy" decoding="async">'
                f'<span class="sr"> (the full-size screen, opens in a new tab)</span></a>'
                f'<figcaption>{e(s["cap"].format(name=name))} <span>{e(SHOTS_NOTE)}</span></figcaption></figure>')
    return out

def models():
    """Step 3's "Pick a model" (MODELS, the same words as the stage's models scene): Claude's real menu screen when the
    AI switch is on Claude, Claude's four models with their own one-line descriptions and plans, bigger vs smaller, the rule."""
    M = MODELS
    items = "".join(f'<li><b>{e(n)}</b> <span>{e(d)}</span> <em class="{"free" if p == "Free" else "paid"}">{e(p)}</em></li>' for n, d, p in M["claude"])
    notes = "".join(f"<li><b>{e(k)}</b> {e(v)}</li>" for k, v in M["notes"])
    return (f'<section class="a1c-models" aria-label="{e(M["h"])}"><p class="a1c-models-h">{e(M["h"])}</p><p>{e(M["sub"])}</p>'
            f'{shot("models")}<p class="a1c-models-in">{e(M["list_h"])}</p><ul class="a1c-models-list">{items}</ul>'
            f'<ul class="a1c-models-notes">{notes}</ul><p class="a1c-models-rule">{e(M["rule"])}</p><p class="a1c-needs">{e(M["also"])}</p></section>')

def frontier():
    """Step 3's "Frontier models and AGI" card: the stage's mountain (its end state), then the two words in full, then the rule."""
    F = FRONTIER
    return (f'<section class="a1c-frontier" aria-label="{e(F["class_h"])}"><p class="a1c-models-h">{e(F["class_h"])}</p>'
            f'<div class="a1c-frontier-art">{_mountain("A mountain at night. A gold line near the top marks the frontier: the highest any AI has climbed today. Claude, ChatGPT and Gemini are level at it. The peak above the clouds is labeled AGI, with a question mark.")}</div>'
            f'<dl class="a1c-frontier-dl"><div><dt>{e(F["frontier_k"])}</dt><dd>{e(F["frontier"])} {e(F["moving"])}</dd></div>'
            f'<div><dt>{e(F["agi_k"])}</dt><dd>{e(F["agi"])} {e(F["agi_note"])}</dd></div></dl>'
            f'<p class="a1c-models-rule">{e(F["rule"])}</p></section>')

def no_love():
    return f'<div class="a1c-love"><p class="a1c-love-h">{e(NO_LOVE["h"])}</p><p>{e(NO_LOVE["body"])}</p></div>'

def follow_box(where):
    ig, fb = FOLLOW["instagram"], FOLLOW["facebook"]
    more = " · ".join(f'<a href="{e(FOLLOW[k]["url"])}" target="_blank" rel="noopener">{e(FOLLOW[k]["label"])}{NEW_TAB}</a>' for k in ("tiktok", "linkedin"))
    return (f'<aside class="a1c-follow a1c-follow-{where}" aria-label="Follow Nelson ({where})"><p class="a1c-follow-h">{e(FOLLOW_LINE)}</p>'
            f'<div class="a1c-follow-row"><a class="btn gold sm" href="{e(ig["url"])}" target="_blank" rel="noopener">Follow {e(ig["handle"])}{NEW_TAB}</a>'
            f'<a class="btn ghost sm" href="{e(fb["url"])}" target="_blank" rel="noopener">Join the {e(fb["handle"])} Facebook group{NEW_TAB}</a></div>'
            f'<p class="a1c-follow-more">Also on {more}</p></aside>')

def pulse(kind, question):
    """The 1-5. Each number's name says where it sits, so a screen reader hears "1 of 5, not at all confident"."""
    ends = {1: ", " + PULSE_ENDS[0].lower(), 5: ", " + PULSE_ENDS[1].lower()}
    btns = "".join(f'<button type="button" class="a1c-pulse-b" data-score="{i}" aria-pressed="false" aria-label="{i} of 5{e(ends.get(i, ""))}">{i}</button>' for i in range(1, 6))
    return (f'<div class="a1c-pulse" data-pulse="{kind}" role="group" aria-label="{e(question)}"><p class="a1c-pulse-q">{e(question)}</p>'
            f'<div class="a1c-pulse-row a1c-scale">{btns}<span class="a1c-pulse-end">{e(PULSE_ENDS[0])}</span><span class="a1c-pulse-end">{e(PULSE_ENDS[1])}</span></div>'
            f'<p class="a1c-pulse-note">{e(PULSE_NOTE)}</p><p class="a1c-pulse-msg" aria-live="polite"></p></div>')

def tap_row(t):
    """A practice tap: "Was the first answer useful?" Not yet / Almost / Yes. Saved like the 1-5 (score = the button's number)."""
    btns = "".join(f'<button type="button" class="a1c-pulse-b a1c-tap" data-score="{i}" aria-pressed="false">{e(l)}</button>' for i, l in enumerate(t["labels"], 1))
    return (f'<div class="a1c-pulse" data-pulse="{t["kind"]}" role="group" aria-label="{e(t["q"])}"><p class="a1c-pulse-q">{e(t["q"])}</p>'
            f'<div class="a1c-pulse-row">{btns}</div><p class="a1c-pulse-msg" aria-live="polite"></p></div>')

def check_item(it):
    """One of the 3 questions. The first answer counts (0059 keeps it); the page says right or not quite, then locks."""
    opts = "".join(f'<button type="button" class="a1c-opt" data-score="{i}" aria-pressed="false">{e(o)}</button>' for i, o in enumerate(it["options"], 1))
    return (f'<div class="a1c-pulse a1c-quiz" data-pulse="{it["kind"]}" data-right="{it["right"]}" data-yes="{e(it["yes"])}" data-no="{e(it["no"])}" '
            f'role="group" aria-label="{e(it["q"])}"><p class="a1c-pulse-q">{e(it["q"])}</p><div class="a1c-opts">{opts}</div>'
            f'<p class="a1c-pulse-msg" aria-live="polite"></p></div>')

def parts_grid():
    return '<ol class="a1c-parts" role="list">' + "".join(
        f'<li data-part="{p["key"]}"><b>{p["letter"]}</b><span class="nm">{e(p["name"])}</span><span class="ask">{e(p["ask"])}</span><span class="tip">{e(p["tip"])}</span></li>'
        for p in PARTS) + "</ol>"

def labelled_bakery():
    segs = " ".join(f'<span class="a1c-seg" data-part="{p["key"]}">{e(DEMO["parts"][p["key"]])}<i>{e(p["name"])}</i></span>' for p in PARTS)
    return f'<div class="a1c-labelled"><p class="a1c-labelled-h">The 5-part prompt, labelled</p><p>{segs}</p></div>'

def labelled_alt():
    names = {p["key"]: p["name"] for p in PARTS}
    segs = " ".join(f'<span class="a1c-seg" data-part="{k}">{e(t)}<i>{e(names[k])}</i></span>' for k, t in DEMO_ALT["parts"])
    return f'<div class="a1c-labelled"><p class="a1c-labelled-h">{e(DEMO_ALT["label"])}</p><p>{segs}</p></div>'

def words_dl(names=None):
    rows = [w for w in WORDS_FULL if names is None or w[0] in names]
    return '<dl class="a1c-words">' + "".join(f'<div><dt>{e(w)}</dt><dd>{e(d)}</dd></div>' for w, d in rows) + "</dl>"

def token_toy():
    return ('<div class="a1c-toy"><label for="toyIn">Type a sentence and watch it split into tokens</label>'
            '<input id="toyIn" type="text" maxlength="200" value="Write a thank-you note to my neighbor." autocomplete="off">'
            '<div class="a1c-toy-out" id="toyOut"></div>'
            '<p class="a1c-toy-n"><b id="toyN">0</b> tokens <span>(an estimate. Every AI splits words a little differently.)</span></p>'
            '<p class="sr" id="toySay" role="status"></p></div>')

def never_paste():
    return ('<div class="a1c-never"><p class="a1c-never-h">Never paste these into an AI</p><ul>'
            + "".join(f"<li>{e(x)}</li>" for x in NEVER_PASTE) + f'</ul><p class="a1c-never-slip">{e(NEVER_PASTE_SLIP)}</p></div>')

def builder():
    boxes = "".join(
        f'<label class="a1c-b-field" data-part="{p["key"]}"><span class="a1c-b-l"><b>{p["letter"]}</b> {e(p["name"])}'
        f'{" <i>(optional)</i>" if p["key"] == "example" else ""}</span><span class="a1c-b-ask">{e(p["ask"])}</span>'
        f'<textarea data-b="{p["key"]}" rows="2" maxlength="600" placeholder="{e(p["placeholder"])}"></textarea></label>' for p in PARTS)
    return (f'<div class="a1c-builder">{boxes}<div class="a1c-b-out"><div class="a1c-b-outh"><b>Your prompt</b>'
            f'<span id="bMissing" aria-live="polite"></span></div><pre id="bOut" class="empty">Fill in the boxes and your prompt shows up here.</pre>'
            f'<div class="a1c-b-acts"><button class="btn gold sm" type="button" id="bCopy">Copy my prompt</button>'
            f'<button class="btn ghost sm" type="button" id="bClear">Start over</button></div></div></div>')

def _badge_words():
    """The badge's words and part colours as JSON, for js/ai101-badge.js (the class page, and the stage's last scene)."""
    return json.dumps({k: v for k, v in BADGE.items() if k.startswith("img_") or k in ("name_needed", "file")}
                      | {"parts": [{"letter": p["letter"], "key": p["key"]} for p in PARTS]}).replace("</", "<\\/")

def badge_section():
    """The end-of-class badge (Nelson 10/9). The page carries the words and the colours as JSON; js/ai101-badge.js draws
    the 1080x1920 image, unlocks it at the end of class, and wires Share / Save / Add to LinkedIn."""
    b = BADGE
    li = "https://www.linkedin.com/profile/add?" + urllib.parse.urlencode({
        "startTask": "CERTIFICATION_NAME", "name": b["cert_name"], "organizationName": b["org"],
        "issueYear": b["issue_year"], "issueMonth": b["issue_month"], "certUrl": b["cert_url"]})
    data = _badge_words()
    h = e(b["h"]).replace("badge", '<span class="u-gold">badge</span>', 1)
    return f"""<section class="a1c-sec a1c-badge" id="badge" data-starts="{EVENT['starts_utc']}" data-unlock-min="{b['unlock_min']}"><div class="wrap">
<span class="kicker">{e(b['kicker'])}</span>
<h2 class="display-m">{h}</h2>
<p class="a1c-lead">{e(b['lead'])}</p>
<p class="a1c-badge-locked" id="badgeLocked">{e(b['locked'])}</p>
<div class="a1c-badge-box" id="badgeBox" hidden>
<div class="a1c-badge-prev"><img id="badgeImg" alt="{e(b['img_alt'])}" width="1080" height="1920"></div>
<div class="a1c-badge-side">
<label class="a1c-f">{e(b['name_label'])}<input id="badgeName" maxlength="40" autocomplete="name" placeholder="{e(b['name_ph'])}"></label>
<p class="a1c-badge-msg" id="badgeMsg" role="status" aria-live="polite"></p>
<div class="a1c-badge-acts"><button class="btn gold" type="button" id="badgeShare">{e(b['share'])}</button>
<a class="btn ghost" id="badgeSave" href="#badge" download="{e(b['file'])}">{e(b['save'])}</a>
<a class="btn ghost" id="badgeLinkedIn" href="{e(li)}" target="_blank" rel="noopener">{e(b['linkedin'])}{NEW_TAB}</a></div>
<p class="a1c-badge-note">{e(b['linkedin_note'])}</p>
</div></div>
<script type="application/json" id="badgeData">{data}</script>
</div></section>"""

def review_form():
    stars = "".join(f'<input type="radio" name="stars" id="st{i}" value="{i}"><label for="st{i}" title="{i} star{"s" if i > 1 else ""}"><span aria-hidden="true">★</span><span class="sr">{i} star{"s" if i > 1 else ""}</span></label>' for i in range(1, 6))
    return f"""<form class="a1c-review" id="reviewForm" novalidate>
<fieldset class="a1c-stars"><legend>Your rating</legend><div class="a1c-stars-row">{stars}</div><p class="a1c-stars-val" aria-live="polite"></p></fieldset>
<label class="a1c-f">What did you learn, and would you recommend it?<textarea name="body" rows="4" minlength="10" maxlength="1200" required></textarea></label>
<label class="a1c-f"><span>Who you are <i>(optional)</i></span><input name="who" maxlength="80" placeholder="Retired teacher, Dallas"></label>
<label class="a1c-f">Your name<input name="name" maxlength="80" autocomplete="name" required></label>
<label class="a1c-consent"><input type="checkbox" name="ok" required><span>Show my review on taylormadeacademy.com as <b data-shows-as>Academy member</b></span></label>
<button class="btn gold" type="submit">Post my review <span class="arr" aria-hidden="true">&rarr;</span></button>
<p class="a1c-review-msg" id="rvMsg" aria-live="polite"></p>
</form>"""

EXTRA = {
    "pulse_before": lambda: pulse("before", PULSE_Q["before"]),
    "diagram": lambda: f'<div class="a1c-diagram">{_DIAGRAM}{_DIAGRAM_V}</div>',
    "words_step2": lambda: words_dl(WORDS_STEP2),
    "parts": lambda: parts_grid() + labelled_bakery(),
    "parts_alt": labelled_alt,
    "never_paste": never_paste,
    "token_toy": token_toy,
    "builder": builder,
    "install": install,
    "install_web": install_web,
    "setup": setup,
    "strengths": strengths,
    "trust": trust,
    "no_love": no_love,
    "models": models,
    "frontier": frontier,
}

def _flow(s, x):
    kind, arg = x
    if kind == "do": return f"<p>{marked(s['do'][arg])}</p>"
    if kind == "prompt": label, text = s["prompts"][arg]; return prompt_box(label, text)
    if kind == "extra": return EXTRA[arg]()
    if kind == "tool": return tool_lines(arg)
    if kind == "shot": return shot(arg)
    raise KeyError(kind)

def step(s):
    """A step's body: its "flow" when it has one (each instruction right above its copy box), else lines, tool, extra, prompts."""
    do = "".join(f"<p>{marked(x)}</p>" for x in s["do"])
    tool = tool_lines(s["tool"]) if s.get("tool") else ""
    extra = EXTRA[s["extra"]]() if s.get("extra") else ""
    prompts = "".join(prompt_box(l, t) for l, t in s.get("prompts", []))
    ideas = ('<div class="a1c-ideas"><p>Stuck? Try one of these:</p><ul>' + "".join(f"<li>{e(i)}</li>" for i in s["ideas"]) + "</ul></div>") if s.get("ideas") else ""
    body = "".join(_flow(s, x) for x in s["flow"]) if s.get("flow") else f"{do}{tool}{extra}{prompts}{ideas}"
    return f"""<li class="a1c-step" id="step-{s['id']}">
<div class="a1c-step-h"><label class="a1c-done"><input type="checkbox" data-step="{s['id']}" aria-label="Step {s['n']} done">{CHECK_SVG}</label>
<span class="a1c-n" aria-hidden="true">{s['n']}</span><div><span class="a1c-when-s">{e(s['time'])} · about {s['min']} min</span><h3>{e(s['title'])}</h3></div></div>
<div class="a1c-step-b">{body}<p class="a1c-check"><b>You should now have:</b> {e(s['check'])}</p></div></li>"""

def library():
    groups = "".join(
        f'<details class="a1c-lib"{" open" if i == 0 else ""}><summary>{e(g["group"])} <span>{len(g["items"])} prompts</span></summary><div class="a1c-lib-grid">'
        + "".join(prompt_box(it["title"], it["prompt"], it.get("note", "")) for it in g["items"]) + "</div></details>"
        for i, g in enumerate(LIBRARY))
    return groups

def level_ups():
    out = []
    for l in LEVEL_UPS:
        body = f'<p>{e(l["why"])}</p>' + (tool_lines(l["tool"]) if l.get("tool") else "") + (prompt_box("Try", l["prompt"], name="Try: " + l["title"]) if l.get("prompt") else "")
        out.append(f'<li><h4>{e(l["title"])}</h4>{body}</li>')
    return '<ol class="a1c-ups" role="list">' + "".join(out) + "</ol>"

def class_page(head, header, footer, ver):
    h = head("AI 101 class page — Taylormade Academy",
             "Follow along with AI 101: every prompt to copy, step by step, plus more to try after class.", "/ai101/class/")
    h = h.replace('<html lang="en">', '<html lang="en" data-tool="claude" data-os="mac">', 1).replace(
        "</head>", f'<meta name="robots" content="noindex">\n<link rel="stylesheet" href="/css/ai101-class.css?v={ver}">\n'
                   f'<noscript><style>#app{{display:block!important}}#gate,#loading{{display:none!important}}</style></noscript>\n</head>')
    nav = "".join(f'<a href="#step-{s["id"]}">{s["n"]}. {e(s["title"])}</a>' for s in STEPS)
    def _start_item(x):
        body = tool_lines(x["tool"], "") if x.get("tool") else f"<p>{e(x['body'])}</p>"
        if x.get("link"): body += f'<p><a href="{e(x["link"][0])}" class="textlink">{e(x["link"][1])}</a></p>'
        return f'<li><h3>{e(x["title"])}</h3>{body}</li>'
    start = "".join(_start_item(x) for x in START_HERE)
    page = h + header("Free class") + f"""
<main class="a1c">
<p id="loading" class="a1c-loading" role="status">Opening your class page…</p>
<div id="gate" class="a1c-gate" hidden><div class="a1c-gate-card">
<span class="kicker gold">{e(EVENT['title'])} · class page</span>
<h1 class="display-l">Sign in to <span class="u-gold">follow</span> along.</h1>
<p class="a1c-gate-sub">This page is free with your Taylormade Academy account, the same one that gets you into the room.</p>
<div class="a1c-gate-acts"><a class="btn gold" href="/login/?next=%2Fai101%2Fclass%2F" data-next>Sign in <span class="arr" aria-hidden="true">&rarr;</span></a>
<a class="btn ghost" href="/login/?mode=join&amp;next=%2Fai101%2Fclass%2F" data-next>Make a free account</a></div>
<p class="a1c-gate-fine">No seat yet? <a class="textlink" href="{EVENT['signup']}">Save your free seat</a> first.</p>
</div></div>

<div id="app" hidden>
<section class="a1c-top on-ink"><div class="wrap">
<div>
<span class="kicker gold">Free live class · class page</span>
<h1 class="display-l">AI 101. Learn to <span class="u-gold">talk</span> to AI.</h1>
<p class="a1c-when">{e(EVENT['date_line'])} · live in the Taylormade Academy room</p>
<div class="a1c-acts"><a class="btn gold" id="joinRoom" href="#" target="_blank" rel="noopener" hidden>Join the room <span class="arr" aria-hidden="true">&rarr;</span>{NEW_TAB}</a>
<a class="btn ghost on-ink-ghost" href="{EVENT['kit']}" download>Download your cheat sheet</a></div>
<p class="a1c-join-note" id="joinNote">Your room link is in your sign-up email. No seat yet? <a href="{EVENT['signup']}">Save a free seat</a>.</p>
</div>
<div class="a1c-out"><h2>By 8 PM you'll be able to:</h2><ol>{''.join(f'<li>{e(o)}</li>' for o in OUTCOMES)}</ol></div>
</div>
<div class="wrap">{follow_box('top')}</div>
</section>

<nav class="a1c-nav" aria-label="Class steps"><div class="wrap"><a href="#start">Start here</a>{nav}<a href="#keep-going">Keep going</a>
<span class="a1c-prog"><span id="prog">0 of {len(STEPS)} steps done</span><span class="a1c-bar" aria-hidden="true"><i id="progBar"></i></span></span></div></nav>

<section class="a1c-sec" id="start"><div class="wrap">
<span class="kicker">Before 7 PM · 5 minutes</span>
<h2 class="display-m">Never used AI? <span class="u-gold">Start</span> here.</h2>
<p class="a1c-lead">Pick the AI you're using. Everything on this page changes to match it. Tonight I use Claude.</p>
{tool_switch()}<p class="sr" id="toolSay" role="status"></p>
<ul class="a1c-start" role="list">{start}</ul>
<div class="a1c-limit">{tool_lines('limit', '')}</div>
<p class="a1c-access"><b>Access.</b> {e(ACCESS)}</p>
</div></section>

<section class="a1c-sec a1c-class" id="class"><div class="wrap">
<span class="kicker">7:00 to 7:45 PM</span>
<h2 class="display-m">The class, <span class="u-gold">step</span> by step.</h2>
<p class="a1c-lead">Follow along with me. Tick the box on each step when you're done. Every prompt has a Copy button under it.</p>
<ol class="a1c-steps" role="list">{''.join(step(s) for s in STEPS)}</ol>
</div></section>

<section class="a1c-sec a1c-bye" id="review"><div class="wrap">
<span class="kicker">7:45 PM, then before you go</span>
<h2 class="display-m">A quick check, then a <span class="u-gold">review</span>.</h2>
{pulse('after', PULSE_Q['after'])}
<div class="a1c-taps">{''.join(tap_row(t) for t in PRACTICE_TAPS)}</div>
<h3 class="a1c-sub">Three quick questions <small>About a minute. No grades.</small></h3>
<div class="a1c-quizzes">{''.join(check_item(q) for q in CHECK_ITEMS)}</div>
<p class="a1c-lead">Tell me how tonight went. I read every review before it goes on the site.</p>
{review_form()}
</div></section>

{badge_section()}

<section class="a1c-sec" id="keep-going"><div class="wrap">
<span class="kicker">After class</span>
<h2 class="display-m">Keep going. <span class="u-gold">30</span> prompts to try.</h2>
<p class="a1c-lead">Swap the words in <mark class="ph">[BRACKETS]</mark> for your own, then paste. Remember the follow-ups: you can always say “shorter”, “warmer” or “give me 3 more”.</p>
{library()}
<h3 class="a1c-sub">Say this next</h3>
<ul class="a1c-chips" role="list">{''.join(f'<li>{e(f)}</li>' for f in FOLLOW_UPS)}</ul>
<h3 class="a1c-sub">Six ways to level up</h3>
{level_ups()}
<h3 class="a1c-sub">10 things to know about AI</h3>
<ol class="a1c-ten">{''.join(f'<li><b>{e(a)}</b> {e(b)}</li>' for a, b in TEN_THINGS)}</ol>
<h3 class="a1c-sub">When something goes wrong</h3>
<dl class="a1c-fix">{''.join(f'<div><dt>{e(a)}</dt><dd>{e(b)}</dd></div>' for a, b in FIX_IT)}</dl>
<h3 class="a1c-sub">Every AI word, in plain English</h3>
{words_dl()}
</div></section>

<section class="a1c-sec a1c-next on-ink" id="next"><div class="wrap">
<span class="kicker gold">What's next</span>
<h2 class="display-m">{e(WHATS_NEXT['agent_h'])}</h2>
<p class="a1c-lead">{e(WHATS_NEXT['agent_p'])}</p>
<p class="a1c-when">{e(EVENT['next_title'])} · {e(EVENT['next_when'])} · {e(EVENT['next_where'])}</p>
<div class="a1c-acts"><a class="btn gold" href="{EVENT['next_href']}">See the workshop <span class="arr" aria-hidden="true">&rarr;</span></a>
<a class="btn ghost on-ink-ghost" href="{EVENT['replay']}">The replay, for members</a></div>
<p class="a1c-lead a1c-deal"><b>{e(WHATS_NEXT['deal_h'])}</b> {e(WHATS_NEXT['deal_p'])}</p>
<p class="a1c-lead">{e(WHATS_NEXT['replay_p'])}</p>
<p class="a1c-lead"><b>Bringing this to your team?</b> {e(WHATS_NEXT['team_p'])}</p>
{follow_box('bottom')}
</div></section>
</div>
</main>
<script type="module">import("/js/ai101-class.js?v={ver}").then((m) => m.boot()).catch((err) => {{ console.error(err); document.getElementById("gate").hidden = true; document.getElementById("app").hidden = false; }});</script>
""" + footer(pop=False)
    return check_public_copy(page)
