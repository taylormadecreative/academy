"""/ai101/class/ (the follow-along page) and /ai101/class/stage/ (Nelson's animated screen) — AI 101, Oct 9.

All the words live in ai101_course.py; this file only turns them into pages. build_site.py renders both,
so the class page gets the real header and footer. Both are noindex and walled behind a free Academy
sign-in IN THE BROWSER: a sign-up wall, not a lock. The HTML is public, so check_public_copy() refuses to
build a page carrying the list-only price, a room key, or anything on the private list (see _guard_rules).
"""
import html, os, pathlib, re, sys
from ai101_course import (EVENT, OUTCOMES, FOLLOW, FOLLOW_LINE, TOOL_ORDER, TOOLS, START_HERE, PARTS, DEMO, DEMO_ALT, STEPS,
                          FOLLOW_UPS, LIBRARY, LEVEL_UPS, TEN_THINGS, FIX_IT, NEVER_PASTE, NEVER_PASTE_SLIP, WORDS_FULL, WORDS_STEP2,
                          WHATS_NEXT, PULSE_Q, PULSE_ENDS, PULSE_NOTE, PRACTICE_TAPS, CHECK_ITEMS, ACCESS,
                          OS_ORDER, OS_NAMES, OS_ON, INSTALL, MAC_WHICH, INSTALL_WEB, NO_LOVE)

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

def check_public_copy(page):
    for pat, why in _guard_rules():
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

def _scene_prompt5():
    chips = "".join(f'<li class="p5-chip" data-part="{p['key']}" data-anim><b>{p['letter']}</b><span>{e(p['name'])}</span></li>' for p in PARTS)
    segs = "".join(f'<span class="p5-seg" data-part="{p['key']}" data-anim>{words(BAKERY[p['key']])}<i class="p5-tag" data-anim>{e(p['name'])}</i></span> '
                   for p in PARTS)
    return f"""<section class="scene sc-prompt5" data-id="prompt5" data-beats="7" aria-label="The 5-part prompt">
<h2 class="sc-h" data-anim>The <span class="u-bar">5-part</span> prompt</h2>
<ol class="p5-chips">{chips}</ol>
<div class="p5-card" data-anim><p class="p5-text">{segs}</p></div>
<p class="p5-foot" data-anim>Five parts. One great answer.</p>
</section>"""


from ai101_course import STAGE

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
<p class="sc-sub" data-beat="0">{e(STAGE['soon_sub'])}</p></div>
<div class="so-qrs">{_qr_card(EVENT['class_url'], 'QR code for your AI 101 class page', 'Your class page', 'taylormadeacademy.com/ai101/class', 0, 'main')}</div>
<div class="so-follow">{IG_QR(0, 'row')}{FB_QR(0, 'row')}</div></div>""")

def _scene_title():
    return _sc("title", 2, "AI 101", f"""<div class="ti-lock" data-beat="0"><img src="/assets/logo-mark.webp" alt="" width="84" height="84"><span>Taylormade <b>Academy</b></span></div>
<p class="sc-kicker" data-beat="0">{e(STAGE['title_kicker'])}</p>
<h1 class="ti-h" data-beat="0">AI 101.<br>Learn to <span class="u-bar">talk</span> to AI.</h1>
<p class="sc-sub" data-beat="1">{e(STAGE['title_sub'])}</p>
<p class="ti-tap" data-beat="1">{e(STAGE['title_tap'])}</p>""")

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

def _scene_chat():
    return _sc("chat", 3, "How a chat works", f"""<h2 class="sc-h sm">How a chat works</h2>
<div class="ch-row"><div class="ch-node ch-you" data-beat="0"><b>You</b><span>type a prompt</span></div>
<div class="ch-node ch-ai" data-beat="0"><b>The AI</b><span>reads it and writes back</span><i class="ch-dots" aria-hidden="true"><i></i><i></i><i></i></i></div>
<div class="ch-node ch-ans" data-beat="1"><b>The answer</b><p class="ch-ans-text">{words(STAGE['chat_answer'])}</p></div>
<div class="ch-bubble" aria-hidden="true">{e(STAGE['chat_prompt'])}</div></div>
<svg class="ch-loop" viewBox="0 0 1640 150" aria-hidden="true"><path class="ch-line" d="M1370 6 V96 H270 V30" fill="none" stroke="#0b40e0" stroke-width="6" stroke-linecap="round"/><path class="ch-head" d="M254 34L270 6L286 34Z" fill="#0b40e0"/></svg>
<p class="ch-loop-l" data-beat="2">{e(STAGE['chat_loop'])}</p>""")

def _scene_words():
    w = STAGE["words"]
    pages = "".join('<i class="wd-page"></i>' for _ in range(6))
    defs = "".join(f'<p class="wd-def d{i}"><b>{e(a)}</b> {e(b)}</p>' for i, (a, b) in enumerate(w))
    return _sc("words", 4, "The words", f"""<h2 class="sc-h sm">The words</h2>
<div class="wd-grid"><div class="wd-rings" aria-hidden="true">
<div class="wd-ring r1"><span>AI</span></div><div class="wd-ring r2"><span>Generative AI</span></div><div class="wd-ring r3"><span>LLM</span></div>
<div class="wd-pages">{pages}<em>{e(STAGE['words_data'])}</em></div>
<div class="wd-app"><span class="wd-app-bar"><i></i><i></i><i></i></span><span class="wd-app-l">Chatbot</span></div></div>
<div class="wd-defs">{defs}<p class="wd-def d3">{e(STAGE['words_chatbot'])}</p></div></div>""")

def _bars(widths, cls):
    return "".join(f'<i class="bl-bar" style="--w:{w}%"></i>' for w in widths)

def _scene_bland():
    return _sc("bland", 2, "Why answers are bland", f"""<h2 class="sc-h sm" data-beat="0">{e(STAGE['bland_foot'])}</h2>
<div class="bl-row"><div class="bl-card gray" data-beat="0"><p class="bl-q">“{e(STAGE['bland_left_h'])}”</p><div class="bl-ans">{_bars([92, 80, 86, 60], 'gray')}</div><p class="bl-note">{e(STAGE['bland_left_note'])}</p></div>
<div class="bl-card color" data-beat="1"><p class="bl-q">“{e(STAGE['bland_left_h'])}” <b>{e(STAGE['bland_right_h'])}</b></p><div class="bl-ans">{_bars([96, 88, 94, 72, 84], 'color')}</div><p class="bl-note">{e(STAGE['bland_right_note'])}</p></div></div>""")

def _scene_steer():
    fu = DEMO["follow_ups"]
    opts = "".join(f'<li class="st-opt">{e(o)}</li>' for o in STAGE["steer_options"])
    return _sc("steer", 4, "Steer it", f"""<h2 class="sc-h sm">Steer it. <span class="u-bar">Don't</span> start over.</h2>
<div class="st-chat"><div class="st-ans"><p class="st-v v0">{e(STAGE['steer_answer'])}</p><p class="st-v v1">{e(STAGE['steer_short'])}</p><p class="st-v v2">{e(STAGE['steer_grandma'])}</p>
<span class="st-count"><b class="st-n">{len(STAGE['steer_answer'].split())}</b> words</span></div>
<div class="st-mine"><p class="st-me m1">{e(fu[0])}</p><p class="st-me m2">{e(fu[1])}</p><p class="st-me m3">{e(fu[2])}</p><ul class="st-opts">{opts}</ul></div></div>
<p class="st-note">{e(STAGE['steer_note'])}</p>""")

def _scene_tokens():
    return _sc("tokens", 2, "Tokens", f"""<h2 class="sc-h sm" data-beat="0">{e(STAGE['tokens_h'])}</h2>
<p class="sc-sub" data-beat="0">{e(STAGE['tokens_sub'])}</p>
<p class="tk-sentence">{e(STAGE['tokens_sentence'])}</p><div class="tk-chips" data-text="{e(STAGE['tokens_sentence'])}"></div>
<p class="tk-count"><b class="tk-n">0</b> tokens <span>(about)</span></p>""")

def _scene_window():
    chips = "".join(f'<i class="wn-chip">{e(w)}</i>' for w in STAGE["window_words"].split(" "))
    return _sc("window", 2, "The context window", f"""<h2 class="sc-h sm" data-beat="0">{e(STAGE['window_h'])}</h2>
<p class="sc-sub" data-beat="0">{e(STAGE['window_sub'])}</p>
<div class="wn-box" data-beat="0"><span class="wn-l">What the AI can keep in mind</span><div class="wn-track">{chips}</div></div>
<p class="wn-tip">{e(STAGE['window_tip'])}</p>""")

def _scene_check():
    g = "".join(f'<li><span>{e(w)}</span><i class="ck-bar" style="--w:{v}%"></i></li>' for w, v in STAGE["check_guesses"])
    ck = "".join(f"<li>{e(x)}</li>" for x in STAGE["check_list"])
    safe = "".join(f"<li>{e(x)}</li>" for x in STAGE["safe_items"])
    return _sc("check", 4, "Check it, and keep it safe", f"""<div class="ck-grid"><div class="ck-left">
<h2 class="sc-h sm" data-beat="0">{e(STAGE['check_h'])}</h2>
<p class="ck-sentence" data-beat="0">{e(STAGE['check_sentence'])} <span class="ck-slot"><span class="ck-blank">_____</span><span class="ck-fill">{e(STAGE['check_fill'])}</span></span></p>
<ol class="ck-guesses">{g}</ol><p class="ck-note">{e(STAGE['check_guess_note'])}</p>
<div class="ck-claim" data-beat="1"><p>{e(STAGE['check_claim'])}</p><span>{e(STAGE['check_claim_note'])}</span><b class="ck-stamp">Check it</b></div>
<ul class="ck-list">{ck}</ul></div>
<div class="ck-safe" data-beat="3"><h3>{e(STAGE['safe_h'])}</h3><ul>{safe}</ul><p>{e(STAGE['safe_foot'])}</p></div></div>""")

def _scene_save():
    tools = "".join(f'<p><b>{e(TOOLS[t]["name"])}</b><span>{e(TOOLS[t]["save_short"])}</span></p>' for t in TOOL_ORDER)
    wins = "".join(f'<div class="sv-win"><span class="sv-bar"><i></i><i></i><i></i></span><span class="sv-new">New chat</span><div class="sv-slot"></div></div>' for _ in range(3))
    return _sc("save", 2, "Save it once", f"""<h2 class="sc-h sm" data-beat="0">{e(STAGE['save_h'])}</h2>
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
<p class="nx-when">{e(EVENT['next_when'])}<br>{e(EVENT['next_where'])}</p><p class="nx-url">taylormadeacademy.com/agent</p></div>
{_qr_card('https://taylormadeacademy.com' + EVENT['next_href'], 'QR code for the Build Your First AI Agent page', 'See the workshop', 'taylormadeacademy.com/agent', 0, 'big')}</div>""")

def _scene_bye():
    return _sc("bye", 2, "Before you go", f"""<div class="by-grid"><div>
<h2 class="sc-h" data-beat="0">{e(STAGE['bye_h'])}</h2><p class="sc-sub" data-beat="0">{e(STAGE['bye_sub'])}</p>
<p class="by-thanks" data-beat="1">{e(STAGE['bye_thanks'])}</p>
<div class="so-follow">{IG_QR(1, 'row')}{FB_QR(1, 'row')}</div></div>
<div class="so-qrs">{_qr_card(EVENT['class_url'] + '#review', 'QR code to leave a review', 'Leave a review', 'on your class page', 0, 'main')}</div></div>""")

SCENE_MARKUP = {"soon": _scene_soon, "title": _scene_title, "follow": _scene_follow, "laptop": _scene_laptop, "nolove": _scene_nolove,
                "chat": _scene_chat, "words": _scene_words,
                "bland": _scene_bland, "prompt5": _scene_prompt5, "steer": _scene_steer, "tokens": _scene_tokens, "window": _scene_window,
                "check": _scene_check, "save": _scene_save, "yourturn": _scene_yourturn, "qa": _scene_qa, "next": _scene_next, "bye": _scene_bye}
STAGE_ORDER = ["soon", "title", "follow", "laptop", "nolove", "chat", "words", "bland", "prompt5", "steer", "tokens", "window", "check", "save",
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

def stage_page(head, ver):
    h = head("AI 101 stage — Taylormade Academy", "Nelson's screen for the AI 101 class.", "/ai101/class/stage/").replace(
        "</head>", f'<meta name="robots" content="noindex">\n<link rel="stylesheet" href="/css/ai101-class.css?v={ver}">\n'
                   f'<link rel="stylesheet" href="/css/ai101-stage.css?v={ver}">\n</head>')
    scenes = "\n".join(SCENE_MARKUP[s]() for s in STAGE_ORDER)
    page = h + f"""
<div class="stg" id="stg" data-date="{EVENT['date']}"><div class="stg-canvas" id="canvas">
{scenes}
</div></div>
<div class="stg-hud" id="hud">{HUD_BUTTONS}<span id="hudClock" aria-hidden="true"></span></div>
<div class="stg-gate" id="stgGate" hidden><div><h1>Sign in to open the stage.</h1><p><a class="btn gold" href="/login/?next=%2Fai101%2Fclass%2Fstage%2F" data-next>Sign in <span class="arr" aria-hidden="true">&rarr;</span></a></p></div></div>
<script src="/js/vendor/gsap.min.js?v={ver}"></script>
<script src="/js/config.js?v={ver}"></script>
<script type="module" src="/js/ai101-stage.js?v={ver}"></script>
</body></html>"""
    return check_public_copy(page)

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
    return f'<div class="a1c-switch a1c-os" role="group" aria-label="Which computer are you using?">{btns}</div><p class="sr" id="osSay" role="status"></p>'

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
    return os_switch() + cards

def install_web():
    return "".join(f'<p class="a1c-tool" data-for="{t}">{e(INSTALL_WEB.format(site=TOOLS[t]["site"], name=TOOLS[t]["name"]))}</p>' for t in TOOL_ORDER)

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
    "no_love": no_love,
}

def _flow(s, x):
    kind, arg = x
    if kind == "do": return f"<p>{marked(s['do'][arg])}</p>"
    if kind == "prompt": label, text = s["prompts"][arg]; return prompt_box(label, text)
    if kind == "extra": return EXTRA[arg]()
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
<p class="a1c-lead">{e(WHATS_NEXT['replay_p'])}</p>
<p class="a1c-lead"><b>Bringing this to your team?</b> {e(WHATS_NEXT['team_p'])}</p>
{follow_box('bottom')}
</div></section>
</div>
</main>
<script type="module">import("/js/ai101-class.js?v={ver}").then((m) => m.boot()).catch((err) => {{ console.error(err); document.getElementById("gate").hidden = true; document.getElementById("app").hidden = false; }});</script>
""" + footer(pop=False)
    return check_public_copy(page)
