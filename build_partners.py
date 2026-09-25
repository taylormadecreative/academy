"""/partners/ — the sales page for cohorts and campus hubs (the one link to send a school or program).

Rendered by build_site.py so it inherits the real site header and footer. Styles live in
css/partners.css. The printable sheet is partners/sheet/ (its own page, noindex); the PDF
beside it is made from that sheet with `node scripts/partners-pdf.mjs`. Change the copy in
BOTH places. No prices here, by rule: pricing is set after the call.
"""

TITLE = "Cohorts and campus hubs on Taylormade Academy"
DESC = ("Run your cohort or your whole campus on Taylormade Academy: sign-up, a live class room in the browser, "
        "every class recorded, team spaces and one screen for the coordinator. Co-branded, with your name on the door.")
PDF = "/partners/taylormade-academy-programs.pdf"
MAIL = "mailto:taylormademd@gmail.com?subject=A%20program%20on%20Taylormade%20Academy"

CAPS = [
    ("A home with your name on it", "Your logo beside ours, your colors, and your own address on the site, like taylormadeacademy.com/yourschool. It installs on a phone like an app, straight from the browser. No app store."),
    ("Sign-up that sorts itself", "People apply on your page. Your coordinator approves each one with a tap. Someone joins late? Send a one-time invite link."),
    ("A live class room", "Cameras, chat, polls and screen sharing for everyone. A question line where you bring people &ldquo;on stage.&rdquo; Small groups with a timer, a whiteboard, class files and live captions."),
    ("Every class becomes a replay", "The room records itself. Each replay gets chapters, a transcript and the files from class. Your coordinator looks it over, then publishes it."),
    ("Teams that keep working", "Each team gets a page, a chat, a locker for files and checkpoints, and its own room to meet in. Judges score pitches on a leaderboard, and each team can have a public showcase page."),
    ("One screen for the coordinator", "The roster, approvals, sessions, materials and attendance in one place. Calendar invites, a reminder email 30 minutes before class, and a &ldquo;Need help?&rdquo; button that reaches your team."),
]

OFFICES = [
    ("Advancement", "Donor updates and ways to give"), ("President&rsquo;s office", "Town halls and campus updates"),
    ("Events", "The campus calendar, in one spot"), ("Learn", "Workshops and short courses, like AI literacy"),
    ("Students", "Student life and announcements"), ("Career", "Workshops, employers, office hours"),
    ("Alumni", "An alumni track and reunions"), ("Admissions", "Info sessions for families"),
    ("Outreach", "Community programs"), ("Board", "Trustee materials in one place"),
    ("Community", "A feed and messages"), ("Showcase", "Student work, shown publicly"),
]

SWAP = [("Events app", "A campus calendar with add-to-calendar"), ("Webinar tool", "The live room, for any office"),
        ("Community app", "Feeds, messages and team spaces"), ("Phone app", "Installs from the browser")]

STEPS = [("Talk", "A 20-minute call. Who is in the program, how many people, and how often you meet."),
         ("Plan", "A written plan: the sessions, the spaces, and who teaches."),
         ("Set up", "We build your space, bring in your brand and roster, and train your coordinators."),
         ("Go live", "First class. Every class after that lands in your library.")]

WAYS = [("A cohort program", "A season or a school year of live classes, with the hub around it."),
        ("A campus hub", "Spaces for the offices you choose, open all year."),
        ("We teach, or you do", "Nelson teaches AI, design, photo and video. Or your own people run classes in the room, and he trains them.")]

_DL = ('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
       'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>')


def _shot(name, alt, w, h, eager=False):
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return (f'<picture><source srcset="/partners/img/{name}.webp" type="image/webp">'
            f'<img src="/partners/img/{name}.jpg" width="{w}" height="{h}" alt="{alt}" decoding="async" {load}></picture>')


def partners_page(head, header, footer, ver):
    h = head(TITLE, DESC, "/partners/", og="partners/img/og.jpg").replace(
        "</head>", f'<link rel="stylesheet" href="/css/partners.css?v={ver}">\n'
                   '<link rel="preload" as="image" href="/partners/img/room.webp" type="image/webp" fetchpriority="high">\n</head>')
    caps = "".join(f'<div class="pt-cap"><span class="pt-n">{i}</span><div><h3>{t}</h3><p>{d}</p></div></div>'
                   for i, (t, d) in enumerate(CAPS, 1))
    offices = "".join(f'<li><b>{t}</b><span>{d}</span></li>' for t, d in OFFICES)
    swap = "".join(f'<li><s>{a}</s><i aria-hidden="true">&rarr;</i><span>{b}</span></li>' for a, b in SWAP)
    steps = "".join(f'<li><span class="pt-step">{i}</span><h3>{t}</h3><p>{d}</p></li>' for i, (t, d) in enumerate(STEPS, 1))
    ways = "".join(f'<div class="pt-way"><h3>{t}</h3><p>{d}</p></div>' for t, d in WAYS)
    return h + header() + f"""
<main class="pt">
<section class="pt-hero"><div class="wrap">
<span class="kicker gold">For schools, programs &amp; organizations</span>
<h1>Run your next <em>cohort</em><br>on Taylormade Academy.</h1>
<p class="pt-lead">A cohort is a group of people who start together and learn together. We give yours one home: sign-up, a live class room, every class recorded, team spaces, and one screen for the person running it all. Your name and ours on the door.</p>
<div class="pt-ctas"><a class="btn gold" href="{MAIL}">Email Nelson <span class="arr">&rarr;</span></a><a class="btn pt-line" href="{PDF}" download>{_DL} Download the PDF</a></div>
<figure class="pt-hero-shot"><div class="pt-frame">{_shot("room", "A live Taylormade Academy class room with Nelson Taylor on camera, small groups running and the recording saving", 1182, 748, eager=True)}</div>
<figcaption><b>The real class room, live.</b> Small groups running with a clock, the question line, and the recording saving on its own.</figcaption></figure>
</div></section>

<section class="pt-three" aria-labelledby="pt-glance"><div class="wrap">
<h2 class="pt-sr" id="pt-glance">At a glance</h2>
<div><h3>Taught live.</h3><p>Classes happen in a room that opens in the browser. Nothing to download. Sign in and you are in.</p></div>
<div><h3>Kept for good.</h3><p>Every class records itself and turns into a replay with chapters, a transcript and the class files.</p></div>
<div><h3>Open all year.</h3><p>Teams keep working between classes: their own chat, files, meeting room and showcase page.</p></div>
<p class="pt-live"><span class="pt-tag">Live now</span><span>The Atlanta University Center Data Science Initiative runs its <b>Open Payments Innovation Lab</b> on this platform: 13 student teams, live classes through the school year.</span></p>
</div></section>

<section class="pt-inside" id="inside"><div class="wrap">
<span class="kicker">What&rsquo;s inside</span>
<h2>Everything a cohort needs, <span class="u-gold">in one place</span>.</h2>
<p class="pt-lead">Most programs piece this together from five or six different tools. Here it is one sign-in, and the person running the program never needs a developer.</p>
<div class="pt-caps">{caps}</div>
<div class="pt-pair">
<figure><div class="pt-frame">{_shot("groups", "The small groups board: every room, a countdown clock, and a box to message all rooms", 1182, 748)}</div>
<figcaption><b>Small groups, from the front of the room.</b> See every group, join any room, message them all, add time.</figcaption></figure>
<figure><div class="pt-frame">{_shot("coord", "The coordinator&rsquo;s sessions list with recordings, assignments and resources", 2068, 846)}</div>
<div class="pt-frame">{_shot("attendance", "Attendance for every session, one click per student", 2068, 776)}</div>
<figcaption><b>The coordinator&rsquo;s view.</b> Sessions, files and recordings added without a developer, and attendance in one click. (Sample data.)</figcaption></figure>
</div>
</div></section>

<section class="pt-hub" id="campus"><div class="wrap">
<span class="kicker gold">For a whole campus</span>
<h2>One hub. <em>Every office.</em></h2>
<p class="pt-lead">The same platform can carry a whole university. Each office that wants one gets its own space, all behind one sign-in, and it installs on a phone as your campus app.</p>
<div class="pt-hub-grid">
<div>
<div class="pt-stack"><h3>One place in place of many subscriptions</h3>
<p>A lot of campuses pay for an events app, a webinar tool, a community app and a phone app, one bill each. A hub puts them under one roof.</p>
<ul>{swap}</ul></div>
<div class="pt-beside"><h3>Beside your LMS, never against it</h3><p>Your LMS (learning management system) holds grades and credit. The hub sits next to it and does not replace it. It is where people meet, learn live and stay connected.</p></div>
</div>
<div><p class="pt-offices-h"><b>Spaces we build. Pick the ones you need.</b> Each one is its own page in the hub, in your colors, with that office&rsquo;s events and updates.</p>
<ul class="pt-offices">{offices}</ul></div>
</div>
<div class="pt-brand"><p class="pt-x">Your school <em>&times;</em> Taylormade Academy</p><p><b>Your name on it.</b> A partnership by default: your brand out front, our platform underneath, both names on the door. Carrying your name alone is an option too.</p></div>
</div></section>

<section class="pt-start" id="start"><div class="wrap">
<span class="kicker">How we start</span>
<h2>From a first call to <span class="u-gold">a first class</span>.</h2>
<ol class="pt-steps">{steps}</ol>
<div class="pt-ways">{ways}</div>
<p class="pt-price"><b>About pricing.</b> We set it after the call, based on how many people, how many live classes, and who teaches.</p>
<div class="pt-who">
<img src="/assets/live-demo/poster.jpg" width="1000" height="562" alt="Nelson Taylor in the Taylormade studio, in the navy and gold varsity jacket" loading="lazy" decoding="async">
<div><h3>Nelson Taylor</h3><p class="pt-role">Founder, Taylormade Academy &middot; Creative director, Taylormade Creative &middot; Dallas&ndash;Fort Worth</p>
<p>Fourteen years directing real work for brands and businesses, with AI now part of how his studio runs every day. He runs the Open Payments Innovation Lab for Atlanta University Center students on this platform. In June 2026 he facilitated the Johns Hopkins-funded AI agent workshop for the AUC Data Science Initiative, and he runs public AI workshops for business owners.</p></div>
</div>
</div></section>

<section class="pt-cta"><div class="wrap">
<div><h2>Let&rsquo;s talk about your program.</h2>
<p>Tell us about your group. We will bring a plan to the call. Sending this to someone? The PDF is four pages and prints clean.</p></div>
<div class="pt-ctas"><a class="btn gold" href="{MAIL}">Email Nelson <span class="arr">&rarr;</span></a><a class="btn pt-line" href="{PDF}" download>{_DL} Download the PDF</a></div>
</div></section>
</main>""" + footer()
