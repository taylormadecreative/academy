#!/usr/bin/env python3
"""Taylormade Academy static site generator. Shared chrome + page bodies -> route/index.html.
Marketing storefront builds fully with NO keys; Buy buttons degrade to a 503 notice
until Supabase/Stripe are wired."""
import pathlib, hashlib, re, urllib.parse

ROOT = pathlib.Path(__file__).parent
DOMAIN = "https://academy.taylormadecreative.net"

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

NAV = [("Community", "/community/"), ("Courses", "/store/"), ("Ebooks", "/library/"), ("Pricing", "/pricing/"), ("About", "/about/")]

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

HERO_BLOB = ('<svg class="blob" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    '<defs><linearGradient id="hb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dbeafe"/><stop offset="0.55" stop-color="#bfdbfe"/><stop offset="1" stop-color="#93c5fd"/></linearGradient></defs>'
    '<path fill="url(#hb)" d="M455,95 C545,160 582,290 530,395 C485,490 375,548 263,533 C158,519 58,450 44,338 C31,233 96,118 211,81 C301,52 370,33 455,95 Z"/></svg>')

def hero_photo():
    return ('<div class="hero-shot">'
            '<picture><source srcset="/assets/hero-nelson.webp" type="image/webp">'
            '<img class="hero-img" src="/assets/hero-nelson.png" width="942" height="941" '
            'fetchpriority="high" alt="Nelson Taylor, founder of Taylormade Academy, in a Taylormade Creative varsity jacket"></picture>'
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
<div class="nav-cta"><a class="navlink" href="/login/">Sign In</a><a class="btn gold sm" href="/login/">Join Community <span class="arr">&rarr;</span></a>
<button class="btn ghost sm cart-btn" data-open-cart aria-label="Cart"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 7h14l1 13H4z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg><span class="cc" id="cartCount" style="display:none">0</span></button>
<button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="mnav" onclick="var o=document.getElementById('mnav').classList.toggle('open');this.setAttribute('aria-expanded',o)"><span></span><span></span><span></span></button></div>
</div></div><div class="mobile-nav" id="mnav">{mlinks}<a href="/login/">Sign In</a><a class="btn gold" href="/login/">Join Community</a></div></header>"""

def footer():
    socials = "".join(f'<a href="{u}" target="_blank" rel="noopener" style="color:var(--muted);margin-right:18px">{t}</a>' for t, u in SOCIALS)
    cols = {
        "Explore": [("Courses", "/store/"), ("Ebooks", "/store/"), ("Pricing", "/pricing/"), ("About", "/about/")],
        "Community": [("The feed", "/community/"), ("Facebook group", FB_GROUP), ("Messages", "/community/"), ("Join free", "/login/")],
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
<div style="display:flex;flex-wrap:wrap;margin-top:14px;font-size:14px;font-weight:600">{socials}</div></div>
{colhtml}
<div class="foot-col"><h4>Stay in the loop</h4>
<p style="font-size:14px;color:var(--muted);margin-bottom:12px;max-width:30ch">New courses, ebooks, and community drops, to your inbox.</p>
<form onsubmit="return BM.subscribe(event,'footer')" style="display:flex;gap:8px;flex-wrap:wrap">
<input type="email" name="email" placeholder="you@email.com" required style="flex:1;min-width:150px;padding:11px 14px;border:1.5px solid var(--hair);border-radius:10px;font-family:inherit;font-size:14px;background:#fff">
<button class="btn gold sm" type="submit">Subscribe</button></form></div>
</div>
<div class="foot-bottom"><span>&copy; 2026 Taylormade Creative. All rights reserved.</span>
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
<h2 class="pop-title">The Creator's<br><span class="blue">AI</span> <span class="gold">Playbook</span></h2>
<p class="pop-sub">Create your free account and the Playbook is waiting inside — plus the community, members, and DMs. 100% free.</p>
<ul class="pop-bullets">
<li><span class="bi"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M21 9v5"/><path d="M7 11v4c0 1 2.2 2.2 5 2.2s5-1.2 5-2.2v-4"/></svg></span> Learn AI skills</li>
<li><span class="bi"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M14 4l6 6L9 21H3v-6z"/><path d="M12.5 6.5l5 5"/></svg></span> Create amazing content</li>
<li><span class="bi"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.3 9.2c0-1.2 1.2-2 2.7-2s2.7.8 2.7 2-1.2 1.8-2.7 1.8-2.7.7-2.7 1.9 1.2 2 2.7 2 2.7-.8 2.7-2"/></svg></span> Earn &amp; build income</li>
<li><span class="bi"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="9" r="2.2"/><path d="M16.5 13.6A4.6 4.6 0 0 1 21 18"/></svg></span> Join a community that wins</li>
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
<p>Get the Playbook and weekly <span class="gold">exclusive tips</span> — free.</p>
<form class="pop-form" onsubmit="return BM.getEbook(event)">
<span class="pf-input"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></svg><input type="email" name="email" placeholder="Enter your email address" required></span>
<button class="btn gold" type="submit">Create my free account</button>
</form>
<div class="pob-fine"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> No spam. Unsubscribe anytime.</div>
</div>
<div class="pop-free"><span class="gift"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/></svg></span><strong>100% FREE</strong><span>No catch. Just value. Just for you.</span></div>
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
APP_PAGES = ("community", "login", "dashboard", "library", "welcome", "review")
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

def preview_panel():
    return ('<div class="preview">'
      '<div class="pv-top">'
      '<div class="pv-side"><div class="pv-logo"></div>'
      '<div class="pv-i on">Home</div><div class="pv-i">Courses</div><div class="pv-i">Ebooks</div>'
      '<div class="pv-i">Community</div><div class="pv-i">Messages</div><div class="pv-i">Store</div></div>'
      '<div class="pv-main"><div class="pv-h">Welcome back<b>Keep building.</b></div>'
      '<div class="pv-cards"><div class="pv-card"><div class="t">Courses</div><div class="v">4</div></div>'
      '<div class="pv-card"><div class="t">Ebooks</div><div class="v">2</div></div>'
      '<div class="pv-card"><div class="t">Community</div><div class="v">Free</div></div></div>'
      '<div class="pv-wide"><div class="thumb"></div><div style="flex:1;min-width:0">'
      '<div class="b">Build Your First AI Agent</div><div class="s">Continue, chapter 2</div>'
      '<div class="pv-bar"><i></i></div></div></div>'
      '<div class="pv-wide"><div class="thumb"></div><div style="flex:1;min-width:0">'
      '<div class="b">The community feed</div><div class="s">New posts from members</div></div></div>'
      '</div></div></div>')

def feature_bar():
    IC = {
      "play":'<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
      "doc":'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4a1 1 0 0 1 1-1h7l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M13 3v5h5"/></svg>',
      "ppl":'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="9" r="2.2"/><path d="M16.5 13.6A4.6 4.6 0 0 1 21 18"/></svg>',
      "chat":'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-4 3z"/></svg>',
      "store":'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 7h14l1 13H4z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    }
    items = [("#2563eb","play","Video Courses","In-depth, practical courses that teach by doing."),
             ("#10b981","doc","Ebooks &amp; PDFs","Actionable guides and resources you keep forever."),
             ("#f97316","ppl","Community Feed","Share, ask, and grow with other creatives."),
             ("#6366f1","chat","DMs &amp; Collaboration","Message members and build together."),
             ("#f59e0b","store","A La Carte Store","Buy a single video or ebook, yours to keep.")]
    return "".join(f'<div class="f"><div class="ic" style="background:{c}">{IC[k]}</div><div class="h">{h}</div><div class="d">{d}</div></div>' for c,k,h,d in items)

COVER_DIMS = {"/assets/cover-ai-agent-v2.png": (840, 1120), "/assets/cover-money-machine.png": (840, 1120)}

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
    for slug in ("ai-agent-ebook", "boring-money"):
        p = PRODUCTS[slug]
        out += (f'<article class="pcard"><a class="top" href="/store/{slug}/">{cover_pic(p)}</a>'
                f'<div class="meta"><div class="tagrow"><span class="tag gold"><span class="dot"></span>EBOOK</span><span class="tag">{p["pages"]}</span></div>'
                f'<h3>{p["title"]}</h3><p class="blurb">{p["blurb"][:92]}…</p></div>'
                f'<div class="foot">{price_block(slug)}<a class="btn ghost sm" href="/store/{slug}/">Details <span class="arr">&rarr;</span></a></div></article>')
    for name, desc, thumb in (("Design Like a Pro", "Graphic design from 14 years of client work, the eye and the tools.", "course-design"),
                       ("Cinematic Video", "Shoot, light, and edit video on any camera, start to finish.", "course-video")):
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
    return ("""<style>
.ailaunch{background:radial-gradient(120% 100% at 50% -20%,#0a205c,#04123a);border-radius:var(--r-lg);padding:clamp(26px,4vw,44px);display:grid;grid-template-columns:1.1fr 1fr;gap:clamp(22px,3vw,44px);align-items:center;}
.ailaunch .eyb{font:700 12px/1 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#fdc921;}
.ailaunch h2{font-family:var(--display);color:#fff;font-size:clamp(26px,3.4vw,38px);line-height:1.05;letter-spacing:-.02em;margin:12px 0 0;}
.ailaunch p{color:#bcc8e6;font-size:16px;line-height:1.6;margin:12px 0 0;max-width:44ch;}
.ailaunch .btns{display:flex;flex-direction:column;gap:12px;}
.ai-btn{display:flex;align-items:center;gap:13px;background:#fff;border-radius:14px;padding:15px 16px;text-decoration:none;box-shadow:0 12px 26px -16px rgba(0,0,0,.6);transition:transform .14s;}
.ai-btn:active{transform:scale(.98);}
.ai-btn .aiic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
.ai-btn b{display:block;font-family:var(--display);font-size:16px;color:#0a1733;}
.ai-btn .aism{font-size:12px;color:#8493ad;}
.ai-btn .aiar{font-family:var(--display);font-weight:700;color:#0b40e0;font-size:18px;margin-left:auto;}
@media(max-width:760px){.ailaunch{grid-template-columns:1fr;}}
</style>
<section class="section tight" style="padding-top:30px;padding-bottom:6px"><div class="wrap">
<div class="ailaunch reveal">
<div><span class="eyb">AI Quick Launch</span>
<h2>Talk to your AI. One tap.</h2>
<p>Jump straight into ChatGPT or Claude with a prompt already loaded &mdash; the fastest way to put AI to work on your day, your studies, or your hustle.</p></div>
<div class="btns">""" + btn(CHATGPT_URL, "#10a37f", "ChatGPT") + btn(CLAUDE_URL, "#d97757", "Claude") + """</div>
</div></div></section>""")

# ---------- HOME ----------
def home():
    return head(
        "Taylormade Academy — Learn the craft. Build real things. Create real income.",
        "Taylormade Academy by Nelson Taylor. Video courses, ebooks, and a private community to learn graphic design, photography, video, and AI, and build real things, out of Dallas-Fort Worth.",
        "/", preload_hero=True) + header("Community") + f"""
<main>
<section class="hero"><div class="wrap"><div class="h-grid">
<div class="hero-copy reveal">
<span class="hero-badge">The creative community for builders</span>
<h1 class="display-xl" style="margin-top:18px">Learn the craft.<br>Build real things.<br><span class="blue u-gold">Create real income.</span></h1>
<p class="sub">Step-by-step video courses, plain-English ebooks, and a private community, helping creators and hustlers use design, photo, video, and AI to build, ship, and earn. Hosted by Nelson Taylor.</p>
<div class="cta-row"><a class="btn gold" href="/login/">Join Free <span class="arr">&rarr;</span></a><a class="btn ghost" href="/store/">Start Learning</a><a class="btn ghost" href="/store/">Browse Ebooks</a></div>
<div class="statline"><div class="s"><div class="n">Free</div><div class="l">to join, forever</div></div><div class="s"><div class="n">4</div><div class="l">creative tracks</div></div><div class="s"><div class="n">2</div><div class="l">ebooks ready now</div></div></div>
</div>
<div class="hero-art reveal">{hero_photo()}</div>
</div></div></section>

{ai_launch()}

<section class="section tight" style="padding-top:26px"><div class="wrap">
<div class="reveal" style="max-width:880px;margin:0 auto;text-align:center">
<span class="kicker gold">Watch the intro</span>
<h2 class="display-m" style="margin-top:8px">See what we're building.</h2></div>
<div class="reveal" style="max-width:880px;margin:18px auto 0;border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow);background:#04123a;border:1px solid var(--hair)">
<video style="display:block;width:100%;aspect-ratio:16/9;background:#04123a" src="/assets/home-hero-nelson.mp4" poster="/assets/home-hero-poster.jpg" controls playsinline preload="none"></video></div>
<div class="reveal" style="text-align:center;margin-top:20px"><a class="btn gold" href="/login/">Join Free <span class="arr">&rarr;</span></a></div>
</div></section>

<section class="section tight" style="padding-top:4px;padding-bottom:0"><div class="wrap">
<div class="cred reveal">
<div class="cred-l"><span class="goldbar"></span><span>Taught by <b>Nelson Taylor</b> &mdash; 14 years a working Dallas-Fort Worth creative, not a content farm.</span></div>
<div class="cred-chips">
<span class="cred-chip">Shipped iOS app on the App Store</span>
<span class="cred-chip">Design, photo &amp; video</span>
<span class="cred-chip">BFA, Art Institute of Dallas</span>
<span class="cred-chip">Ran a live AI build sprint</span>
</div></div>
</div></section>

<section class="section tight" style="padding-top:18px"><div class="wrap">
<div class="featurebar reveal">{feature_bar()}</div>
</div></section>

<section class="section tight"><div class="wrap">
<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:end;justify-content:space-between;margin-bottom:24px">
<div><span class="kicker gold reveal">Popular right now</span><h2 class="display-m reveal" style="margin-top:8px">Start with these.</h2></div>
<a class="textlink reveal" href="/store/">View all courses &rarr;</a></div>
<div class="products reveal" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">{popular_cards()}</div>
</div></section>

<section class="section tight"><div class="wrap">
<div class="freebook reveal">
<img class="fb-cover" src="/assets/ebook-book.webp" width="180" height="240" alt="The Creator's AI Playbook free ebook" loading="lazy">
<div class="fb-copy">
<span class="kicker gold" style="color:var(--blue-2)">Free starter guide</span>
<h2 class="display-m" style="margin-top:8px;color:#fff">Start with the free AI Playbook.</h2>
<p style="color:#aebbd8;margin-top:10px;max-width:50ch">The 3 tools, where to click, every beginner term, and the prompt formula, in a quick 11-page read. Drop your email and it's yours, free.</p>
<button class="btn gold" data-get-ebook style="margin-top:18px">Join free for the Playbook <span class="arr">&rarr;</span></button>
</div>
</div>
</div></section>

<section class="section"><div class="wrap">
<div style="background:linear-gradient(180deg,var(--blue-soft),#fff);border:1px solid #dbeafe;border-radius:var(--r-lg);padding:clamp(26px,4vw,46px)">
<div style="text-align:center;max-width:60ch;margin:0 auto 30px">
<span class="kicker gold reveal">A community of builders, designers &amp; creators</span>
<h2 class="display-l reveal" style="margin-top:12px">More than a platform. Your creative home.</h2>
<p class="reveal" style="margin:14px auto 0;color:var(--muted)">Make friends, get feedback, collaborate on projects, and stay inspired. Start free, upgrade when you want more.</p>
<div class="reveal" style="margin-top:18px"><a class="btn ghost sm" href="{FB_GROUP}" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6v1.9h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg> Join the free Facebook group <span class="arr">&rarr;</span></a></div></div>
<div class="tiers reveal" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr));max-width:720px;margin:0 auto">
<div class="tier"><div class="pname">Free</div><div class="pprice">$0<span> / forever</span></div><div class="pdesc">A real taste, free forever.</div><ul class="flist" style="margin:16px 0"><li>The community + members + DMs</li><li>Free intro videos + sample ebooks</li><li>Free guides and resources</li></ul><a class="btn ghost" style="margin-top:auto" href="/login/">Join Free</a></div>
<div class="tier feat"><div class="tagrow" style="margin-bottom:8px"><span class="tag gold"><span class="dot"></span>ALL ACCESS</span></div><div class="pname">Membership</div><div class="pprice">$15<span> / month</span></div><div class="pdesc">Everything unlocked, about the price of a pizza.</div><ul class="flist" style="margin:16px 0"><li>Every ebook + video course</li><li>Everything in Free</li><li>New content every month</li><li>Cancel anytime</li></ul><a class="btn gold" style="margin-top:auto" data-buy="all-access" href="#">Start learning <span class="arr">&rarr;</span></a></div>
</div></div>
</div></section>
</main>""" + footer()

# ---------- STORE ----------
def store():
    p1, p2 = PRODUCTS["ai-agent-ebook"], PRODUCTS["boring-money"]
    def ebook_card(slug, p):
        return (f'<article class="pcard" data-cat="ebook">'
                f'<a class="top" href="/store/{slug}/">{cover_pic(p)}</a>'
                f'<div class="meta"><div class="tagrow"><span class="tag gold"><span class="dot"></span>EBOOK</span><span class="tag">{p["pages"]}</span></div>'
                f'<h3>{p["title"]}</h3><p class="blurb">{p["blurb"][:88]}…</p></div>'
                f'<div class="foot">{price_block(slug)}<button class="btn gold sm" data-add-cart="{slug}" data-title="{p["title"]}">Add to cart</button></div></article>')
    def soon_card(name, desc, key):
        return (f'<article class="pcard" data-cat="soon">{course_top("course-" + key, name)}'
                f'<div class="meta"><div class="tagrow"><span class="tag live"><span class="dot"></span>IN PRODUCTION</span></div>'
                f'<h3>{name}</h3><p class="blurb">{desc}</p></div>'
                f'<div class="foot" style="display:block"><form onsubmit="return BM.subscribe(event,\'store-{key}\')" style="display:flex;gap:8px">'
                f'<input type="email" name="email" placeholder="you@email.com" required style="flex:1;min-width:110px;padding:10px 12px;border:1.5px solid var(--hair);border-radius:9px;font-family:inherit;font-size:13px;background:#fff">'
                f'<button class="btn gold sm" type="submit">Notify</button></form></div></article>')
    grid = (ebook_card("ai-agent-ebook", p1) + ebook_card("boring-money", p2)
            + soon_card("Design Like a Pro", "Graphic design from 14 years of client work, the eye and the tools.", "design")
            + soon_card("Cinematic Video", "Shoot, light, and edit video on any camera, start to finish.", "video")
            + soon_card("Photography That Sells", "Lighting, shooting, and editing images that stop the scroll.", "photo"))
    return head("Store — Taylormade Academy", "Buy what you need: ebooks, PDFs, and courses for design, photo, video, and AI. Or join the membership for everything.", "/store/") + header("Courses") + f"""
<main>
<section class="section tight"><div class="wrap">
<div class="g-12" style="align-items:stretch;gap:clamp(20px,3vw,32px)">
<div style="grid-column:1/7;display:flex;flex-direction:column;justify-content:center">
<span class="kicker gold reveal">A la carte store</span>
<h1 class="display-l reveal" style="margin-top:10px">Buy what you need.<br><span class="blue">Learn, create, earn.</span></h1>
<p class="reveal" style="margin-top:14px;color:var(--muted);max-width:46ch">Ebooks, PDFs, and courses to help you master design, photo, video, and AI, and build real income. Yours to keep, or get everything with a membership.</p>
</div>
<div style="grid-column:7/13" class="reveal">
<div style="background:var(--ink-panel);color:#cbd5e1;border-radius:var(--r-lg);padding:clamp(20px,3vw,28px);height:100%;display:flex;flex-direction:column;justify-content:center">
<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span class="tag" style="background:rgba(255,255,255,.08);border-color:transparent;color:#93c5fd">FEATURED BUNDLE</span><span class="tag" style="background:var(--emerald);border-color:var(--emerald);color:#fff">BEST VALUE</span></div>
<h2 style="color:#fff;font-size:clamp(22px,3vw,27px);font-weight:800;margin-top:14px;letter-spacing:-.02em">The Complete Bundle</h2>
<p style="margin-top:8px;font-size:14px;color:#cbd5e1">Both ebooks together, build the AI agent, then the recurring-income business. Lifetime access, instant download.</p>
<div style="display:flex;align-items:center;gap:16px;margin-top:18px;flex-wrap:wrap"><div class="price big" data-price="bundle" style="color:#fff"><span class="ph" style="color:#93c5fd">Price coming</span></div>
<button class="btn gold" data-add-cart="bundle" data-title="The Complete Bundle">Add to cart</button>
<a class="textlink" style="color:#93c5fd" href="/pricing/">What's inside &rarr;</a></div>
</div></div>
</div></div></section>

<section class="section" style="padding-top:0"><div class="wrap">
<div class="chips reveal" id="storeFilter" style="margin-bottom:22px">
<button class="chip active" data-cat="all">All products</button>
<button class="chip" data-cat="ebook">Ebooks</button>
<button class="chip" data-cat="soon">Courses (soon)</button>
</div>
<div class="products reveal" id="storeGrid">{grid}</div>
<p class="muted reveal" style="margin-top:26px;font-size:14px"><b style="color:var(--ink)">Most people just get the membership</b> &mdash; $15/mo for everything, less than a single ebook. <a class="textlink" href="/pricing/">See the membership &rarr;</a> &nbsp;&middot;&nbsp; <a class="textlink" href="/course/">Preview a course &rarr;</a></p>
</div></section>
</main>""" + footer()

# ---------- PRODUCT PAGE ----------
def product_page(slug):
    p = PRODUCTS[slug]
    other = "boring-money" if slug == "ai-agent-ebook" else "ai-agent-ebook"
    op = PRODUCTS[other]
    feats = "".join(f"<li>{x}</li>" for x in p["what"])
    return head(f"{p['title']} — Taylormade Academy", p["blurb"], f"/store/{slug}/", og=p['cover'].lstrip('/')) + header("Store") + f"""
<main>
<section class="section tight"><div class="wrap">
<a class="mono" href="/store/" style="font-size:12px;letter-spacing:.1em;color:var(--muted)">&larr; STORE</a>
<div class="g-12" style="margin-top:22px;align-items:start;gap:clamp(24px,4vw,56px)">
<div class="reveal" style="grid-column:1/6;position:sticky;top:90px">
<picture class="prod-cover"><source srcset="{p['cover'].rsplit('.',1)[0]}.webp" type="image/webp"><img src="{p['cover']}" width="840" height="1120" alt="{p['title']} cover" fetchpriority="high"></picture>
<div style="background:var(--paper-2);border:1px solid var(--hair);border-radius:var(--r);padding:20px;margin-top:22px">
{price_block(slug, big=True)}
<a class="btn gold" data-buy="{slug}" href="#" style="width:100%;margin-top:14px">Get the ebook <span class="arr">&rarr;</span></a>
<p style="font-size:12.5px;color:var(--muted);margin-top:12px;text-align:center">Instant PDF download. Read on any device. 7-day refund.</p>
</div></div>
<div class="reveal" style="grid-column:7/13">
<div class="tagrow" style="display:flex;gap:8px"><span class="tag gold"><span class="dot"></span>{p['tag']}</span><span class="tag">{p['pages']}</span></div>
<h1 class="display-l" style="margin-top:14px">{p['title']}</h1>
<p class="lead" style="margin-top:18px;max-width:52ch">{p['what_is']}</p>
<hr class="rule hair" style="margin:30px 0">
<span class="kicker gold">Who it is for</span>
<p style="margin-top:10px">{p['for']}</p>
<span class="kicker gold" style="display:block;margin-top:28px">What is inside</span>
<ul class="flist">{feats}</ul>
<span class="kicker gold" style="display:block;margin-top:28px">The outcome</span>
<p style="margin-top:10px">{p['outcome']}</p>
<div style="margin-top:32px;display:flex;gap:14px;flex-wrap:wrap"><a class="btn gold" data-buy="{slug}" href="#">Get the ebook <span class="arr">&rarr;</span></a><a class="btn ghost" href="/pricing/">Or get both and save</a></div>
</div></div></div></section>
<section class="section on-ink"><div class="wrap" style="text-align:center">
<span class="kicker reveal">Keep building</span>
<h2 class="display-m reveal" style="color:var(--paper);margin-top:12px">Pairs with "{op['title']}"</h2>
<p class="reveal" style="color:#D7D2C6;margin:14px auto 0;max-width:46ch">{op['blurb']}</p>
<a class="btn gold reveal" style="margin-top:24px" href="/store/{other}/">See "{op['title']}" <span class="arr">&rarr;</span></a>
</div></section>
</main>""" + footer()

# ---------- PRICING ----------
def pricing():
    def card(tag, title, desc, feats, cta_label, cta_href, buy=None, featured=False, price_slug=None, price_text=None):
        fl = "".join(f"<li>{x}</li>" for x in feats)
        btn = f'<a class="btn {"gold" if featured else "ghost"}" {"data-buy="+chr(34)+buy+chr(34) if buy else "href="+chr(34)+cta_href+chr(34)} href="{cta_href}">{cta_label}</a>'
        style = "border-color:var(--gold);box-shadow:var(--shadow)" if featured else ""
        pr = (f'<div class="price big" style="margin:12px 0 4px">{price_text}</div>' if price_text
              else f'<div style="margin:12px 0 4px">{price_block(price_slug or buy or "", big=True)}</div>')
        return f"""<div class="pcard" style="padding:26px;{style}">
<div class="tagrow">{tag}</div>
<h3 style="margin-top:6px">{title}</h3>
{pr}
<p class="blurb" style="margin-top:4px">{desc}</p>
<ul class="flist" style="margin-top:16px">{fl}</ul>
<div style="margin-top:22px">{btn}</div></div>"""
    cards = "".join([
        card('<span class="tag">EBOOK</span>', "Build Your First AI Agent",
             "The no-code agent guide, on its own.", ["Easy 24-page PDF, screenshots included", "Read on any device", "7-day refund"],
             "Get this ebook", "#", buy="ai-agent-ebook"),
        card('<span class="tag gold"><span class="dot"></span>BEST VALUE</span>', "The Bundle",
             "Both ebooks together. Build the agent, then the business.",
             ["Build Your First AI Agent", "The AI Money Machine", "Save vs buying separately", "First in line for the video courses"],
             "Get the bundle", "#", buy="bundle", featured=True),
        card('<span class="tag">EBOOK</span>', "The AI Money Machine",
             "The recurring-income service playbook, on its own.", ["Easy 24-page PDF, graphics included", "Prompts and templates included", "7-day refund"],
             "Get this ebook", "#", buy="boring-money"),
    ])
    video_cards = "".join([
        card('<span class="tag gold"><span class="dot"></span>ALL ACCESS</span>',
             "Membership",
             "$15/mo and everything unlocks: all the ebooks, every video course as it drops, plus the community. Cancel anytime.",
             ["Every ebook + video course", "New content every month", "The community + DMs", "Cancel anytime"],
             "Start membership", "#", buy="all-access", featured=True, price_slug="all-access"),
        card('<span class="tag">PER VIDEO</span> <span class="tag live"><span class="dot"></span>SOON</span>',
             "Single Videos",
             "A la carte. Just need one thing? Buy that single video, watch it, and download it to keep.",
             ["Buy any one video", "Watch it and download it", "Yours forever, no subscription", "Upgrade to All-Access anytime"],
             "Join the waitlist", "/#waitlist", price_text="$19 each"),
    ])
    return head("Pricing — Taylormade Academy", "Simple pricing. Ebooks one-time, and the video courses two ways: an all-access subscription or a single video to keep.", "/pricing/") + header("Pricing") + f"""
<main>
<section class="section tight"><div class="wrap" style="text-align:center">
<span class="kicker gold reveal">Pricing</span>
<h1 class="display-l reveal" style="margin-top:12px">Pick a book, or grab the bundle.</h1>
<p class="reveal" style="margin:16px auto 0;color:var(--muted);max-width:48ch">Honest, one-time pricing. No subscription to read a book. Prices land here the moment they are set.</p>
</div></section>
<section class="section" style="padding-top:0"><div class="wrap"><div class="products reveal" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">{cards}</div>
<div class="reveal" style="margin-top:60px">
<div class="eyebrow-row"><span class="kicker gold">The membership</span><hr class="rule hair"></div>
<div class="sec-head" style="margin:18px 0 26px"><h2 class="display-m">Get everything for $15/mo.</h2>
<p style="color:var(--muted);margin-top:10px;max-width:58ch">The membership unlocks all the ebooks and every video course as it drops, plus the community. The video courses are in production now. Prefer to own just one thing? Single videos will be available a la carte too.</p></div>
<div class="products" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">{video_cards}</div>
</div>
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
</div>
<div class="reveal" style="grid-column:8/13;padding-top:8px">
<div style="position:relative;border-radius:16px;overflow:hidden;aspect-ratio:4/5;background:linear-gradient(160deg,#dbe5ff,#9db8ff);border:1px solid #cdd9ff;box-shadow:var(--shadow);margin-bottom:22px;display:flex;align-items:flex-end;justify-content:center">
<picture><source srcset="/assets/nelson-hero.webp" type="image/webp">
<img src="/assets/nelson-hero.png" width="736" height="1108" alt="Nelson Taylor, Taylormade Creative" loading="lazy" decoding="async" style="position:relative;max-height:97%;width:auto;max-width:100%;object-fit:contain;display:block">
</picture></div>
<div style="background:var(--bg-soft);border:1px solid var(--hair);border-radius:14px;padding:18px 20px">
<p style="font-size:18px">Most online teaching is built to sell you a dream. I would rather hand you a craft. The ebooks and courses here come from real work, including a live workshop I ran for about 50 students, not from a content farm.</p></div>
</div></div></div></section>

<section class="section on-ink" id="workshops"><div class="wrap">
<span class="kicker reveal">The receipts</span>
<h2 class="display-l reveal" style="color:var(--paper);margin-top:12px;max-width:18ch">What I have actually shipped.</h2>
<div class="audience reveal" style="margin-top:34px;background:#2a2722;border-color:#2a2722">
<div class="a" style="background:var(--ink)"><div class="h" style="color:var(--paper)">The AUC workshop</div><div class="d" style="color:#bdb8ac">A live 3-night "Build Your First AI Agent" sprint with AUC's Data Science Institute and Johns Hopkins, for about 50 HBCU students.</div></div>
<div class="a" style="background:var(--ink)"><div class="h" style="color:var(--paper)">A shipped iOS app</div><div class="d" style="color:#bdb8ac">A real app on the App Store. Not a prototype, not a slide. Something people can download.</div></div>
<div class="a" style="background:var(--ink)"><div class="h" style="color:var(--paper)">14 years of client work</div><div class="d" style="color:#bdb8ac">Design, video, branding, and AI for real businesses across Dallas-Fort Worth.</div></div>
<div class="a" style="background:var(--ink)"><div class="h" style="color:var(--paper)">These ebooks</div><div class="d" style="color:#bdb8ac">Written from the work, not from theory. The same steps I teach live.</div></div>
</div></div></section>

<section class="section cta-band"><div class="wrap">
<span class="kicker gold reveal">Your turn</span>
<h2 class="display-l reveal">Let me show you how I do it.</h2>
<div class="cta-row reveal"><a class="btn gold" href="/store/">Get the ebooks <span class="arr">&rarr;</span></a><a class="btn ghost" href="/community/">Join the community</a></div>
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

def community():
    return head("Community — Taylormade Academy", "A community for everyone from the classes plus future builders. Coming soon.", "/community/") + header("Community") + """
<main><section class="section"><div class="wrap" style="max-width:820px;text-align:center">
<span class="tag live reveal"><span class="dot"></span>OPENING SOON</span>
<h1 class="display-l reveal" style="margin-top:16px">The build crew.</h1>
<p class="reveal" style="margin:18px auto 0;color:var(--muted);max-width:52ch">A free community of designers, photographers, video people, and AI builders. Ask questions, get unstuck, show your work, and meet people to create with, make friends, find collaborators, even business partners. Everybody from my classes ends up here.</p>
<form class="cta-row reveal" onsubmit="return BM.subscribe(event,'community')" style="justify-content:center;margin-top:28px;display:flex;gap:12px;flex-wrap:wrap">
<input type="email" name="email" placeholder="you@email.com" required style="padding:14px 20px;border:1.5px solid var(--hair);border-radius:100px;font-family:inherit;font-size:15px;min-width:240px;background:var(--paper)">
<button class="btn gold" type="submit">Save my spot</button></form>
</div></section></main>""" + footer()

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

SITEMAP_PATHS = ["/", "/store/", "/store/ai-agent-ebook/", "/store/boring-money/",
                 "/pricing/", "/about/", "/community/", "/login/", "/refunds/", "/terms/", "/privacy/"]

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
<p>This is the real, plain-English version. I'm Nelson Taylor, and Taylormade Academy is my education and community platform (Taylormade Creative, Dallas-Fort Worth, Texas). This policy covers the website at academy.taylormadecreative.net and the Taylormade Academy mobile app, which both use the same account and the same backend.</p>
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
    render("/pricing/", pricing())
    render("/about/", about())
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
