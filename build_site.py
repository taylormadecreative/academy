#!/usr/bin/env python3
"""Taylormade Academy static site generator. Shared chrome + page bodies -> route/index.html.
Marketing storefront builds fully with NO keys; Buy buttons degrade to a 503 notice
until Supabase/Stripe are wired."""
import pathlib

ROOT = pathlib.Path(__file__).parent
DOMAIN = "https://academy.taylormadecreative.net"

NAV = [("Tracks", "/#tracks"), ("Store", "/store/"), ("Pricing", "/pricing/"), ("Community", "/community/"), ("About", "/about/")]

# Nelson's social accounts. The 3 confirmed are live; more get appended as Nelson sends them.
SOCIALS = [
    ("Instagram", "https://instagram.com/taylormade_creative"),
    ("LinkedIn", "https://linkedin.com/in/taylormademd"),
    ("Portfolio", "https://taylormadecreative.net"),
]

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

def head(title, desc, path="/", og="assets/og.png"):
    canon = DOMAIN + path
    return f"""<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="website"><meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}"><meta property="og:url" content="{canon}">
<meta property="og:image" content="{DOMAIN}/{og}"><meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/build-mode.css">
</head><body>"""

def header(active=""):
    links = "".join(
        f'<a class="navlink{" active" if active==t else ""}" href="{u}">{t}</a>' for t, u in NAV)
    mlinks = "".join(f'<a href="{u}">{t}</a>' for t, u in NAV)
    return f"""<header class="site-header"><div class="wrap"><div class="bar">
<a class="brand" href="/"><span class="mark">Taylormade <b>Academy</b></span><span class="by">with Nelson Taylor</span></a>
<nav class="nav">{links}</nav>
<div class="nav-cta"><a class="btn gold sm" href="/store/">Get the ebooks</a>
<button class="burger" aria-label="Menu" onclick="document.getElementById('mnav').classList.toggle('open')"><span></span><span></span><span></span></button></div>
</div></div><div class="mobile-nav" id="mnav">{mlinks}<a class="btn gold" href="/store/">Get the ebooks</a></div></header>"""

def footer():
    cols = {
        "Tracks": [("Graphic Design", "/#tracks"), ("Photography", "/#tracks"), ("Video Production", "/#tracks"), ("AI for Creatives", "/store/")],
        "Community": [("Join the community", "/community/"), ("About Nelson", "/about/"), ("Pricing", "/pricing/")],
        "Follow Nelson": list(SOCIALS),
        "More": [("Account", "/login/"), ("Refunds", "/refunds/"), ("Terms", "/terms/"), ("Privacy", "/privacy/")],
    }
    colhtml = ""
    for h, items in cols.items():
        links = "".join(f'<a href="{u}">{t}</a>' for t, u in items)
        colhtml += f'<div class="foot-col"><h4>{h}</h4>{links}</div>'
    return f"""<footer class="site-footer"><div class="wrap">
<div class="foot-top"><div class="foot-brand"><div class="mark">Taylormade <b>Academy</b></div>
<p>Learn the craft and build real things: graphic design, photography, video, and AI. Taught by Nelson Taylor, Taylormade Creative, Dallas-Fort Worth.</p>
{socials_row(style="margin-top:14px")}</div>
{colhtml}</div>
<div class="foot-bottom"><span>&copy; 2026 Taylormade Creative. All rights reserved.</span>
<span class="mono">LEARN THE CRAFT / BUILD REAL THINGS</span></div>
</div></footer>
<div class="toast" id="toast"></div>
<script src="/js/config.js"></script><script src="/js/site.js"></script></body></html>"""

def render(path, html):
    out = ROOT / path.strip("/") / "index.html" if path != "/" else ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)

# ---------- product data ----------
PRODUCTS = {
    "ai-agent-ebook": {
        "title": "Build Your First AI Agent",
        "tag": "EBOOK", "pages": "119 pages", "cover": "/assets/cover-ai-agent.png",
        "blurb": "A no-code, plain-English guide to building your first working AI agent, the same approach I taught live to about 50 students with AUC's Data Science Institute and Johns Hopkins.",
        "for": "Beginners who have never written a line of code. Creatives and hustlers who want to build, not just read about AI. Students who want a head start. If you can write an email and follow directions, you can do this.",
        "what": ["What an AI agent actually is, in plain words", "How to pick a real problem worth solving",
                 "Setting up your tools without touching code", "Giving your agent data to work with",
                 "Building it step by step, with screenshots to follow", "Testing it, fixing it, and exporting your work",
                 "A short pitch framework so you can explain what you built"],
        "outcome": "You finish with a working AI agent you built yourself, and you understand how it works well enough to build the next one. No black box. No hand-holding forever. Just the foundation you need to keep going.",
        "what_is": "A no-code, plain-English guide to building your first working AI agent. About 119 pages. I take you from \"I don't really know what an agent is\" to \"I built one and it does a real job.\"",
    },
    "boring-money": {
        "title": "Boring Money",
        "tag": "EBOOK", "pages": "65 pages", "cover": "/assets/cover-boring-money.png",
        "blurb": "How to build a recurring-income AI service business by solving boring problems for small businesses. The flashy AI stuff gets attention. The boring stuff gets paid every month.",
        "for": "Hustlers who want recurring income, not a one-time gig. Freelancers and creatives who already have skills and want a way to package them. Beginners who would rather build a small, steady business than chase a viral moment. You do not need a big audience or startup money.",
        "what": ["Why boring problems are the best problems to get paid for", "The three goldmines: communication, documents, research",
                 "How to package one problem into a monthly service", "Pricing the outcome, not your hours",
                 "Finding your first clients where they already gather", "A repeatable workflow you run in about thirty minutes",
                 "A 90-day ramp, plus 20 boring problems to start with"],
        "outcome": "You walk away with a clear, honest plan for a small recurring-income service business, the prompts and templates to run it, and a first-week action list. Service income, not a passive-income fantasy.",
        "what_is": "A guide to building a recurring-income AI service business by solving boring problems for small businesses. About 65 pages. This is about the boring, dependable stuff, on purpose.",
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

# ---------- HOME ----------
def home():
    p1, p2 = PRODUCTS["ai-agent-ebook"], PRODUCTS["boring-money"]
    pcards = ""
    for slug, p in PRODUCTS.items():
        feats = "".join(f"<li>{x}</li>" for x in p["what"][:4])
        pcards += f"""<article class="pcard">
<div class="top"><img class="cover" src="{p['cover']}" alt="{p['title']} cover" loading="lazy">
<div class="meta"><div class="tagrow"><span class="tag gold"><span class="dot"></span>{p['tag']}</span><span class="tag">{p['pages']}</span></div>
<h3>{p['title']}</h3><p class="blurb">{p['blurb']}</p></div></div>
<div class="foot">{price_block(slug)}<a class="btn" href="/store/{slug}/">Read what's inside <span class="arr">&rarr;</span></a></div></article>"""
    # coming soon video card
    pcards += """<article class="pcard coming">
<div class="top"><div class="cover-ph">VIDEO<br>COURSE</div>
<div class="meta"><div class="tagrow"><span class="tag live"><span class="dot"></span>COMING SOON</span></div>
<h3>The Video Courses</h3><p class="blurb">Step-by-step tutorial videos that walk you through the workshops on screen. In production now. Join the waitlist and you are first in line when they drop.</p></div></div>
<div class="foot"><span class="price"><span class="ph">In production</span></span><a class="btn ghost" data-waitlist href="#waitlist">Join the waitlist <span class="arr">&rarr;</span></a></div></article>"""

    return head(
        "Taylormade Academy — Learn design, photo, video & AI. Build real things.",
        "Taylormade Academy by Nelson Taylor. Learn graphic design, photography, video, and AI, then build real things. Plain-English courses, ebooks, and a creative community out of Dallas-Fort Worth.",
        "/") + header("") + f"""
<main>
<section class="hero"><div class="wrap"><div class="h-grid">
<div class="hero-copy reveal">
<div class="eyebrow-row"><span class="kicker gold">No hype. Just the craft.</span><hr class="rule gold" style="max-width:80px"></div>
<h1 class="display-xl">Learn to build<br>real things.</h1>
<p class="sub">I'm Nelson Taylor, a working creative out of Dallas-Fort Worth with 14 years in the field. I teach the crafts I actually do, graphic design, photography, video, and AI, in plain English, on real projects, honest about the work it takes.</p>
<div class="cta-row"><a class="btn gold" href="#tracks">See the tracks <span class="arr">&rarr;</span></a><a class="btn ghost" href="/community/">Join the community</a></div>
{socials_row(style="margin-top:24px")}
</div>
<div class="hero-art reveal">
<div style="position:relative;border-radius:14px;overflow:hidden;aspect-ratio:4/5;background:var(--ink);border:1px solid var(--hair);box-shadow:var(--shadow)">
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#3a352e;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:clamp(28px,4vw,40px);letter-spacing:.04em;text-align:center;line-height:1.05">NELSON<br>TAYLOR</div>
<img src="/assets/nelson-hero.jpg" alt="Nelson Taylor, Taylormade Creative" style="position:relative;width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display='none'">
<span class="badge" style="position:absolute;left:16px;bottom:16px;margin:0"><span class="dot"></span>Taught by Nelson Taylor</span>
</div></div>
</div></div></section>

<section class="proof"><div class="wrap"><div class="row">
<div class="item"><div class="n">~50 students</div><div class="l">Taught a live 3-night "Build Your First AI Agent" workshop with AUC's Data Science Institute and Johns Hopkins</div></div>
<div class="item"><div class="n">14 years</div><div class="l">Working as a creative in Dallas-Fort Worth, design, video, and AI</div></div>
<div class="item"><div class="n">Shipped</div><div class="l">A real iOS app on the App Store, not just slides and theory</div></div>
</div></div></section>

<section class="section tight" id="tracks"><div class="wrap">
<div class="eyebrow-row reveal"><span class="kicker">The tracks</span><hr class="rule hair"></div>
<div class="sec-head reveal" style="margin:18px 0 36px"><h2 class="display-m">Four crafts. One place to learn them.</h2>
<p style="color:var(--muted);margin-top:10px;max-width:56ch">Start with what you need. AI is live now with two ebooks. Graphic design, photography, and video courses are in production, drop your email and you are first in line.</p></div>
<div class="products reveal" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">{tracks_section()}</div>
</div></section>

<section class="section"><div class="wrap"><div class="g-12" style="align-items:start">
<div class="sec-head reveal" style="grid-column:1/7">
<span class="kicker gold">The pitch</span>
<h2 class="display-l">Most online courses are too boring to finish, or too hyped to trust.</h2></div>
<div class="reveal" style="grid-column:8/13;padding-top:8px">
<p style="font-size:18px">I do neither. I show you, step by step, how to make a real thing, a design, a photo, a video, an app, and come out the other side with something you built. No fancy degree. No pretending it is magic. Just the craft, broken down so a beginner can do it.</p>
<p style="margin-top:16px"><a class="textlink" href="/about/">Why I teach this way &rarr;</a></p>
</div></div></div></section>

<section class="section tight" id="products"><div class="wrap">
<div class="eyebrow-row reveal"><span class="kicker">The catalog</span><hr class="rule hair"></div>
<div class="sec-head reveal" style="margin:18px 0 36px"><h2 class="display-m">Start with the ebooks. The video courses are next.</h2></div>
<div class="products reveal">{pcards}</div>
</div></section>

<section class="section on-ink community" id="community-band"><div class="wrap">
<div class="g-12" style="align-items:end">
<div class="reveal" style="grid-column:1/8">
<span class="kicker">The community</span>
<h2 class="display-l" style="margin-top:14px">Building alone is hard. You don't have to.</h2>
<p style="margin-top:18px;max-width:50ch">A free community of designers, photographers, video people, and AI builders. Ask questions, get unstuck, show your work, and meet people to create with, make friends, find collaborators, even business partners. Everybody from my classes ends up here.</p>
<div class="cta-row" style="margin-top:26px"><a class="btn gold" href="/community/">Join the community <span class="arr">&rarr;</span></a></div>
</div>
<div class="reveal" style="grid-column:9/13">
<div class="tag solid" style="margin-bottom:14px"><span class="dot"></span>WHO IS IN HERE</div>
</div>
</div>
<div class="audience reveal">
<div class="a"><div class="h">Beginners</div><div class="d">You keep hearing about AI and want to actually use it.</div></div>
<div class="a"><div class="h">Hustlers</div><div class="d">You want side income that does not need a big audience or budget.</div></div>
<div class="a"><div class="h">Creatives & students</div><div class="d">You learn by building, not by watching.</div></div>
<div class="a"><div class="h">Small-business owners</div><div class="d">You want AI to do real work in your business.</div></div>
</div>
</div></section>

<section class="section cta-band" id="waitlist"><div class="wrap">
<span class="kicker gold reveal">The newsletter</span>
<h2 class="display-l reveal">Get the good stuff first.</h2>
<p class="reveal" style="margin:18px auto 0;max-width:50ch;color:var(--muted)">Real, no-hype tips on design, photo, video, and AI, plus first dibs on new courses and community drops. No spam, unsubscribe anytime.</p>
<form class="cta-row reveal" onsubmit="return BM.subscribe(event,'home-cta')">
<input type="email" name="email" placeholder="you@email.com" required style="padding:14px 20px;border:1.5px solid var(--hair);border-radius:100px;font-family:inherit;font-size:15px;min-width:240px;background:var(--paper)">
<button class="btn gold" type="submit">Subscribe <span class="arr">&rarr;</span></button>
</form>
</div></section>
</main>""" + footer()

# ---------- STORE ----------
def store():
    cards = ""
    for slug, p in PRODUCTS.items():
        cards += f"""<article class="pcard">
<div class="top"><img class="cover" src="{p['cover']}" alt="{p['title']} cover" loading="lazy">
<div class="meta"><div class="tagrow"><span class="tag gold"><span class="dot"></span>{p['tag']}</span><span class="tag">{p['pages']}</span></div>
<h3>{p['title']}</h3><p class="blurb">{p['blurb']}</p></div></div>
<div class="foot">{price_block(slug)}<a class="btn" href="/store/{slug}/">Read what's inside <span class="arr">&rarr;</span></a></div></article>"""
    cards += """<article class="pcard coming" id="video">
<div class="top"><div class="cover-ph">VIDEO<br>COURSE</div>
<div class="meta"><div class="tagrow"><span class="tag live"><span class="dot"></span>COMING SOON</span></div>
<h3>The Video Courses</h3><p class="blurb">Watch me build it on screen, step by step. In production now, made with HeyGen and edited in Remotion. Join the waitlist and you are first in line.</p></div></div>
<div class="foot"><span class="price"><span class="ph">In production</span></span><a class="btn ghost" href="/#waitlist">Join the waitlist <span class="arr">&rarr;</span></a></div></article>"""
    return head("Store — Taylormade Academy", "Two plain-English ebooks ready to read now, plus video courses on the way. Build real things with AI.", "/store/") + header("Store") + f"""
<main>
<section class="section tight"><div class="wrap">
<span class="kicker gold reveal">The catalog</span>
<h1 class="display-l reveal" style="margin-top:12px;max-width:16ch">Everything to start building, in one place.</h1>
<p class="reveal" style="margin-top:16px;color:var(--muted);max-width:52ch">Two ebooks you can read tonight. Video courses on the way. Pick one, or grab the bundle and save.</p>
</div></section>
<section class="section" style="padding-top:0"><div class="wrap"><div class="products reveal">{cards}</div>
<div class="reveal" style="margin-top:36px;background:var(--ink);color:var(--paper);border-radius:var(--r);padding:clamp(24px,4vw,40px);display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between">
<div><span class="tag gold" style="border-color:var(--gold)"><span class="dot"></span>BEST VALUE</span>
<h2 class="display-m" style="color:var(--paper);margin-top:12px;max-width:20ch">Get both ebooks together and save.</h2>
<p style="color:#D7D2C6;margin-top:10px;max-width:48ch">Build the agent, then build the business around it. The full playbook, one price.</p></div>
<div style="text-align:right"><div class="price" style="font-size:30px;color:var(--paper)"><span class="ph">Bundle price coming</span></div>
<a class="btn gold" style="margin-top:14px" href="/pricing/">See pricing <span class="arr">&rarr;</span></a></div>
</div></div></section>
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
<img src="{p['cover']}" alt="{p['title']} cover" style="border-radius:8px;box-shadow:var(--shadow);width:100%;max-width:360px">
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
             "The no-code agent guide, on its own.", ["119-page PDF", "Read on any device", "7-day refund"],
             "Get this ebook", "#", buy="ai-agent-ebook"),
        card('<span class="tag gold"><span class="dot"></span>BEST VALUE</span>', "The Bundle",
             "Both ebooks together. Build the agent, then the business.",
             ["Build Your First AI Agent (119 pages)", "Boring Money (65 pages)", "Save vs buying separately", "First in line for the video courses"],
             "Get the bundle", "#", buy="bundle", featured=True),
        card('<span class="tag">EBOOK</span>', "Boring Money",
             "The recurring-income service playbook, on its own.", ["65-page PDF", "Prompts and templates included", "7-day refund"],
             "Get this ebook", "#", buy="boring-money"),
    ])
    video_cards = "".join([
        card('<span class="tag gold"><span class="dot"></span>ALL-ACCESS</span> <span class="tag live"><span class="dot"></span>SOON</span>',
             "The All-Access Pass",
             "A monthly membership. Stream every video in the library, anytime, plus new releases as they drop, and the community.",
             ["Watch every video, anytime", "New releases included", "The community included", "Cancel anytime"],
             "Join the waitlist", "/#waitlist", featured=True, price_slug="all-access"),
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
<section class="section" style="padding-top:0"><div class="wrap"><div class="products reveal" style="grid-template-columns:repeat(3,1fr)">{cards}</div>
<div class="reveal" style="margin-top:60px">
<div class="eyebrow-row"><span class="kicker gold">The video courses</span><span class="tag live"><span class="dot"></span>IN PRODUCTION</span><hr class="rule hair"></div>
<div class="sec-head" style="margin:18px 0 26px"><h2 class="display-m">Watch me build it. Two ways in.</h2>
<p style="color:var(--muted);margin-top:10px;max-width:58ch">The step-by-step tutorial videos are in production. When they drop, you choose how you watch: go All-Access and stream everything anytime, or buy the single video you need and keep it. Join the waitlist and you will hear the launch price first.</p></div>
<div class="products" style="grid-template-columns:1fr 1fr">{video_cards}</div>
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
<div style="position:relative;border-radius:14px;overflow:hidden;aspect-ratio:4/5;background:var(--ink);border:1px solid var(--hair);box-shadow:var(--shadow);margin-bottom:22px">
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#3a352e;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:32px;letter-spacing:.04em;text-align:center;line-height:1.05">NELSON<br>TAYLOR</div>
<img src="/assets/nelson-hero.jpg" alt="Nelson Taylor, Taylormade Creative" style="position:relative;width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display='none'">
</div>
<div style="border-left:2px solid var(--gold);padding-left:20px">
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

if __name__ == "__main__":
    render("/", home())
    render("/store/", store())
    render("/store/ai-agent-ebook/", product_page("ai-agent-ebook"))
    render("/store/boring-money/", product_page("boring-money"))
    render("/pricing/", pricing())
    render("/about/", about())
    render("/community/", community())
    # NOTE: /login/, /dashboard/, and /library/ are the live member-area app pages.
    # They are hand-maintained (vanilla JS + supabase-js, not generated chrome) so the
    # generator must NOT render or overwrite them. Edit those index.html files directly.
    render("/refunds/", stub("Refunds", "Policy", "Refund policy",
        "<p>Digital products come with a 7-day, no-questions refund. If an ebook did not help, email me within 7 days of buying and I will refund it. The community and any future subscription can be canceled anytime, and you keep access through the period you paid for.</p>"))
    render("/terms/", stub("Terms", "Legal", "Terms of use",
        "<p>Taylormade Academy is an education product by Taylormade Creative. The ebooks, courses, and community are for your personal use. Please do not resell or redistribute the files. This is educational material, not a guarantee of income, and not professional legal, financial, or medical advice. Full terms will be posted here before payments go live.</p>"))
    render("/privacy/", stub("Privacy", "Legal", "Privacy",
        "<p>I collect only what is needed to run your account and deliver what you bought: your email, your purchases, and your activity on the site. Payments are handled by Stripe; I never see your card. I do not sell your information. A full privacy policy will be posted here before payments go live.</p>"))
    render("/thank-you/", stub("Thank you", "You're in", "Thank you. Check your email.",
        "<p>Your purchase is confirmed and your download is on the way to your inbox. Create your account with the same email to keep everything in your library, and come say hey in the community.</p>", ))
    print("built: home, store, 2 product pages, pricing, about, community, + 4 stubs")
    print("note: login/dashboard/library are hand-maintained app pages and are left untouched")
