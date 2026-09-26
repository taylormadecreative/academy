"""/workshops/ — every Taylormade Academy workshop in one public place, no membership needed.

Rendered by build_site.py like /agent/ and /ai101/. WORKSHOPS below is the one list: this page,
the home page's schedule strip, the Event schema and llms.txt all read it. The agent and AI 101
dates come from build_agent.py / build_ai101.py so they can never disagree with those pages.
The Content Creator Workshop sells on Eventbrite, so its facts live here.

Order is on purpose: the paid agent workshop leads, the free class sits under it as the way in.
A card whose end time has passed hides itself in the browser; rebuild to drop it from the schema.
No prices on this page (the agent and AI 101 pages carry their own), and never the studio address.
"""
import build_agent as A
import build_ai101 as B
from build_seo import breadcrumbs, event, faq_from_html, inject

EVENTBRITE_CCW = "https://www.eventbrite.com/e/content-creator-workshop-tickets-1998653390092"

WORKSHOPS = [
    {
        "slug": "agent",
        "title": "Build Your First AI Agent",
        "url": "/agent/",
        "cta": "Get your seat",
        "month": "Oct", "day": "23", "dow": "Fri",
        "when": A.DATE,
        "where": "Online, or in the Dallas studio",
        "tags": ["AI", "Online", "In person"],
        "blurb": "Two hours, no code. You build an AI agent that does one real job for you, on your own laptop, while I build the same one on screen. You leave with it working and the playbook to build the next one.",
        "best_for": "Business owners, creatives and anyone tired of doing the same task every week.",
        "start": A.START, "end": A.END, "mode": "mixed",
        "og": "assets/og-agent.png",
        "offers": A.OFFERS,
        "teaches": "How to build a no-code AI agent in Claude Projects or ChatGPT Projects",
        "workload": "PT2H",
        "schema_desc": ("A live, beginner-friendly workshop where you build a working AI agent in one night with no code, "
                        "taught by Nelson Taylor online and in a Dallas studio. First taught for the AUC Data Science "
                        "Initiative and Johns Hopkins."),
        "feature": True,
    },
    {
        "slug": "ai101",
        "title": "AI 101: Learn to Talk to AI",
        "url": "/ai101/",
        "cta": "Save a free seat",
        "month": "Oct", "day": "9", "dow": "Fri",
        "when": B.DATE,
        "where": "Online",
        "tags": ["Free", "AI", "Online"],
        "blurb": "A free one-hour class for total beginners. How to write a prompt that gets a good answer the first time, and what the AI words everyone uses actually mean.",
        "best_for": "Anyone brand new to ChatGPT, Claude or AI. Start here.",
        "start": B.START, "end": B.END, "mode": "online",
        "og": "assets/og-ai101.png",
        "offers": [{"name": "Free seat", "price": 0, "validFrom": "2026-09-24T00:00:00-05:00", "validThrough": B.START}],
        "free": True,
        "teaches": "How to write a prompt for ChatGPT or Claude, and the basic AI vocabulary",
        "workload": "PT1H",
        "schema_desc": ("A free, one-hour live online class for beginners on how to write a prompt for ChatGPT or "
                        "Claude and what common AI words mean, taught by Nelson Taylor of Taylormade Academy."),
    },
    {
        "slug": "creator",
        "title": "Content Creator Workshop",
        "url": EVENTBRITE_CCW,
        "cta": "Tickets on Eventbrite",
        "month": "Nov", "day": "6", "dow": "Fri",
        "when": "Friday, November 6, 7 to 9 PM CT",
        "where": "In the studio, Dallas",
        "tags": ["Content", "In person"],
        "blurb": "A hands-on night in a working studio: make content that looks and sounds professional, then meet the other creators in the room.",
        "best_for": "Creators, small brands and anyone who films their own content.",
        # CT is UTC-6 after Nov 1.
        "start": "2026-11-06T19:00:00-06:00", "end": "2026-11-06T21:00:00-06:00", "mode": "onsite",
        "og": "assets/og-image.png",
        "offers": [{"name": "Ticket", "url": EVENTBRITE_CCW}],
        "teaches": "How to film content that looks and sounds professional",
        "schema_desc": ("A hands-on, in-person evening workshop in a Dallas studio for content creators, taught by "
                        "Nelson Taylor: make videos that look and sound professional, and meet other DFW creators."),
    },
]

PAST = [
    ("August 21, 2026", "Content Creator Workshop",
     "A hands-on night for DFW creators at Jenel Studios in Dallas."),
    ("June 2026", "Build Your First AI Agent, for the AUC Data Science Initiative",
     "Three nights with the AUC Data Science Initiative and Johns Hopkins, for about 50 HBCU students. Most started from zero; by the third night they were pitching agents they built."),
]

PICK = [
    ("I have never really used AI", "AI 101", "/ai101/", "Free, one hour, online. Learn to write a prompt and what the words mean."),
    ("I want AI to take a task off my plate", "Build Your First AI Agent", "/agent/", "Two hours, no code. Leave with an agent that works."),
    ("I make videos or photos for my brand", "Content Creator Workshop", EVENTBRITE_CCW, "In the studio, hands-on, with other creators."),
    ("I run a team, a class or a program", "A private workshop", "/partners/", "Any of these, for your group, online or on site."),
]

FAQ = [
    ("Do I need to be a Taylormade Academy member to come?",
     "No. Every workshop is open to everyone. You buy a seat (or save a free one for AI 101) and that is it. For the online classes you sign in to the room with a free Academy account, which takes about a minute."),
    ("Are the workshops online or in person?",
     "Both. AI 101 is online. Build Your First AI Agent is online, with 15 seats in the Dallas studio. The Content Creator Workshop is in person in Dallas. The studio address comes in your ticket email."),
    ("Is there a free AI class for beginners?",
     'Yes. <a class="textlink" href="/ai101/">AI 101</a> is a free, one-hour live class online for people who are brand new to AI. You learn how to write a prompt and what the AI words mean.'),
    ("Do I need to know how to code?",
     "No. Nothing here uses code. If you can write a text message, you can build an AI agent in the workshop."),
    ("Who teaches the workshops?",
     'Nelson Taylor, the founder of Taylormade Academy: fourteen years a working creative in Dallas-Fort Worth. He taught Build Your First AI Agent to about 50 HBCU students with the AUC Data Science Initiative and Johns Hopkins. <a class="textlink" href="/about/">More about Nelson</a>.'),
    ("Where can I take an AI workshop in Dallas?",
     'Taylormade Academy runs live AI workshops in a studio in Dallas, and online for anyone in the US. The next one is <a class="textlink" href="/agent/">Build Your First AI Agent</a> on ' + A.DATE + "."),
    ("Can you run a workshop for my company, school or group?",
     'Yes. Any of these workshops can run privately for your team, online or on site, and there is a longer program for cohorts and campuses. See <a class="textlink" href="/partners/">programs</a> or email <a class="textlink" href="mailto:taylormademd@gmail.com?subject=A%20private%20workshop">taylormademd@gmail.com</a>.'),
    ("How do I hear about new dates?",
     "Put your email in the box at the bottom of this page. New dates go to that list first."),
]

_ARR = '<span class="arr">&rarr;</span>'


def _ext(url):
    return ' target="_blank" rel="noopener"' if url.startswith("http") else ""


def _card(w):
    tags = "".join(f'<span class="ws-tag{" free" if t == "Free" else ""}">{t}</span>' for t in w["tags"])
    return f"""<li class="ws-card{' feature' if w.get('feature') else ''}" data-ends="{w['end']}">
<div class="ws-date" aria-hidden="true"><span class="m">{w['month']}</span><span class="d">{w['day']}</span><span class="w">{w['dow']}</span></div>
<div class="ws-body">
<div class="ws-tags">{tags}</div>
<h3><a href="{w['url']}"{_ext(w['url'])}>{w['title']}</a></h3>
<p class="ws-when">{w['when']} &middot; {w['where']}</p>
<p class="ws-blurb">{w['blurb']}</p>
<p class="ws-for"><b>Best for:</b> {w['best_for']}</p>
</div>
<div class="ws-act"><a class="btn {'gold' if w.get('feature') else 'ghost'}" href="{w['url']}"{_ext(w['url'])}>{w['cta']} {_ARR}</a></div>
</li>"""


# The hide-when-past script, shared with the home page's schedule strip.
HIDE_PAST = """<script>(function(){var now=Date.now();document.querySelectorAll('[data-ends]').forEach(function(el){var t=Date.parse(el.getAttribute('data-ends'));if(t&&t<now)el.remove();});document.querySelectorAll('[data-if-empty]').forEach(function(el){var list=document.querySelector(el.getAttribute('data-if-empty'));if(list&&!list.children.length)el.hidden=false;});})();</script>"""


def home_schedule():
    """The strip under the home page's workshop band: every upcoming date, one line each."""
    rows = "".join(
        f'<li data-ends="{w["end"]}"><a href="{w["url"]}"{_ext(w["url"])}><span class="xs-d">{w["month"]} {w["day"]}</span>'
        f'<span class="xs-t">{w["title"]}</span><span class="xs-w">{"Free &middot; " if w.get("free") else ""}{w["where"]}</span></a></li>'
        for w in sorted(WORKSHOPS, key=lambda w: w["start"]))
    return f"""<div class="xl-sched">
<div class="xs-h"><span>Every upcoming workshop</span><a class="textlink" href="/workshops/">See all workshops {_ARR}</a></div>
<ul class="xs-list" id="homeSched">{rows}</ul>
</div>"""


def workshops_page(head, header, footer, ver):
    title = "AI Workshops & Classes in Dallas and Online | Taylormade Academy"
    desc = ("Live AI workshops and classes for beginners, online and in Dallas. A free AI 101 class, Build Your First "
            "AI Agent (no code), and a Content Creator Workshop, taught by Nelson Taylor. No membership needed.")
    h = head(title, desc, "/workshops/", og="assets/og-agent.png").replace(
        "</head>", f'<link rel="stylesheet" href="/css/agent.css?v={ver}">\n<link rel="stylesheet" href="/css/workshops.css?v={ver}">\n</head>')
    cards = "".join(_card(w) for w in WORKSHOPS)
    pick = "".join(
        f'<tr><th scope="row">{who}</th><td><a class="textlink" href="{u}"{_ext(u)}>{name}</a></td><td>{why}</td></tr>'
        for who, name, u, why in PICK)
    past = "".join(f'<li><span class="wp-d">{d}</span><h3>{t}</h3><p>{p}</p></li>' for d, t, p in PAST)
    faq = "".join(f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in FAQ)
    page = h + header("Workshops") + f"""
<main>
<section class="ws-hero"><div class="wrap">
<span class="kicker gold">Workshops &middot; open to everyone</span>
<h1 class="display-xl">Live AI <span class="u-gold">workshops</span>,<br>built for beginners.</h1>
<p class="lead ws-def">Taylormade Academy runs live, beginner-friendly workshops on AI and content creation, taught by Nelson Taylor online and in a studio in Dallas. <b>You do not need a membership.</b> Pick a date, grab a seat, bring a laptop.</p>
<dl class="ws-facts">
<div><dt>Next workshop</dt><dd>{A.DAY}</dd></div>
<div><dt>Free class</dt><dd>{B.DAY}</dd></div>
<div><dt>Where</dt><dd>Online + Dallas</dd></div>
<div><dt>Code needed</dt><dd>None</dd></div>
</dl>
</div></section>

<section class="ws-up" id="upcoming"><div class="wrap">
<h2 class="ws-h2">Upcoming workshops</h2>
<ol class="ws-cards" id="wsCards">{cards}</ol>
<div class="ws-none" data-if-empty="#wsCards" hidden><b>New dates are coming.</b> Put your email in below and they come to you first.</div>
</div></section>

<section class="ws-pick"><div class="wrap">
<span class="kicker gold">Where to start</span>
<h2 class="ws-h2" style="margin-top:12px">Which workshop is right for you?</h2>
<div class="ws-table"><table>
<thead><tr><th scope="col">If this is you</th><th scope="col">Take this</th><th scope="col">Why</th></tr></thead>
<tbody>{pick}</tbody>
</table></div>
</div></section>

<section class="ws-past on-ink"><div class="wrap">
<span class="kicker gold">Already taught</span>
<h2 class="ws-h2" style="margin-top:12px">Workshops Nelson has run.</h2>
<ol class="wp-list">{past}</ol>
</div></section>

<section class="ws-private"><div class="wrap"><div class="ws-private-in">
<div>
<span class="kicker gold">For teams and schools</span>
<h2 class="ws-h2" style="margin-top:12px">Bring a workshop to your people.</h2>
<p>Any workshop on this page can run just for your company, class or program, online or on site. Schools and programs can also run a whole cohort on the Academy.</p>
</div>
<div class="ws-private-act"><a class="btn gold" href="/partners/">See programs {_ARR}</a><a class="btn ghost" href="mailto:taylormademd@gmail.com?subject=A%20private%20workshop">Email Nelson</a></div>
</div></div></section>

<section class="ws-faq"><div class="wrap"><div class="ws-faq-grid">
<div><span class="kicker gold">Questions</span><h2 class="ws-h2" style="margin-top:12px">Workshop questions, answered.</h2></div>
<div class="ag-faq">{faq}</div>
</div></div></section>

<section class="ws-loop on-ink"><div class="wrap">
<h2>Get the next dates first.</h2>
<p class="lead">New workshops go to the email list before anywhere else. No spam.</p>
<form class="ws-sub" onsubmit="return BM.subscribe(event,'workshops')">
<label class="sr-only" for="wsEmail">Email address</label>
<input id="wsEmail" type="email" name="email" placeholder="you@email.com" required autocomplete="email">
<button class="btn gold" type="submit">Send me dates</button>
</form>
</div></section>
</main>
{HIDE_PAST}
""" + footer(pop=False)
    return inject(page,
                  breadcrumbs(("Workshops", "/workshops/")),
                  {"@type": "ItemList", "name": "Upcoming Taylormade Academy workshops",
                   "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": event(w)}
                                       for i, w in enumerate(WORKSHOPS)]},
                  faq_from_html(page))
