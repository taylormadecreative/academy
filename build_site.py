#!/usr/bin/env python3
"""Taylormade Academy static site generator. Shared chrome + page bodies -> route/index.html.
Marketing storefront builds fully with NO keys; Buy buttons degrade to a 503 notice
until Supabase/Stripe are wired."""
import pathlib, hashlib, re, urllib.parse

ROOT = pathlib.Path(__file__).parent
DOMAIN = "https://taylormadeacademy.com"

def _asset_ver():
    """Short content hash of the shared CSS/JS. Appended as ?v= to every asset link so
    browsers (and the GitHub Pages CDN) fetch a fresh copy the instant the file changes,
    instead of serving a stale cached version. Changes only when the bytes change."""
    h = hashlib.sha256()
    for rel in ("css/build-mode.css", "js/site.js", "js/config.js", "js/pwa.js", "js/native.js", "js/meta-pixel.js"):
        f = ROOT / rel
        if f.exists():
            h.update(f.read_bytes())
    return h.hexdigest()[:10]

ASSET_VER = _asset_ver()

def _splash_tags():
    """iOS launch-image <link> tags, generated alongside the splash PNGs."""
    f = ROOT / "assets" / "splash" / "_tags.html"
    return f.read_text().strip() if f.exists() else ""

# PWA <head> block: makes the site installable to the iPhone/Android home screen as a
# standalone app (manifest + Apple meta + launch screens + service-worker boot).
PWA_TAGS = (
    '<link rel="manifest" href="/manifest.webmanifest">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n'
    '<meta name="apple-mobile-web-app-title" content="Academy">\n'
    '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">\n'
    + _splash_tags() + "\n"
    f'<script src="/js/pwa.js?v={ASSET_VER}" defer></script>\n'
    f'<script src="/js/native.js?v={ASSET_VER}" defer></script>\n'
    f'<script src="/js/meta-pixel.js?v={ASSET_VER}" defer></script>'
)

NAV = [("Community", "/join/"), ("Store", "/store/"), ("Pricing", "/pricing/"), ("About", "/about/")]

# Nelson's social accounts. The 3 confirmed are live; more get appended as Nelson sends them.
SOCIALS = [
    ("Instagram", "https://instagram.com/taylormade_creative"),
    ("TikTok", "https://tiktok.com/@taylormadecreative"),
    ("LinkedIn", "https://linkedin.com/in/taylormademd"),
    ("Portfolio", "https://taylormadecreative.net"),
]

FB_GROUP = "https://www.facebook.com/groups/taylormadeacademy"

# The four learning tracks. status: "live" (has a product) or "soon" (waitlist capture).
TRACKS = [
    ("Graphic Design", "Brand identity, layout, and type from 14 years of real client work. The eye, not just the tools.", "soon", "design"),
    ("Photography", "Shooting, lighting, and editing images that stop the scroll, on real cameras.", "soon", "photo"),
    ("Video Production", "Cinematic video on pro gear, the FX6 and A7RV. Shoot it, cut it, deliver it.", "soon", "video"),
    ("AI for Creatives", "Point AI at real problems and ship agents, tools, and income. Two ebooks ready now.", "live", "ai"),
]

def socials_row(style=""):
    links = "".join(
        f'<a href="{u}" target="_blank" rel="noopener" style="font:600 13px/1 Inter,sans-serif;'
        f'letter-spacing:.02em;color:inherit;text-decoration:none;opacity:.7;border-bottom:1.5px solid var(--gold);padding-bottom:2px">{t}</a>'
        for t, u in SOCIALS)
    return f'<div class="social-row" style="display:flex;flex-wrap:wrap;gap:18px;align-items:center;{style}">{links}</div>'

LOGO = ('<img class="logo" src="/assets/logo-nav.webp" alt="" width="40" height="40" decoding="async">')

_IC_CHAT = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-4 3z"/></svg>')
_IC_BOOK = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linejoin="round" aria-hidden="true"><path d="M5 4a1 1 0 0 1 1-1h7l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M13 3v5h5"/></svg>')

def hero_photo():
    return ('<div class="hero-shot">'
            '<div class="hero-frame"><picture><source srcset="/assets/hero-nelson.webp" type="image/webp">'
            '<img class="hero-img" src="/assets/hero-nelson.png" width="942" height="941" '
            'fetchpriority="high" alt="Nelson Taylor, founder of Taylormade Academy, in a Taylormade Creative varsity jacket"></picture></div>'
            '<div class="fl-chip a" aria-hidden="true"><span class="fc-ic">' + _IC_CHAT + '</span>'
            '<span><span class="fc-t">Message from Nelson</span><br><span class="fc-s">"Welcome in. What are you building?"</span></span></div>'
            '<div class="fl-chip b" aria-hidden="true"><span class="fc-ic gold">' + _IC_BOOK + '</span>'
            '<span><span class="fc-t">Playbook unlocked</span><br><span class="fc-s">Waiting in your library</span></span></div>'
            '</div>')

def head(title, desc, path="/", og="assets/og-image.png", preload_hero=False):
    canon = DOMAIN + path
    hero_preload = ('<link rel="preload" as="image" href="/assets/hero-nelson.webp" '
                    'type="image/webp" fetchpriority="high">') if preload_hero else ""
    return f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png">
<meta name="theme-color" content="#04123a">
<meta property="og:type" content="website"><meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}"><meta property="og:url" content="{canon}">
<meta property="og:image" content="{DOMAIN}/{og}"><meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="preload" as="image" href="/assets/logo-nav.webp" type="image/webp">
{hero_preload}
<link rel="stylesheet" href="/css/build-mode.css?v={ASSET_VER}">
{PWA_TAGS}
<script>document.documentElement.classList.add('js')</script>
</head><body>"""

def header(active=""):
    links = "".join(
        f'<a class="navlink{" active" if active==t else ""}" href="{u}">{t}</a>' for t, u in NAV)
    mlinks = "".join(f'<a href="{u}">{t}</a>' for t, u in NAV)
    return f"""<header class="site-header"><div class="wrap"><div class="bar">
<a class="brand" href="/">{LOGO}<span class="mark">Taylormade Academy</span></a>
<nav class="nav">{links}</nav>
<div class="nav-cta"><a class="navlink" href="/login/">Sign in</a><a class="btn gold sm" href="/login/?mode=join">Join free <span class="arr">&rarr;</span></a>
<button class="btn ghost sm cart-btn" data-open-cart aria-label="Cart"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 7h14l1 13H4z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg><span class="cc" id="cartCount" style="display:none">0</span></button>
<button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="mnav" onclick="var o=document.getElementById('mnav').classList.toggle('open');this.setAttribute('aria-expanded',o)"><span></span><span></span><span></span></button></div>
</div></div><div class="mobile-nav" id="mnav">{mlinks}<a href="/login/">Sign in</a><a class="btn gold" href="/login/?mode=join">Join free</a></div></header>"""

def footer():
    socials = "".join(f'<a href="{u}" target="_blank" rel="noopener" style="color:#9fb0d4;margin-right:18px">{t}</a>' for t, u in SOCIALS)
    cols = {
        "Explore": [("Store", "/store/"), ("Pricing", "/pricing/"), ("About Nelson", "/about/"), ("Preview a course", "/course/")],
        "Community": [("The feed", "/community/"), ("Facebook group", FB_GROUP), ("Sign in", "/login/"), ("Join free", "/login/?mode=join")],
    }
    colhtml = ""
    for h, items in cols.items():
        links = "".join(
            f'<a href="{u}"{" target=\"_blank\" rel=\"noopener\"" if u.startswith("http") else ""}>{t}</a>'
            for t, u in items)
        colhtml += f'<div class="foot-col"><h4>{h}</h4>{links}</div>'
    return f"""<footer class="site-footer"><div class="wrap">
<div class="foot-top">
<div class="foot-brand"><div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px">{LOGO}</div><div class="mark">Taylormade Academy</div></div>
<p>Learn the craft and build real things: graphic design, photography, video, and AI. By Nelson Taylor, Dallas-Fort Worth.</p>
<div style="display:flex;flex-wrap:wrap;margin-top:16px;font-size:14px;font-weight:600">{socials}</div></div>
{colhtml}
<div class="foot-col"><h4>Stay in the loop</h4>
<p style="font-size:14px;color:#8fa0c7;margin-bottom:14px;max-width:30ch">New courses, ebooks, and community drops, straight to your inbox.</p>
<form onsubmit="return BM.subscribe(event,'footer')" style="display:flex;gap:8px;flex-wrap:wrap">
<input type="email" name="email" placeholder="you@email.com" required aria-label="Email address" style="flex:1;min-width:150px;padding:12px 18px;border:1px solid rgba(255,255,255,.16);border-radius:980px;font-family:inherit;font-size:14px;background:rgba(255,255,255,.06);color:#fff;outline-offset:2px">
<button class="btn gold sm" type="submit">Subscribe</button></form></div>
</div>
<div class="foot-bottom"><span>&copy; 2026 Taylormade Creative. All rights reserved.</span>
<span style="display:flex;gap:18px;font-size:13px"><a href="/privacy/" style="color:#8fa0c7">Privacy</a><a href="/terms/" style="color:#8fa0c7">Terms</a><a href="/refunds/" style="color:#8fa0c7">Refunds</a></span>
<span class="mono">LEARN THE CRAFT / BUILD REAL THINGS</span></div>
</div></footer>
<div class="cart-backdrop" id="cartBackdrop" data-close-cart></div>
<aside class="cart-drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-label="Your cart" aria-hidden="true">
<div class="cart-head"><span>Your cart</span><button class="ci-x" data-close-cart aria-label="Close">&times;</button></div>
<div class="cart-items" id="cartItems"></div>
<div class="cart-foot">
<div class="cart-sub"><span>Subtotal</span><span id="cartSubtotal">$0</span></div>
<button class="btn gold" id="cartCheckout" data-checkout-cart style="width:100%" disabled>Checkout Securely <span class="arr">&rarr;</span></button>
<p style="font-size:12px;color:var(--muted);text-align:center;margin-top:8px">7-day refund guarantee</p>
<div class="cart-up"><div class="h">Want everything?</div><p>A membership unlocks all the courses and ebooks for one price.</p><a class="btn ghost sm" href="/pricing/" style="width:100%">See membership</a></div>
</div></aside>
<div class="pop-back" id="popBack" aria-hidden="true">
<div class="pop" role="dialog" aria-modal="true" aria-label="Get the free AI Playbook ebook">
<button class="pop-x" data-pop-close aria-label="Close">&times;</button>
<div class="pop-top">
<div class="pop-left">
<div class="pop-brand">{LOGO}<span>Taylormade Academy</span></div>
<div class="pop-eyebrow">Join free</div>
<h2 class="pop-title">The Creator's<br><span class="blue">AI</span> <span class="u-gold">Playbook</span></h2>
<p class="pop-sub">Create your free account and the Playbook is waiting inside, plus the community, members, and DMs. 100% free.</p>
<ul class="pop-bullets">
<li><span class="bi"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M21 9v5"/><path d="M7 11v4c0 1 2.2 2.2 5 2.2s5-1.2 5-2.2v-4"/></svg></span> Learn AI skills</li>
<li><span class="bi"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M14 4l6 6L9 21H3v-6z"/><path d="M12.5 6.5l5 5"/></svg></span> Create amazing content</li>
<li><span class="bi"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.3 9.2c0-1.2 1.2-2 2.7-2s2.7.8 2.7 2-1.2 1.8-2.7 1.8-2.7.7-2.7 1.9 1.2 2 2.7 2 2.7-.8 2.7-2"/></svg></span> Earn &amp; build income</li>
<li><span class="bi"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="9" r="2.2"/><path d="M16.5 13.6A4.6 4.6 0 0 1 21 18"/></svg></span> Meet builders like you</li>
</ul>
</div>
<div class="pop-art">
<img class="pop-book" src="/assets/ebook-book.webp" alt="The Creator's AI Playbook ebook cover">
<img class="pop-photo" src="/assets/hero-nelson.webp" alt="Nelson Taylor">
</div>
</div>
<div class="pop-bottom">
<div class="pop-bottom-copy">
<div class="pob-h">Join the Taylormade Academy community</div>
<p>Get the Playbook and weekly <span class="gold">exclusive tips</span>, free.</p>
<form class="pop-form" onsubmit="return BM.getEbook(event)">
<span class="pf-input"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></svg><input type="email" name="email" placeholder="Enter your email address" required></span>
<button class="btn gold" type="submit">Create my free account</button>
</form>
<div class="pob-fine"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> No spam. Unsubscribe anytime.</div>
</div>
<div class="pop-free"><span class="gift"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/></svg></span><strong>Free</strong><span>No card. No spam.</span></div>
</div>
</div></div>
<div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true"></div>
<script src="/js/config.js?v={ASSET_VER}"></script><script src="/js/site.js?v={ASSET_VER}"></script></body></html>"""

def render(path, html):
    out = ROOT / path.strip("/") / "index.html" if path != "/" else ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)

# Hand-maintained member-area pages the generator must NOT overwrite, but whose shared
# CSS/JS links still need the cache-busting ?v= stamp. We only rewrite the version query
# string on the asset links, leaving the rest of each file untouched.
# NOTE: playbook/ai-avatar is intentionally NOT listed — it is web-only (no PWA/Capacitor
# head injection) and pins its asset ?v= manually in the page itself.
APP_PAGES = ("community", "login", "dashboard", "library", "welcome", "review", "course")
_ASSET_RX = re.compile(r'(/(?:css/build-mode\.css|js/site\.js|js/config\.js))(?:\?v=[a-z0-9]+)?')

def _ensure_pwa_head(html):
    """Insert (or refresh) the PWA <head> block in a hand-maintained app page, guarded by a
    marker comment so it stays idempotent. Body of the page is left untouched."""
    block = "<!--PWA:start-->\n" + PWA_TAGS + "\n<!--PWA:end-->"
    if "<!--PWA:start-->" in html:
        return re.sub(r"<!--PWA:start-->.*?<!--PWA:end-->", lambda m: block, html, flags=re.S)
    if "</head>" in html:
        return html.replace("</head>", block + "\n</head>", 1)
    return html

def stamp_app_pages(ver):
    stamped = []
    for name in APP_PAGES:
        f = ROOT / name / "index.html"
        if not f.exists():
            continue
        html = f.read_text()
        new = _ensure_pwa_head(_ASSET_RX.sub(rf'\1?v={ver}', html))
        if new != html:
            f.write_text(new)
            stamped.append(name)
    return stamped

# ---------- product data ----------
PRODUCTS = {
    "ai-agent-ebook": {
        "title": "Build Your First AI Agent",
        "tag": "EBOOK", "pages": "~24 pages", "cover": "/assets/cover-ai-agent-v2.png",
        "blurb": "Build a real, working AI agent this weekend, no code, no jargon. The same no-code approach I taught live to about 50 students. A short, do-it-with-me guide, not a textbook.",
        "for": "Beginners who have never written a line of code. Creatives and hustlers who want to build, not just read about AI. Students who want a head start. If you can write an email and follow directions, you can do this.",
        "what": ["What an AI agent actually is, in plain words", "How to pick a real problem worth solving",
                 "Setting up your tools without touching code", "Giving your agent data to work with",
                 "Building it step by step, with screenshots to follow", "Testing it, fixing it, and exporting your work",
                 "A short pitch framework so you can explain what you built"],
        "outcome": "You finish with a working AI agent you built yourself, and you understand how it works well enough to build the next one. No black box. No hand-holding forever. Just the foundation you need to keep going.",
        "what_is": "A short, no-code, do-it-with-me guide to building your first working AI agent. About 24 pages with screenshots, so you finish it. I take you from \"I don't really know what an agent is\" to \"I built one and it does a real job.\"",
    },
    "boring-money": {
        "title": "The AI Money Machine",
        "tag": "EBOOK", "pages": "~24 pages", "cover": "/assets/cover-money-machine.png",
        "blurb": "Turn AI into recurring income by solving the unglamorous problems small businesses pay for every month. The flashy AI stuff gets likes. This gets you paid. A short, run-it-this-week playbook.",
        "for": "Hustlers who want recurring income, not a one-time gig. Freelancers and creatives who already have skills and want to package them. Beginners who would rather build a small, steady business than chase a viral moment. You do not need a big audience or startup money.",
        "what": ["Why the unglamorous problems are the ones that pay every month", "The three goldmines: communication, documents, research",
                 "How to package one problem into a monthly service", "Pricing the outcome, not your hours",
                 "Finding your first clients where they already gather", "A repeatable workflow you run in about thirty minutes",
                 "A 90-day ramp, plus 20 ready-to-sell services to start with"],
        "outcome": "You walk away with a clear, honest plan for a recurring-income AI service business, the prompts and templates to run it, and a first-week action list. Real service income, not a passive-income fantasy.",
        "what_is": "A short, run-it-this-week playbook for building a recurring-income AI service business. About 24 pages with graphics. The dependable, gets-paid-monthly stuff, on purpose.",
    },
    "steal-your-week-back": {
        "title": "Steal Your Week Back",
        "tag": "EBOOK", "pages": "39 pages", "cover": "/assets/cover-steal-your-week-back.png",
        "tags_extra": ["+ Prompt Pack"],
        "blurb": "Put your busywork on autopilot with the AI you already pay for. No code, no new tools: six follow-along automation recipes with copy-paste prompts and real screenshots.",
        "for": "Beginners who have never written a line of code. Creatives, freelancers, and busy people drowning in repetitive work. Anyone who wants their evenings back. If you can write an email and follow a numbered list, you can do everything in this book.",
        "what": ["How AI automation actually works, in plain words", "The five-ingredient test for spotting what is worth automating",
                 "How to write a prompt that works the first time",
                 "Six deep, follow-along recipes: a 6am morning brief, inbox triage, an Excel machine, content on autopilot, an ad-spend dashboard, and a pre-call client brief",
                 "A library of 17 more automations to steal", "How to put any of them on a timer and truly forget it",
                 "A troubleshooting guide and a 7-day plan to get your first one running",
                 "Bonus: the companion Prompt Pack, every prompt one click to copy"],
        "outcome": "You finish with at least one real automation running without you, doing a piece of your actual week, every week. You get fluent enough to build the next one on your own, and you get hours of your time back. This is the on-ramp: get good at running these for yourself first. Turning it into income comes later in the series.",
        "what_is": "A short, no-code, do-it-with-me guide to handing your busywork to the AI you already pay for. Thirty-nine pages of real screenshots and copy-paste prompts, so you actually finish it. You go from drowning in repetitive work to having real automations running while you sleep.",
        "note": "<b>What you need:</b> a paid Claude plan (Pro, about $20/mo, or higher) and the Claude desktop app for Mac or Windows. That is it. No other tools, no phone-only. If you do not have a plan yet, grab one first so you can follow along.",
        "flash": {"end": "2026-07-08T23:59:59", "was": "$19", "label": "4th of July flash &middot; ends Wed at midnight"},
        "pairs": "boring-money",
        "buy_note": "Instant PDF download, plus the copyable Prompt Pack. Read on any device. 7-day refund.",
    },
    "fully-booked-trainer": {
        "title": "The Fully Booked Trainer",
        "tag": "EBOOK", "pages": "42 pages", "cover": "/assets/cover-fully-booked-trainer.png",
        "tags_extra": ["+ Prompt Pack"],
        "blurb": "Hands-on automations for personal trainers who would rather coach than do admin. Full calendars, follow-ups that run on their own, and more leads, all with the AI you already pay for. No tech skills.",
        "for": "Personal trainers and coaches who are great on the floor and buried in admin. Independent trainers, small studio owners, online coaches. If you can write a text and follow a numbered list, you can run everything in here. No code, no new software.",
        "what": ["How AI automation actually works for a training business, in plain words",
                 "The Client Check-In Machine: a personal check-in for every client, every week, drafted for you",
                 "The No-Show Killer: every session confirmed the night before, in your voice",
                 "The Program Builder: next week's programs drafted from your notes",
                 "The Lead Follow-Up Machine: every inquiry gets a warm reply and a follow-up plan",
                 "Content on Autopilot and a Money Tracker for renewals and balances",
                 "A library of 15 more automations to steal, plus a Prompt Pack to copy them in one click"],
        "outcome": "You finish with at least one automation running your admin without you, so your evenings are yours again and no lead or check-in slips. You coach more, chase less, and the business grows while you are on the floor.",
        "what_is": "A short, no-code, do-it-with-me playbook that hands a trainer's admin, follow-ups, and check-ins to the AI you already pay for. Forty-two pages of real screenshots and copy-paste prompts, tuned for a training business, so you actually finish it.",
        "note": "<b>What you need:</b> a paid Claude plan (Pro, about $20/mo, or higher) and the Claude desktop app for Mac or Windows. That is it. No other tools, no phone-only. If you do not have a plan yet, grab one first so you can follow along.",
        "pairs": "steal-your-week-back",
        "buy_note": "Instant PDF download, plus the copyable Prompt Pack. Read on any device. 7-day refund.",
    },
    "always-on-agent": {
        "title": "The Always-On Agent",
        "tag": "EBOOK", "pages": "43 pages", "cover": "/assets/cover-always-on-agent.png",
        "tags_extra": ["+ Prompt Pack"],
        "blurb": "Hands-on automations for real estate agents: answer every lead in five minutes, nurture follow-ups on their own, and close more deals with less busywork. All with the AI you already pay for. No code.",
        "for": "Real estate agents who lose deals to slow follow-up and drown in admin. Solo agents, small teams, and new agents building a pipeline. If you can write an email and follow a numbered list, you can run all of it. No tech background needed.",
        "what": ["How AI automation actually works for a real estate business, in plain words",
                 "The Five-Minute Lead Reply: every lead gets a warm, personal reply while you sleep",
                 "The Listing Machine: MLS description, portal blurb, and social copy from your walkthrough notes",
                 "The Open House Follow-Up: every sign-in name gets a personal note the same day",
                 "The Morning Market Brief: new listings, price cuts, and pendings in your farm, read for you",
                 "Content on Autopilot and a Transaction Tracker that watches every deadline",
                 "A library of 15 more automations to steal, plus a Prompt Pack to copy them in one click"],
        "outcome": "You finish with your lead response, follow-up, and deadlines handled automatically, so you become the agent who always replies first and never drops a client. More deals close, and your nights and weekends come back.",
        "what_is": "A short, no-code, do-it-with-me playbook that puts an agent's lead response, follow-up, and transaction admin on autopilot with the AI you already pay for. Forty-three pages of real screenshots and copy-paste prompts, tuned for real estate.",
        "note": "<b>What you need:</b> a paid Claude plan (Pro, about $20/mo, or higher) and the Claude desktop app for Mac or Windows. That is it. No other tools, no phone-only. If you do not have a plan yet, grab one first so you can follow along.",
        "pairs": "steal-your-week-back",
        "buy_note": "Instant PDF download, plus the copyable Prompt Pack. Read on any device. 7-day refund.",
    },
    "busy-season-handled": {
        "title": "Busy Season, Handled",
        "tag": "EBOOK", "pages": "45 pages", "cover": "/assets/cover-busy-season-handled.png",
        "tags_extra": ["+ Prompt Pack"],
        "blurb": "Hands-on automations for tax preparers and accountants: chase the missing documents, quiet the inbox, and keep every client updated on their own, so busy season stops eating your life. No code.",
        "for": "Tax preparers, bookkeepers, and accountants slammed every busy season. Solo preparers and small firms. If you can write an email and follow a numbered list, you can run all of it. No tech skills, no new software to learn.",
        "what": ["How AI automation actually works for a tax and accounting practice, in plain words",
                 "The Document Chaser: who owes you what, in one grid, with the chaser emails written",
                 "The Intake Organizer: a client's pile of photos and PDFs becomes a clean, named file set",
                 "The Morning Docket: your 7am inbox sorted into four buckets and a two-minute plan",
                 "The Status Update Machine: every open client hears from you before they think to ask",
                 "The Appointment Prep Brief and a Practice Dashboard for your whole season on one page",
                 "A library of 15 more automations to steal, plus a Prompt Pack to copy them in one click"],
        "outcome": "You finish with the document chasing, inbox triage, and client updates running without you, so busy season stops running your life. Fewer late nights, fewer dropped balls, and clients who feel looked after.",
        "what_is": "A short, no-code, do-it-with-me playbook that hands a tax practice's document chasing, inbox, and client updates to the AI you already pay for. Forty-five pages of real screenshots and copy-paste prompts, tuned for tax season.",
        "note": "<b>What you need:</b> a paid Claude plan (Pro, about $20/mo, or higher) and the Claude desktop app for Mac or Windows. That is it. No other tools, no phone-only. If you do not have a plan yet, grab one first so you can follow along.",
        "pairs": "steal-your-week-back",
        "buy_note": "Instant PDF download, plus the copyable Prompt Pack. Read on any device. 7-day refund.",
    },
}

def price_block(slug="", big=False):
    # data-price is filled from the DB (ea_list_products) by site.js, so the shown
    # price always matches what checkout charges. Falls back to "Price coming".
    cls = "price big" if big else "price"
    return f'<div class="{cls}" data-price="{slug}"><span class="ph">Price coming</span></div>'

def tracks_section():
    # The four learning tracks. AI is live (-> store); the rest capture emails to
    # the newsletter (BM.subscribe) so interest is logged from day one.
    cards = ""
    for name, desc, status, key in TRACKS:
        if status == "live":
            cards += f"""<article class="pcard">
<div class="top"><div class="meta"><div class="tagrow"><span class="tag gold"><span class="dot"></span>READY NOW</span></div>
<h3>{name}</h3><p class="blurb">{desc}</p></div></div>
<div class="foot"><span class="price"><span class="ph">2 ebooks</span></span><a class="btn" href="/store/">Start here <span class="arr">&rarr;</span></a></div></article>"""
        else:
            cards += f"""<article class="pcard">
<div class="top"><div class="meta"><div class="tagrow"><span class="tag live"><span class="dot"></span>COURSE COMING</span></div>
<h3>{name}</h3><p class="blurb">{desc}</p></div></div>
<div class="foot" style="display:block">
<form onsubmit="return BM.subscribe(event,'track-{key}')" style="display:flex;gap:8px;flex-wrap:wrap">
<input type="email" name="email" placeholder="you@email.com" required aria-label="Email for {name} track" style="flex:1;min-width:140px;padding:11px 14px;border:1.5px solid var(--hair);border-radius:100px;font-family:inherit;font-size:14px;background:var(--paper)">
<button class="btn sm" type="submit">Notify me</button></form>
<p style="font-size:12px;color:var(--muted);margin:8px 0 0">First in line when the {name} track drops.</p></div></article>"""
    return cards

# icon set for the platform showcase (stroke inherits currentColor)
_PIC = {
  "feed": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h10"/></svg>',
  "play": '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  "book": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 0 2 2h13"/></svg>',
  "chat": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-4 3z"/></svg>',
  "dash": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z"/></svg>',
  "heart": '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.6-9-9c-1.2-2.7.6-6 3.8-6 2 0 3.6 1.2 5.2 3.3C13.6 6.2 15.2 5 17.2 5c3.2 0 5 3.3 3.8 6-2 4.4-9 9-9 9z"/></svg>',
}

def plat_mock():
    """Hand-built, honest mock of the real member platform (feed, DMs, library, courses)."""
    nav_items = (('feed', 'Feed', True, False), ('play', 'Courses', False, False),
                 ('book', 'Library', False, False), ('chat', 'Messages', False, True),
                 ('dash', 'Dashboard', False, False))
    DOT = '<span class="mk-dot"></span>'
    nav = "".join(
        f'<span class="mk-i{" on" if on else ""}">{_PIC[k]}{t}{DOT if dot else ""}</span>'
        for k, t, on, dot in nav_items)
    return f"""<div class="plat-stage reveal">
<div class="mock" role="img" aria-label="A preview of the Taylormade Academy member platform: community feed, courses, library, and messages">
<div class="mk-bar"><i></i><i></i><i></i><span class="mk-url">taylormadeacademy.com</span></div>
<div class="mk-body">
<aside class="mk-nav"><span class="mk-logo">{LOGO.replace('width="40" height="40"', 'width="22" height="22"')}<b>Academy</b></span>{nav}</aside>
<div class="mk-feed">
<div class="mk-comp"><span class="mk-av bl">You</span><span class="mk-in">Share what you're building&hellip;</span><span class="mk-go">Post</span></div>
<article class="mk-post">
<div class="mk-who"><span class="mk-av">NT</span><span><b>Nelson Taylor</b> <span class="tag gold" style="margin-left:6px;font-size:9px;padding:2px 8px">HOST</span><br><span>#general</span></span></div>
<p>Welcome to the Academy. Introduce yourself in the feed and tell us what you're working on: design, photo, video, or AI. Somebody in here has been where you are.</p>
<div class="mk-acts"><span>{_PIC["heart"]} Like</span><span>{_PIC["chat"]} Reply</span></div>
</article>
<article class="mk-post" style="opacity:.65">
<div class="mk-who"><span class="mk-av bl">You</span><span><b>Your first post</b><br><span>the crew is waiting</span></span></div>
</article>
</div>
<aside class="mk-right">
<div class="mk-card"><div class="mk-h">Continue reading</div><div class="mk-t">The AI Money Machine</div><div class="mk-s">Chapter 4 &middot; read on-site or download</div><div class="mk-prog"><i></i></div></div>
<div class="mk-card"><div class="mk-h">Up next</div><div class="mk-t">Design Like a Pro</div><div class="mk-s">Video course &middot; in production</div><div class="mk-prog gold"><i></i></div></div>
</aside>
</div></div>
<div class="plat-fl dm"><div class="pf-h"><span class="mk-av">NT</span> Nelson Taylor</div><div class="pf-s">Direct messages, built in. Ask, get unstuck, collaborate.</div></div>
<div class="plat-fl vid"><div class="pf-h"><span class="pf-play">{_PIC["play"]}</span> Lesson 01 &middot; The Eye</div><div class="pf-s">Streams right on the site.</div><div class="pf-vidbar"><i></i></div></div>
<div class="plat-fl book"><div class="pf-h"><span class="fc-ic gold" style="width:32px;height:32px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center">{_IC_BOOK}</span> Your library</div><div class="pf-s">Every ebook, readable in the browser or yours to download.</div></div>
</div>"""

def plat_feats():
    feats = [
        ("feed", "A real community", "A feed, channels, and a member directory. Post work, get feedback, find collaborators."),
        ("play", "Video courses", "Step-by-step courses that stream on-site, on your phone or desktop. New content monthly."),
        ("book", "Your ebook library", "Read every ebook right on the site, or download the PDF and keep it forever."),
        ("dash", "Your dashboard", "One home for your courses, books, messages, and progress. Pick up where you left off."),
    ]
    return '<div class="plat-feats" data-stag>' + "".join(
        f'<div class="pfe"><div class="ic">{_PIC[k]}</div><div class="h">{h}</div><div class="d">{d}</div></div>'
        for k, h, d in feats) + "</div>"

def mem_cards(context="home"):
    """The money section: Free vs Membership, honest and simple."""
    return f"""<div class="mem reveal">
<div class="mem-card">
<div class="pname">Free</div>
<div class="pprice">$0<span> / forever</span></div>
<p class="pdesc">A real taste. No card, no trial clock.</p>
<ul class="flist">
<li>The community feed, members, and DMs</li>
<li>The Creator's AI Playbook, free in your library</li>
<li>Free guides and intro videos</li>
</ul>
<a class="btn ghost" href="/login/?mode=join">Join free</a>
</div>
<div class="mem-card feat">
<span class="mem-badge"><span class="dot" style="background:var(--navy)"></span>All access</span>
<div class="pname">Membership</div>
<div class="pprice">$15<span> / month</span></div>
<p class="pdesc">Everything unlocked, about the price of a pizza.</p>
<ul class="flist">
<li>Every ebook, read on-site or download</li>
<li>Every video course as it drops</li>
<li>New content every month</li>
<li>Cancel anytime, keep your community</li>
</ul>
<a class="btn gold" data-buy="all-access" href="#">Start membership <span class="arr">&rarr;</span></a>
</div>
</div>
<p class="mem-fine reveal"><b>7-day refund</b> on everything &middot; cancel in one click &middot; secure checkout</p>"""

def trim_blurb(text, n):
    """Truncate at a word boundary, never mid-word."""
    if len(text) <= n:
        return text
    return text[:n].rsplit(" ", 1)[0].rstrip(",.;") + "&hellip;"

COVER_DIMS = {"/assets/cover-ai-agent-v2.png": (840, 1120), "/assets/cover-money-machine.png": (840, 1120),
              "/assets/cover-steal-your-week-back.png": (1103, 1426),
              "/assets/cover-fully-booked-trainer.png": (1055, 1491),
              "/assets/cover-always-on-agent.png": (1055, 1491),
              "/assets/cover-busy-season-handled.png": (1055, 1491)}

def cover_pic(p, cls="cover ebook-cover", lazy=True, style=""):
    """WebP <picture> with PNG fallback + intrinsic size (no CLS)."""
    png = p["cover"]
    webp = png.rsplit(".", 1)[0] + ".webp"
    w, h = COVER_DIMS.get(png, (720, 1000))
    lz = ' loading="lazy" decoding="async"' if lazy else ' fetchpriority="high"'
    st = f' style="{style}"' if style else ''
    return (f'<picture><source srcset="{webp}" type="image/webp">'
            f'<img class="{cls}" src="{png}" alt="{p["title"]} cover" width="{w}" height="{h}"{lz}{st}></picture>')

def course_top(base, alt):
    """Top image for an in-production course card: WebP thumbnail + 'Coming soon' badge."""
    return (f'<div class="top"><picture><source srcset="/assets/{base}.webp" type="image/webp">'
            f'<img class="cover" src="/assets/{base}.png" width="960" height="640" alt="{alt} course thumbnail" '
            f'loading="lazy" decoding="async"></picture><span class="soon-badge">Coming soon</span></div>')

def popular_cards():
    out = ""
    for slug in ("steal-your-week-back", "ai-agent-ebook", "boring-money"):
        p = PRODUCTS[slug]
        tag = ('<span class="tag gold"><span class="dot"></span>NEW &middot; LAUNCH FLASH</span>'
               if p.get("flash") else '<span class="tag gold"><span class="dot"></span>EBOOK</span>')
        out += (f'<article class="pcard"><a class="top" href="/store/{slug}/">{cover_pic(p)}</a>'
                f'<div class="meta"><div class="tagrow">{tag}<span class="tag">{p["pages"]}</span></div>'
                f'<h3>{p["title"]}</h3><p class="blurb">{trim_blurb(p["blurb"], 92)}</p></div>'
                f'<div class="foot">{price_block(slug)}<a class="btn ghost sm" href="/store/{slug}/">Details <span class="arr">&rarr;</span></a></div></article>')
    for name, desc, thumb in (("Design Like a Pro", "Graphic design from 14 years of client work, the eye and the tools.", "course-design"),):
        out += (f'<article class="pcard">{course_top(thumb, name)}'
                f'<div class="meta"><div class="tagrow"><span class="tag live"><span class="dot"></span>IN PRODUCTION</span></div>'
                f'<h3>{name}</h3><p class="blurb">{desc}</p></div>'
                f'<div class="foot"><a class="btn ghost sm" href="/store/" style="width:100%">Notify me <span class="arr">&rarr;</span></a></div></article>')
    return out

# ---------- AI Quick Launch (real feature: opens ChatGPT/Claude with a prompt loaded) ----------
AI_PROMPT = ("You're my executive assistant. Here are my to-dos for today: [list them]. "
             "Put them in priority order, tell me which to do first and why, and write the first email I need to send.")
_AIQ = urllib.parse.quote(AI_PROMPT)
CHATGPT_URL = "https://chatgpt.com/?q=" + _AIQ
CLAUDE_URL = "https://claude.ai/new?q=" + _AIQ
_SPARK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>'

def ai_launch():
    def btn(url, color, name):
        return (f'<a class="ai-btn" href="{url}" target="_blank" rel="noopener">'
                f'<span class="aiic" style="background:{color}">{_SPARK}</span>'
                f'<span><b>Ask {name}</b><span class="aism">Prompt pre-loaded</span></span>'
                f'<span class="aiar">&rarr;</span></a>')
    return ("""<section class="section tight"><div class="wrap">
<div class="ailaunch reveal">
<div><span class="eyb">AI Quick Launch</span>
<h2>Talk to your AI. One tap.</h2>
<p>Jump straight into ChatGPT or Claude with a prompt already loaded. It's the fastest way to put AI to work on your day, your studies, or your hustle.</p></div>
<div class="btns">""" + btn(CHATGPT_URL, "#10a37f", "ChatGPT") + btn(CLAUDE_URL, "#d97757", "Claude") + """</div>
</div></div></section>""")

# ---------- HOME ----------
def home():
    fb_svg = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
              '<path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6v1.9h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg>')
    return head(
        "Taylormade Academy — Learn the craft. Build real things. Create real income.",
        "A creative community by Nelson Taylor. Video courses, ebooks you can read on-site or download, and a private community for design, photography, video, and AI. Join free, unlock everything for $15/mo.",
        "/", preload_hero=True) + header("") + f"""
<main>
<section class="hero"><div class="wrap"><div class="h-grid">
<div class="hero-copy reveal">
<span class="hero-badge"><span class="dot"></span>The creative community for builders</span>
<h1 class="display-xl" style="margin-top:24px">Learn the craft.<br>Build real things.<br><span class="u-gold">Create real income.</span></h1>
<p class="sub">A private community, step-by-step video courses, and plain-English ebooks for design, photo, video, and AI. Hosted by Nelson Taylor. Built for people who ship.</p>
<div class="cta-row"><a class="btn gold" href="/login/?mode=join">Join free <span class="arr">&rarr;</span></a><a class="btn ghost" href="#inside">See what's inside</a></div>
<div class="statline">
<div class="s"><div class="n">Free</div><div class="l">to join, forever</div></div>
<div class="s"><div class="n">$15/mo</div><div class="l">unlocks everything</div></div>
<div class="s"><div class="n">4</div><div class="l">creative crafts</div></div>
</div>
</div>
<div class="hero-art reveal">{hero_photo()}</div>
</div></div></section>

<section class="section plat on-ink" id="inside"><div class="wrap">
<div class="plat-head">
<span class="kicker gold reveal">Inside the Academy</span>
<h2 class="display-l reveal" style="margin-top:16px">One membership.<br>A whole creative campus.</h2>
<p class="lead reveal" style="margin:18px auto 0;max-width:56ch">The feed, the courses, your library, your messages: everything in one place, on the web and in the app.</p>
</div>
{plat_mock()}
{plat_feats()}
</div></section>

<section class="section"><div class="wrap">
<div style="text-align:center;margin-bottom:clamp(32px,4.4vw,52px)">
<span class="kicker gold reveal">Simple pricing</span>
<h2 class="display-l reveal" style="margin-top:14px">Start free. Upgrade when you're ready.</h2>
</div>
{mem_cards()}
</div></section>

<section class="section" style="background:var(--bg-soft)"><div class="wrap">
<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:end;justify-content:space-between;margin-bottom:30px">
<div><span class="kicker gold reveal">Or own them outright</span><h2 class="display-m reveal" style="margin-top:10px">The playbooks.</h2></div>
<a class="textlink reveal" href="/store/">Browse the store &rarr;</a></div>
<div class="products" data-stag style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">{popular_cards()}</div>
<div class="freebook reveal" style="margin-top:clamp(26px,3.4vw,44px)">
<img class="fb-cover" src="/assets/ebook-book.webp" width="180" height="240" alt="The Creator's AI Playbook free ebook" loading="lazy">
<div class="fb-copy">
<span class="kicker gold">Free starter guide</span>
<h2 class="display-m" style="margin-top:10px;color:#fff">Start with the free AI Playbook.</h2>
<p style="color:#9fb0d4;margin-top:12px;max-width:50ch">The 3 tools, where to click, every beginner term, and the prompt formula, in a quick 11-page read. Create a free account and it's waiting in your library.</p>
<button class="btn gold" data-get-ebook style="margin-top:20px">Join free for the Playbook <span class="arr">&rarr;</span></button>
</div>
</div>
</div></section>

{ai_launch()}

<section class="section"><div class="wrap">
<div class="g-12" style="align-items:center;gap:clamp(28px,4vw,64px)">
<div class="reveal" style="grid-column:1/7">
<div style="border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow);background:var(--navy)">
<video style="display:block;width:100%;aspect-ratio:16/9;background:var(--navy)" src="/assets/home-hero-nelson.mp4" poster="/assets/home-hero-poster.jpg" controls playsinline preload="none" aria-label="Nelson Taylor introduces Taylormade Academy"><track kind="captions" srclang="en" label="English" src="/assets/home-hero-nelson.vtt" default></video></div>
</div>
<div style="grid-column:7/13">
<span class="kicker gold reveal">Why learn here</span>
<h2 class="display-m reveal" style="margin-top:12px;max-width:16ch">Taught from the work, not from theory.</h2>
<div class="receipts reveal" style="grid-template-columns:1fr;margin-top:26px">
<div class="rc"><div class="num">01</div><div class="h">A live AI build sprint</div><div class="d">A 3-night "Build Your First AI Agent" workshop with AUC's Data Science Institute and Johns Hopkins, for about 50 HBCU students.</div></div>
<div class="rc"><div class="num">02</div><div class="h">A shipped iOS app</div><div class="d">A real app on the App Store people can download today. Not a prototype, not a slide.</div></div>
<div class="rc"><div class="num">03</div><div class="h">14 years of client work</div><div class="d">Design, photo, video, branding, and AI for real businesses across Dallas-Fort Worth. BFA, Art Institute of Dallas.</div></div>
</div>
<a class="textlink reveal" href="/about/" style="display:inline-block;margin-top:8px">More about Nelson &rarr;</a>
</div>
</div>
</div></section>


<section class="section cta-band"><div class="wrap">
<span class="kicker gold reveal" style="justify-content:center">Your move</span>
<h2 class="display-l reveal" style="margin-top:14px">Your creative home is ready.</h2>
<p class="lead reveal" style="margin:16px auto 0;max-width:44ch">Join free today. Go all-access whenever you want everything.</p>
<div class="cta-row reveal" style="justify-content:center"><a class="btn gold" href="/login/?mode=join">Join free <span class="arr">&rarr;</span></a><a class="btn ghost" href="/pricing/">See the membership</a></div>
</div></section>
</main>""" + footer()

# ---------- STORE ----------
def store():
    p1, p2 = PRODUCTS["ai-agent-ebook"], PRODUCTS["boring-money"]
    p0 = PRODUCTS["steal-your-week-back"]
    def ebook_card(slug, p, tag_html=None):
        tag_html = tag_html or '<span class="tag gold"><span class="dot"></span>EBOOK</span>'
        return (f'<article class="pcard" data-cat="ebook">'
                f'<a class="top" href="/store/{slug}/">{cover_pic(p)}</a>'
                f'<div class="meta"><div class="tagrow">{tag_html}<span class="tag">{p["pages"]}</span></div>'
                f'<h3>{p["title"]}</h3><p class="blurb">{trim_blurb(p["blurb"], 88)}</p></div>'
                f'<div class="foot">{price_block(slug)}<button class="btn gold sm" data-add-cart="{slug}" data-title="{p["title"]}">Add to cart</button></div></article>')
    def soon_card(name, desc, key):
        return (f'<article class="pcard" data-cat="soon">{course_top("course-" + key, name)}'
                f'<div class="meta"><div class="tagrow"><span class="tag live"><span class="dot"></span>IN PRODUCTION</span></div>'
                f'<h3>{name}</h3><p class="blurb">{desc}</p></div>'
                f'<div class="foot" style="display:block"><form onsubmit="return BM.subscribe(event,\'store-{key}\')" style="display:flex;gap:8px">'
                f'<input type="email" name="email" placeholder="you@email.com" required style="flex:1;min-width:110px;padding:10px 12px;border:1.5px solid var(--hair);border-radius:9px;font-family:inherit;font-size:13px;background:#fff">'
                f'<button class="btn gold sm" type="submit">Notify</button></form></div></article>')
    def bundle_tile():
        return ('<article class="pcard" data-cat="ebook">'
                '<div class="top"><div class="cover-ph">THE COMPLETE<br>BUNDLE</div></div>'
                '<div class="meta"><div class="tagrow"><span class="tag gold"><span class="dot"></span>Bundle &amp; save</span><span class="tag">2 ebooks</span></div>'
                '<h3>The Complete Bundle</h3><p class="blurb">Both ebooks together: build the AI agent, then the recurring-income business.</p></div>'
                '<div class="foot">' + price_block("bundle") + '<button class="btn gold sm" data-add-cart="bundle" data-title="The Complete Bundle">Add to cart</button></div></article>')
    grid = (ebook_card("steal-your-week-back", p0, '<span class="tag gold"><span class="dot"></span>4TH OF JULY &middot; $10 FLASH</span>')
            + ebook_card("ai-agent-ebook", p1) + ebook_card("boring-money", p2)
            + ebook_card("fully-booked-trainer", PRODUCTS["fully-booked-trainer"], '<span class="tag gold"><span class="dot"></span>FOR TRAINERS</span>')
            + ebook_card("always-on-agent", PRODUCTS["always-on-agent"], '<span class="tag gold"><span class="dot"></span>FOR AGENTS</span>')
            + ebook_card("busy-season-handled", PRODUCTS["busy-season-handled"], '<span class="tag gold"><span class="dot"></span>FOR TAX PROS</span>')
            + bundle_tile()
            + soon_card("Design Like a Pro", "Graphic design from 14 years of client work, the eye and the tools.", "design")
            + soon_card("Cinematic Video", "Shoot, light, and edit video on any camera, start to finish.", "video")
            + soon_card("Photography That Sells", "Lighting, shooting, and editing images that stop the scroll.", "photo"))
    return head("Store — Taylormade Academy", "Buy what you need: ebooks, PDFs, and courses for design, photo, video, and AI. Or join the membership for everything.", "/store/") + header("Store") + f"""
<main>
<section class="section tight"><div class="wrap">
<div class="g-12" style="align-items:stretch;gap:clamp(20px,3vw,36px)">
<div style="grid-column:1/7;display:flex;flex-direction:column;justify-content:center">
<span class="kicker gold reveal">The store</span>
<h1 class="display-l reveal" style="margin-top:12px">Buy what you need.<br><span class="u-gold">Keep it forever.</span></h1>
<p class="lead reveal" style="margin-top:16px;max-width:44ch">Ebooks and courses for design, photo, video, and AI. Read on-site or download. Or skip the cart: the $15/mo membership unlocks all of it.</p>
<div class="cta-row reveal"><a class="btn ghost sm" href="/pricing/">See the membership <span class="arr">&rarr;</span></a></div>
</div>
<div style="grid-column:7/13" class="reveal">
<div style="background:radial-gradient(120% 120% at 80% -20%,#0b2a6e,var(--navy));color:#c3cfe8;border-radius:var(--r-lg);padding:clamp(24px,3.4vw,36px);height:100%;display:flex;flex-direction:column;justify-content:center;box-shadow:var(--shadow)">
<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="tag" style="background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);color:#a8bcf5">Featured bundle</span><span class="tag gold"><span class="dot"></span>Bundle &amp; save</span></div>
<h2 style="color:#fff;font-size:clamp(23px,3vw,30px);margin-top:16px;letter-spacing:-.025em">The Complete Bundle</h2>
<p style="margin-top:10px;font-size:14.5px;color:#9fb0d4;line-height:1.6">Both ebooks together: build the AI agent, then the recurring-income business. Lifetime access, instant download.</p>
<div style="display:flex;align-items:center;gap:18px;margin-top:22px;flex-wrap:wrap"><div class="price big" data-price="bundle" style="color:#fff"><span class="ph" style="color:#a8bcf5">Price coming</span></div>
<button class="btn gold" data-add-cart="bundle" data-title="The Complete Bundle">Add to cart</button></div>
</div></div>
</div></div></section>

<section class="section" style="padding-top:clamp(16px,2vw,28px)"><div class="wrap">
<div class="chips reveal" id="storeFilter" style="margin-bottom:24px" role="group" aria-label="Filter products">
<button class="chip active" data-cat="all">All products</button>
<button class="chip" data-cat="ebook">Ebooks</button>
<button class="chip" data-cat="soon">Courses (soon)</button>
</div>
<div class="products" data-stag id="storeGrid">{grid}</div>
<p class="muted reveal" style="margin-top:30px;font-size:14.5px"><b style="color:var(--ink)">Most people just get the membership.</b> $15/mo for everything, less than a single ebook. <a class="textlink" href="/pricing/">See the membership &rarr;</a> &nbsp;&middot;&nbsp; <a class="textlink" href="/course/">Preview a course &rarr;</a></p>
</div></section>
</main>""" + footer()

# ---------- PRODUCT PAGE ----------
def product_page(slug):
    p = PRODUCTS[slug]
    other = p.get("pairs") or ("boring-money" if slug == "ai-agent-ebook" else "ai-agent-ebook")
    op = PRODUCTS[other]
    feats = "".join(f"<li>{x}</li>" for x in p["what"])
    w, h_ = COVER_DIMS.get(p["cover"], (840, 1120))
    xtags = "".join(f'<span class="tag">{t}</span>' for t in p.get("tags_extra", []))
    buy_note = p.get("buy_note", "Read on-site or download the PDF. 7-day refund.")
    note_html = ""
    if p.get("note"):
        note_html = ('<div style="display:flex;gap:10px;align-items:flex-start;background:var(--gold-soft);'
                     'border:1px solid #f1de9f;border-radius:14px;padding:14px 16px;margin-top:28px;font-size:13.5px;'
                     'color:var(--gold-ink);line-height:1.55;max-width:56ch">'
                     '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" '
                     'stroke-linejoin="round" style="flex:0 0 auto;margin-top:2px;color:var(--gold-deep)">'
                     '<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 18.8 5.9 22l1.2-6.8-5-4.9 6.9-1z"/></svg>'
                     f'<span>{p["note"]}</span></div>')
    flash_html, flash_js = "", ""
    if p.get("flash"):
        f = p["flash"]
        flash_html = (
            '<div id="flashBadge" style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;'
            'letter-spacing:.07em;text-transform:uppercase;color:var(--gold-ink);background:var(--gold-soft);'
            f'border:1px solid #f1de9f;border-radius:980px;padding:5px 12px;margin-bottom:12px">{f.get("label","Launch flash &middot; first week only")}</div>'
            '<div style="display:flex;align-items:baseline;gap:12px">'
            + price_block(slug, big=True)
            + f'<span id="flashWas" style="font-family:var(--font);font-size:18px;font-weight:700;color:var(--muted);text-decoration:line-through">{f["was"]}</span></div>'
            + f'<div id="flashCount" data-flash-end="{f["end"]}" style="margin-top:10px;font-size:13px;font-weight:600;color:var(--ink-2)"></div>')
        flash_js = """
<script>
(function(){
  var el=document.getElementById('flashCount'); if(!el) return;
  var end=new Date(el.getAttribute('data-flash-end')).getTime();
  function off(id){var n=document.getElementById(id);if(n)n.style.display='none';}
  function tick(){
    if(isNaN(end)){el.style.display='none';return;}
    var d=end-Date.now();
    if(d<=0){el.style.display='none';off('flashWas');off('flashBadge');return;}
    var days=Math.floor(d/864e5),h=Math.floor(d%864e5/36e5),m=Math.floor(d%36e5/6e4),s=Math.floor(d%6e4/1e3);
    el.innerHTML='Ends in <b style="color:var(--gold-deep);font-variant-numeric:tabular-nums">'+days+'d '+h+'h '+m+'m '+s+'s</b> &middot; then """ + f["was"] + """';
  }
  tick(); setInterval(tick,1000);
})();
</script>"""
    return head(f"{p['title']} — Taylormade Academy", p["blurb"], f"/store/{slug}/", og=p['cover'].lstrip('/')) + header("Store") + f"""
<main>
<section class="section tight"><div class="wrap">
<a class="mono" href="/store/" style="font-size:12px;letter-spacing:.1em;color:var(--muted)">&larr; STORE</a>
<div class="g-12" style="margin-top:22px;align-items:start;gap:clamp(24px,4vw,56px)">
<div class="reveal" style="grid-column:1/6;position:sticky;top:90px">
<picture class="prod-cover"><source srcset="{p['cover'].rsplit('.',1)[0]}.webp" type="image/webp"><img src="{p['cover']}" width="{w}" height="{h_}" alt="{p['title']} cover" fetchpriority="high"></picture>
<div style="background:#fff;border:1px solid var(--hair);border-radius:var(--r);padding:24px;margin-top:24px;box-shadow:var(--shadow-sm)">
{flash_html or price_block(slug, big=True)}
<a class="btn gold" data-buy="{slug}" href="#" style="width:100%;margin-top:16px">Get the ebook <span class="arr">&rarr;</span></a>
<p style="font-size:13px;color:var(--muted);margin-top:14px;text-align:center">{buy_note}</p>
<hr class="rule hair" style="margin:16px 0">
<p style="font-size:13px;color:var(--muted);text-align:center">Members read this free. <a class="textlink" href="/pricing/">See the $15/mo membership</a></p>
</div></div>
<div class="reveal" style="grid-column:7/13">
<div class="tagrow" style="display:flex;gap:8px;flex-wrap:wrap"><span class="tag gold"><span class="dot"></span>{p['tag']}</span><span class="tag">{p['pages']}</span>{xtags}</div>
<h1 class="display-l" style="margin-top:14px">{p['title']}</h1>
<p class="lead" style="margin-top:18px;max-width:52ch">{p['what_is']}</p>
<hr class="rule hair" style="margin:30px 0">
<span class="kicker gold">Who it is for</span>
<p style="margin-top:10px">{p['for']}</p>
{note_html}
<span class="kicker gold" style="display:block;margin-top:28px">What is inside</span>
<ul class="flist">{feats}</ul>
<span class="kicker gold" style="display:block;margin-top:28px">The outcome</span>
<p style="margin-top:10px">{p['outcome']}</p>
<div style="margin-top:32px;display:flex;gap:14px;flex-wrap:wrap"><a class="btn gold" data-buy="{slug}" href="#">Get the ebook <span class="arr">&rarr;</span></a><a class="btn ghost" href="/pricing/">Or get both and save</a></div>
</div></div></div></section>
<section class="section on-ink"><div class="wrap" style="text-align:center">
<span class="kicker gold reveal" style="justify-content:center">Keep building</span>
<h2 class="display-m reveal" style="margin-top:14px">Pairs with &#8220;{op['title']}&#8221;</h2>
<p class="reveal" style="color:#9fb0d4;margin:16px auto 0;max-width:46ch">{op['blurb']}</p>
<a class="btn gold reveal" style="margin-top:26px" href="/store/{other}/">See &#8220;{op['title']}&#8221; <span class="arr">&rarr;</span></a>
</div></section>
</main>""" + flash_js + footer()

# ---------- PRICING ----------
FAQ = [
    ("What do I get for free?",
     "A real membership, not a teaser. The community feed, the member directory, direct messages, "
     "The Creator's AI Playbook in your library, and the free guides and intro videos. No card, no trial clock. Free is free."),
    ("What unlocks with the $15/mo membership?",
     "Everything. Every ebook, every video course as it drops, and the new content that lands every month. "
     "It is the same price as one pizza, and less than a single ebook."),
    ("How do I read the ebooks?",
     "Two ways, your choice: read them right on the site in your library (with your own notes saved per book), "
     "or download the PDF and keep it forever on any device."),
    ("Can I cancel anytime?",
     "Yes, in one click from your dashboard. You keep access through the period you paid for, "
     "and your free community membership never goes away."),
    ("What if a book or course isn't for me?",
     "Everything comes with a 7-day, no-questions refund. Email me within 7 days and I will send your money back."),
    ("Is this on my phone?",
     "Yes. The whole Academy works on mobile, and you can install it to your home screen as an app. "
     "The feed, your library, the videos, and your messages come with you."),
]

def faq_section():
    items = "".join(
        f'<details><summary>{q}<span class="fx" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg></span></summary><div class="fa">{a}</div></details>'
        for q, a in FAQ)
    return f"""<section class="section" style="background:var(--bg-soft)"><div class="wrap">
<div style="text-align:center;margin-bottom:clamp(26px,3.4vw,44px)">
<span class="kicker gold reveal">Questions</span>
<h2 class="display-m reveal" style="margin-top:12px">Fair questions, straight answers.</h2>
</div>
<div class="faq reveal">{items}</div>
</div></section>"""

def pricing():
    def alc_card(tag, title, desc, feats, cta_label, buy, featured=False):
        fl = "".join(f"<li>{x}</li>" for x in feats)
        style = "border-color:#f3dfa0;box-shadow:var(--shadow-card)" if featured else ""
        return f"""<div class="pcard" style="padding:28px;{style}">
<div class="tagrow">{tag}</div>
<h3 style="margin-top:8px">{title}</h3>
<div style="margin:12px 0 4px">{price_block(buy, big=True)}</div>
<p class="blurb" style="margin-top:4px">{desc}</p>
<ul class="flist" style="margin-top:16px">{fl}</ul>
<div style="margin-top:auto;padding-top:24px"><a class="btn {'gold' if featured else 'ghost'}" data-buy="{buy}" href="#">{cta_label}</a></div></div>"""
    alc = "".join([
        alc_card('<span class="tag">EBOOK</span>', "Build Your First AI Agent",
             "The no-code agent guide, on its own.", ["Easy 24-page PDF, screenshots included", "Read on-site or download", "7-day refund"],
             "Get this ebook", "ai-agent-ebook"),
        alc_card('<span class="tag gold"><span class="dot"></span>BUNDLE &amp; SAVE</span>', "The Bundle",
             "Both ebooks together. Build the agent, then the business.",
             ["Build Your First AI Agent", "The AI Money Machine", "Save vs buying separately", "First in line for the video courses"],
             "Get the bundle", "bundle", featured=True),
        alc_card('<span class="tag">EBOOK</span>', "The AI Money Machine",
             "The recurring-income service playbook, on its own.", ["Easy 24-page PDF, graphics included", "Prompts and templates included", "7-day refund"],
             "Get this ebook", "boring-money"),
    ])
    return head("Pricing — Taylormade Academy", "Join free, or unlock every ebook and video course for $15/mo. Ebooks also available one-time. 7-day refund on everything.", "/pricing/") + header("Pricing") + f"""
<main>
<section class="section tight" style="padding-bottom:0"><div class="wrap" style="text-align:center">
<span class="kicker gold reveal">Pricing</span>
<h1 class="display-l reveal" style="margin-top:14px">Start free.<br>Go all-access for $15.</h1>
<p class="lead reveal" style="margin:18px auto 0;max-width:46ch">One membership unlocks everything. No tiers to decode, no card to start.</p>
</div></section>
<section class="section"><div class="wrap">
{mem_cards("pricing")}
</div></section>
<section class="section" style="padding-top:0"><div class="wrap">
<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:end;justify-content:space-between;margin-bottom:26px">
<div><span class="kicker gold reveal">Rather own one thing?</span><h2 class="display-m reveal" style="margin-top:10px">The ebooks, a la carte.</h2></div>
<span class="reveal" style="font-size:14px;color:var(--muted)">One-time. Yours forever.</span></div>
<div class="products" data-stag style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">{alc}</div>
<p class="reveal" style="margin-top:26px;font-size:14.5px;color:var(--muted)"><b style="color:var(--ink)">Both ebooks (and every course) come with the $15/mo membership.</b> Video courses are in production now. Members stream them all; single videos will sell a la carte at $19 each. <a class="textlink" href="/course/">Preview the course player &rarr;</a></p>
</div></section>
{faq_section()}
<section class="section cta-band"><div class="wrap">
<h2 class="display-m reveal">Still thinking? Start free.</h2>
<p class="lead reveal" style="margin:14px auto 0;max-width:40ch">The community and the Playbook cost nothing. Upgrade only when you want everything.</p>
<div class="cta-row reveal" style="justify-content:center"><a class="btn gold" href="/login/?mode=join">Join free <span class="arr">&rarr;</span></a></div>
</div></section>
</main>""" + footer()

# ---------- ABOUT ----------
def about():
    return head("About Nelson — Taylormade Academy", "Nelson Taylor is a Dallas-Fort Worth creative who teaches graphic design, photography, video, and AI.", "/about/") + header("About") + f"""
<main>
<section class="section tight"><div class="wrap"><div class="g-12" style="align-items:start;gap:clamp(24px,4vw,56px)">
<div class="reveal" style="grid-column:1/7">
<span class="kicker gold">About</span>
<h1 class="display-l" style="margin-top:12px">I am Nelson Taylor, and I build things for a living.</h1>
<p class="lead" style="margin-top:20px;max-width:48ch">Fourteen years as a creative in Dallas-Fort Worth: graphic design, photography, video, and now AI. I am not a computer scientist. I am a builder who learned to make this stuff do real work, and I teach it the way I wish someone had taught me. Plain English. Real projects. Honest about the effort.</p>
{socials_row(style="margin-top:24px")}
<div style="background:var(--bg-soft);border:1px solid var(--hair);border-radius:14px;padding:20px 22px;margin-top:30px">
<p style="font-size:18px">Most online teaching is built to sell you a dream. I would rather hand you a craft. The ebooks and courses here come from real work, including a live workshop I ran for about 50 students, not from a content farm.</p></div>
</div>
<div class="reveal" style="grid-column:8/13;padding-top:8px">
<div class="hero-frame" style="max-width:none;margin-bottom:22px">
<picture><source srcset="/assets/hero-nelson.webp" type="image/webp">
<img class="hero-img" src="/assets/hero-nelson.png" width="942" height="941" alt="Nelson Taylor, Taylormade Creative" loading="lazy" decoding="async">
</picture></div>

</div></div></div></section>

<section class="section on-ink" id="workshops"><div class="wrap">
<span class="kicker gold reveal">The receipts</span>
<h2 class="display-l reveal" style="margin-top:14px;max-width:18ch">What I have actually shipped.</h2>
<div class="audience" data-stag style="margin-top:38px">
<div class="a"><div class="h">The AUC workshop</div><div class="d">A live 3-night "Build Your First AI Agent" sprint with AUC's Data Science Institute and Johns Hopkins, for about 50 HBCU students.</div></div>
<div class="a"><div class="h">A shipped iOS app</div><div class="d">A real app on the App Store. Not a prototype, not a slide. Something people can download.</div></div>
<div class="a"><div class="h">14 years of client work</div><div class="d">Design, video, branding, and AI for real businesses across Dallas-Fort Worth.</div></div>
<div class="a"><div class="h">These ebooks</div><div class="d">Written from the work, not from theory. The same steps I teach live.</div></div>
</div></div></section>

<section class="section cta-band"><div class="wrap">
<span class="kicker gold reveal" style="justify-content:center">Your turn</span>
<h2 class="display-l reveal" style="margin-top:14px">Let me show you how I do it.</h2>
<div class="cta-row reveal" style="justify-content:center"><a class="btn gold" href="/login/?mode=join">Join free <span class="arr">&rarr;</span></a><a class="btn ghost" href="/store/">Get the ebooks</a></div>
</div></section>
</main>""" + footer()

# ---------- simple stubs (footer links, no-404) ----------
def stub(title, kicker, heading, body_html, active=""):
    return head(f"{title} — Taylormade Academy", heading, "/") + header(active) + f"""
<main><section class="section"><div class="wrap" style="max-width:760px">
<span class="kicker gold">{kicker}</span><h1 class="display-m" style="margin-top:12px">{heading}</h1>
<div style="margin-top:20px">{body_html}</div>
<p style="margin-top:30px"><a class="btn ghost" href="/">Back home</a></p>
</div></section></main>""" + footer()

def community_landing():
    """Marketing landing for /join/ — the logged-out pitch for the community.
    (The live member app owns /community/; this page sells it.)"""
    return head("The Community — Taylormade Academy", "A free community of designers, photographers, video people, and AI builders. A feed, DMs, and a member directory, hosted by Nelson Taylor.", "/join/") + header("Community") + f"""
<main>
<section class="section tight" style="padding-bottom:0"><div class="wrap" style="max-width:900px;text-align:center">
<span class="hero-badge reveal"><span class="dot"></span>Free to join, free forever</span>
<h1 class="display-xl reveal" style="margin-top:22px">The build crew.</h1>
<p class="lead reveal" style="margin:20px auto 0;max-width:52ch">Designers, photographers, video people, and AI builders in one room. Post your work, ask questions, get unstuck, and meet people to create with: collaborators, friends, even business partners.</p>
<div class="cta-row reveal" style="justify-content:center"><a class="btn gold" href="/login/?mode=join">Join free <span class="arr">&rarr;</span></a><a class="btn ghost" href="/login/">Sign in</a></div>
</div></section>
<section class="section plat on-ink" style="margin-top:clamp(48px,6vw,84px)"><div class="wrap">
<div class="plat-head">
<span class="kicker gold reveal">What's inside</span>
<h2 class="display-l reveal" style="margin-top:14px">A real room, not a comment section.</h2>
</div>
{plat_mock()}
{plat_feats()}
<div class="reveal" style="text-align:center;margin-top:clamp(36px,4.4vw,56px)"><a class="btn gold" href="/login/?mode=join">Join the community free <span class="arr">&rarr;</span></a></div>
</div></section>
<section class="section"><div class="wrap" style="max-width:900px">
<div class="cred reveal">
<div class="cred-l"><span class="goldbar"></span><span>Hosted by <b>Nelson Taylor</b>, 14 years a working Dallas-Fort Worth creative, in the room every day.</span></div>
<div class="cred-chips">
<span class="cred-chip">Shipped iOS app</span>
<span class="cred-chip">Design, photo &amp; video</span>
<span class="cred-chip">Ran a live AI build sprint</span>
</div></div>
</div></section>
</main>""" + footer()

def not_found():
    return head("Page not found — Taylormade Academy",
                "That page moved or never existed. Head back to Taylormade Academy.", "/404") + header() + """
<main><section class="section" style="text-align:center"><div class="wrap" style="max-width:620px">
<span class="kicker gold" style="justify-content:center">Error 404</span>
<h1 class="display-l" style="margin-top:14px">This page took a different path.</h1>
<p style="margin:16px auto 0;color:var(--muted);max-width:46ch">The link is broken or the page moved. Let's get you back to building.</p>
<div class="cta-row" style="justify-content:center;margin-top:28px;display:flex;gap:12px;flex-wrap:wrap">
<a class="btn gold" href="/">Back home <span class="arr">&rarr;</span></a>
<a class="btn ghost" href="/store/">Browse the store</a></div>
</div></section></main>""" + footer()

SITEMAP_PATHS = ["/", "/store/", "/store/ai-agent-ebook/", "/store/boring-money/", "/store/steal-your-week-back/",
                 "/store/fully-booked-trainer/", "/store/always-on-agent/", "/store/busy-season-handled/",
                 "/pricing/", "/about/", "/join/", "/community/", "/login/", "/refunds/", "/terms/", "/privacy/"]

def write_meta():
    (ROOT / "404.html").write_text(not_found())
    (ROOT / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\nSitemap: " + DOMAIN + "/sitemap.xml\n")
    urls = "".join(f"  <url><loc>{DOMAIN}{p}</loc><changefreq>weekly</changefreq></url>\n" for p in SITEMAP_PATHS)
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '</urlset>\n')

PRIVACY_BODY = """
<p style="color:var(--muted);font-size:14px;margin-top:-6px">Last updated: June 26, 2026</p>
<p>This is the real, plain-English version. I'm Nelson Taylor, and Taylormade Academy is my education and community platform (Taylormade Creative, Dallas-Fort Worth, Texas). This policy covers the website at taylormadeacademy.com and the Taylormade Academy mobile app, which both use the same account and the same backend.</p>
<p>The short version: I collect only what I need to run your account, deliver what you signed up for or bought, and keep the community working. I do not sell your data. I do not run ads, and I do not track you across other apps or websites for advertising. That's it.</p>

<h2>Who I am</h2>
<p>Taylormade Academy is operated by Nelson Taylor / Taylormade Creative, based in the Dallas-Fort Worth area, Texas, USA. If you have any privacy question or request, email me directly: <strong>taylormademd@gmail.com</strong>.</p>

<h2>What I collect</h2>
<p>I only collect a few things, and only because the product needs them to work:</p>
<ul>
<li><strong>Your email address</strong> &mdash; used to sign you in (I use "magic link" sign-in, so you log in by clicking a link I email you instead of using a password) and to send you account and product emails.</li>
<li><strong>Your display name</strong> &mdash; so the community and your account have a name to show.</li>
<li><strong>Your profile photo</strong> &mdash; optional. Only if you choose to upload one.</li>
<li><strong>Your interests / bio</strong> &mdash; optional. Only if you choose to fill them in.</li>
<li><strong>Your purchase history</strong> &mdash; which ebooks or membership you've bought, so I can give you access to what you paid for. <strong>I never see or store your card number.</strong> All card payments are handled by Stripe.</li>
<li><strong>Basic usage information</strong> &mdash; basic activity in the app or on the site, like which courses, ebooks, or pages you open, so the product works and I can see what's useful and what's broken.</li>
</ul>
<p>If you post in the community &mdash; posts, comments, or direct messages to other members &mdash; that content is stored so the community can function and so the people you're talking to can see it.</p>
<p><strong>What I do NOT collect:</strong> I don't collect your location, your contacts, your card numbers, health data, or anything for advertising. There are no ads and no third-party advertising trackers in this product.</p>

<h2>How I use what I collect</h2>
<p>I use your information to create and run your account and sign you in; give you access to the free Playbook, any ebooks or membership you buy, and the community; show your name (and photo, if you added one) in the community and member directory; send you emails you'd expect (sign-in links, purchase confirmations, account notices, and the occasional product update or newsletter you opted into); understand basic usage so I can improve the platform; and handle payments, refunds, and support.</p>
<p>I do <strong>not</strong> use your data to build advertising profiles, and I do <strong>not</strong> sell or rent your information to anyone. Ever.</p>

<h2>The companies that help me run this (processors)</h2>
<p>I'm a small operation, so I use a few trusted services to run the product. They only process your data to provide their service to me, under their own privacy and security commitments:</p>
<ul>
<li><strong>Supabase</strong> &mdash; stores your account, your profile, your community content, and handles sign-in. (<a href="https://supabase.com/privacy" target="_blank" rel="noopener">supabase.com/privacy</a>)</li>
<li><strong>Stripe</strong> &mdash; processes payments. When you pay, you enter your card details with Stripe, not with me. I receive a record that you paid and what you bought, but never your card number. (<a href="https://stripe.com/privacy" target="_blank" rel="noopener">stripe.com/privacy</a>)</li>
<li><strong>Resend</strong> &mdash; sends the emails I send you (sign-in links, receipts, updates). (<a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener">resend.com/legal/privacy-policy</a>)</li>
</ul>
<p>These providers act on my instructions. I don't share your data with anyone else for their own marketing or advertising. I may also disclose information if the law requires it, or to protect the safety, rights, or property of members or the platform.</p>

<h2>Cookies and similar technology</h2>
<p>The site and app use basic cookies and local storage to keep you signed in and remember things like your cart. These are functional &mdash; they're needed for the product to work. I don't use advertising cookies or cross-site ad trackers.</p>

<h2>How your data is protected</h2>
<p>All traffic between your device, the website, and the services above is encrypted in transit (HTTPS/TLS). Your account data is stored with Supabase, and payment data is handled by Stripe, both of which maintain their own security practices. No system is perfectly secure, but I keep the footprint small and only collect what's needed.</p>

<h2>How long I keep your data</h2>
<p>I keep your account information for as long as you have an account. Purchase records are kept as long as I need them for tax, accounting, and refund purposes. When you ask me to delete your account, I remove your personal profile data, though some records (like a basic record that a purchase happened) may be retained where I'm legally required to keep them.</p>

<h2>Deleting your account and your data</h2>
<p>You can delete your account and your data at any time. Just email me at <strong>taylormademd@gmail.com</strong> from the address on your account, or tell me the email you signed up with, and ask me to delete your account. I'll remove your profile, your community content, and your personal data, except for any records I'm legally required to keep (such as basic transaction records for tax purposes). I'll confirm when it's done. You can also email me at the same address to see what data I have about you, or to correct it.</p>

<h2>Refunds</h2>
<p>Taylormade Academy has a 7-day refund policy on purchases. Refund requests are handled through Stripe and processed back to your original payment method. Email <strong>taylormademd@gmail.com</strong> to request a refund.</p>

<h2>Children</h2>
<p>Taylormade Academy is built for adults and creatives learning their craft. It is <strong>not directed at children under 13</strong>, and I don't knowingly collect personal information from anyone under 13. If you believe a child under 13 has created an account, email me at <strong>taylormademd@gmail.com</strong> and I'll delete it.</p>

<h2>Your choices</h2>
<ul>
<li>You can update your display name, photo, and interests in your account.</li>
<li>You can unsubscribe from newsletters/product emails using the link in any of those emails. (I'll still need to send you essential account emails, like sign-in links and receipts, while you have an account.)</li>
<li>You can ask me to delete your account and data at any time.</li>
</ul>

<h2>Changes to this policy</h2>
<p>If I change this policy, I'll update the date at the top and post the new version here. If it's a meaningful change, I'll do my best to let account holders know.</p>

<h2>Contact</h2>
<p>Questions, requests, or anything privacy-related:<br>
<strong>Nelson Taylor &mdash; Taylormade Creative</strong><br>
Email: <strong>taylormademd@gmail.com</strong><br>
Dallas-Fort Worth, Texas, USA</p>
"""

if __name__ == "__main__":
    render("/", home())
    render("/store/", store())
    render("/store/ai-agent-ebook/", product_page("ai-agent-ebook"))
    render("/store/boring-money/", product_page("boring-money"))
    render("/store/steal-your-week-back/", product_page("steal-your-week-back"))
    render("/store/fully-booked-trainer/", product_page("fully-booked-trainer"))
    render("/store/always-on-agent/", product_page("always-on-agent"))
    render("/store/busy-season-handled/", product_page("busy-season-handled"))
    render("/pricing/", pricing())
    render("/about/", about())
    render("/join/", community_landing())
    # NOTE: /community/, /login/, /dashboard/, and /library/ are the live member-area app pages.
    # They are hand-maintained (vanilla JS + supabase-js, not generated chrome) so the
    # generator must NOT render or overwrite them. Edit those index.html files directly.
    render("/refunds/", stub("Refunds", "Policy", "Refund policy",
        "<p>Digital products come with a 7-day, no-questions refund. If an ebook did not help, email me within 7 days of buying and I will refund it. The community and any future subscription can be canceled anytime, and you keep access through the period you paid for.</p>"))
    render("/terms/", stub("Terms", "Legal", "Terms of use",
        "<p>Taylormade Academy is an education product by Taylormade Creative. The ebooks, courses, and community are for your personal use. Please do not resell or redistribute the files. This is educational material, not a guarantee of income, and not professional legal, financial, or medical advice. Full terms will be posted here before payments go live.</p>"))
    render("/privacy/", stub("Privacy", "Legal", "Privacy", PRIVACY_BODY))
    render("/thank-you/", stub("Thank you", "You're in", "Thank you. Check your email.",
        "<p>Your purchase is confirmed and your download is on the way to your inbox. Create your account with the same email to keep everything in your library, and come say hey in the community.</p>", ))
    write_meta()
    stamped = stamp_app_pages(ASSET_VER)
    print("built: home, store, 2 product pages, pricing, about, community, + 4 stubs")
    print("built: 404.html, robots.txt, sitemap.xml")
    print(f"asset cache-bust version: {ASSET_VER}")
    print(f"stamped app pages (asset ?v= only, bodies untouched): {', '.join(stamped) or 'none'}")
