"""/ai101/ and /ai101/replay/ — AI 101, the free live class before Build Your First AI Agent.

Rendered by build_site.py like /agent/, so it inherits the real header and footer. It reuses
css/agent.css for the shared pieces (sign-up sheet, roster panel, navy band, steps, FAQ) and
adds only what is new in css/ai101.css. Behaviour lives in js/ai101.js.

The seat is a $0 tier on an ea_events row with workshop_slug 'ai101', sold through the same
ea-ticket-checkout -> ea_fulfill_order path as the paid workshop. The DATE appears in the copy
in one place: the constants below. Never edit ai101/index.html by hand; the next
build_site.py run overwrites it.
"""

DAY = "October 3"
DATE = "Saturday, October 3, 7 PM CT"
DATE_LONG = "Saturday, October 3, 2026, 7 PM CT"
AGENT_DAY = "October 17"

TITLE = "AI 101: a free live class on prompts and AI words, by Taylormade Academy"
DESC = (f"{DATE_LONG}. Free, 45 minutes, live online. Learn how to ask AI for what you want, "
        "and what the AI words everyone uses actually mean. No experience needed.")

# A prompt, drawn: what you type goes in, the AI reads it, an answer comes out, and a clearer
# ask brings a better answer back. Two drawings (wide + phone), same idea.
_DIAGRAM = """<svg class="dg-h" viewBox="0 0 640 280" role="img" aria-labelledby="a1dt">
<title id="a1dt">How a prompt works: you type what you want, the AI reads it and writes an answer, and when you add more detail you get a better answer back.</title>
<defs><marker id="a1Arr" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0b40e0"/></marker></defs>
<g font-family="Inter,system-ui,sans-serif" font-size="14">
  <rect x="12" y="62" width="176" height="104" rx="18" fill="#f5f7fc" stroke="#e4e9f1"/>
  <text x="100" y="98" text-anchor="middle" font-weight="700" fill="#0a1733" font-size="15">You type a prompt</text>
  <text x="100" y="122" text-anchor="middle" fill="#5d6b84">what you want,</text>
  <text x="100" y="140" text-anchor="middle" fill="#5d6b84">in plain words</text>
  <line x1="190" y1="114" x2="228" y2="114" stroke="#0b40e0" stroke-width="2.5" marker-end="url(#a1Arr)"/>
  <rect x="232" y="52" width="176" height="124" rx="18" fill="#04123a"/>
  <text x="320" y="92" text-anchor="middle" font-weight="700" fill="#ffffff" font-size="15">The AI</text>
  <text x="320" y="120" text-anchor="middle" fill="#fdc921" font-weight="600">reads your words</text>
  <text x="320" y="142" text-anchor="middle" fill="#fdc921" font-weight="600">writes an answer</text>
  <line x1="410" y1="114" x2="448" y2="114" stroke="#0b40e0" stroke-width="2.5" marker-end="url(#a1Arr)"/>
  <rect x="452" y="62" width="176" height="104" rx="18" fill="#f5f7fc" stroke="#e4e9f1"/>
  <text x="540" y="98" text-anchor="middle" font-weight="700" fill="#0a1733" font-size="15">You get an answer</text>
  <text x="540" y="122" text-anchor="middle" fill="#5d6b84">keep it, or ask</text>
  <text x="540" y="140" text-anchor="middle" fill="#5d6b84">for changes</text>
  <path d="M540 170 V224 H100 V172" fill="none" stroke="#c9d3e6" stroke-width="2.5" stroke-dasharray="6 6" marker-end="url(#a1Arr)"/>
  <rect x="210" y="236" width="220" height="30" rx="15" fill="#fff6da" stroke="#f3dfa0"/>
  <text x="320" y="256" text-anchor="middle" fill="#4a3700" font-weight="700" font-size="13">more detail in, better answer out</text>
</g></svg>"""

_DIAGRAM_V = """<svg class="dg-v" viewBox="0 0 360 560" role="img" aria-hidden="true">
<defs><marker id="a1ArrV" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0b40e0"/></marker></defs>
<g font-family="Inter,system-ui,sans-serif" font-size="16">
  <rect x="40" y="12" width="280" height="92" rx="18" fill="#f5f7fc" stroke="#e4e9f1"/>
  <text x="180" y="48" text-anchor="middle" font-weight="700" fill="#0a1733" font-size="17">You type a prompt</text>
  <text x="180" y="76" text-anchor="middle" fill="#5d6b84">what you want, in plain words</text>
  <line x1="180" y1="106" x2="180" y2="144" stroke="#0b40e0" stroke-width="2.5" marker-end="url(#a1ArrV)"/>
  <rect x="40" y="150" width="280" height="120" rx="18" fill="#04123a"/>
  <text x="180" y="190" text-anchor="middle" font-weight="700" fill="#ffffff" font-size="17">The AI</text>
  <text x="180" y="220" text-anchor="middle" fill="#fdc921" font-weight="600">reads your words</text>
  <text x="180" y="246" text-anchor="middle" fill="#fdc921" font-weight="600">writes an answer</text>
  <line x1="180" y1="272" x2="180" y2="310" stroke="#0b40e0" stroke-width="2.5" marker-end="url(#a1ArrV)"/>
  <rect x="40" y="316" width="280" height="92" rx="18" fill="#f5f7fc" stroke="#e4e9f1"/>
  <text x="180" y="352" text-anchor="middle" font-weight="700" fill="#0a1733" font-size="17">You get an answer</text>
  <text x="180" y="380" text-anchor="middle" fill="#5d6b84">keep it, or ask for changes</text>
  <path d="M320 362 H344 V58 H326" fill="none" stroke="#c9d3e6" stroke-width="2.5" stroke-dasharray="6 6" marker-end="url(#a1ArrV)"/>
  <rect x="50" y="450" width="260" height="34" rx="17" fill="#fff6da" stroke="#f3dfa0"/>
  <text x="180" y="473" text-anchor="middle" fill="#4a3700" font-weight="700" font-size="14">more detail in, better answer out</text>
</g></svg>"""

# The words, each in one plain sentence. The class covers these and a few more.
WORDS = [
    ("AI", "A computer program that can read and write like a person. It learned from a huge amount of writing."),
    ("Chatbot", "An AI you talk to by typing, like ChatGPT or Claude. You ask, it answers."),
    ("Prompt", "What you type to the AI. The clearer your prompt, the better the answer."),
    ("Model", "The “brain” behind a chatbot. Different models are better at different jobs."),
    ("Hallucination", "When the AI says something wrong but sounds sure. It is why you always check the answer."),
    ("Agent", "An AI helper you set up once that does a task for you again and again. That is the October 17 workshop."),
]


def _form(form_id, source, compact=False, on_ink=False):
    """The free sign-up. Name + email only. js/ai101.js posts it to ea-ticket-checkout."""
    return f"""<div class="ag-form a1-form{' on-paper' if on_ink else ''}">
<div class="ag-live">
<div class="ag-form-h">Save your free seat</div>
<p class="ag-form-p">{DATE}. 45 minutes, online. Your room link comes by email.</p>
<form id="{form_id}" data-source="{source}" novalidate>
<div class="ag-fields">
<div class="ag-field"><label for="{form_id}-name">Your name</label><input id="{form_id}-name" name="name" type="text" autocomplete="name" placeholder="First and last" required maxlength="120"></div>
<div class="ag-field"><label for="{form_id}-email">Email</label><input id="{form_id}-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@email.com" required maxlength="200"></div>
</div>
<div class="ag-hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
<div class="ag-submit"><button class="btn gold" type="submit">Save my free seat <span class="arr">&rarr;</span></button><span class="fine">Free. Your link by email, then a reminder the day before and an hour before. You also hear about the {AGENT_DAY} workshop; leave anytime.</span></div>
<div class="err" role="alert"></div>
</form></div>
<div class="ag-done" aria-live="polite"></div>
</div>"""


def ai101_page(head, header, footer, ver):
    h = head(TITLE, DESC, "/ai101/", og="assets/og-agent.png").replace(
        "</head>", f'<link rel="stylesheet" href="/css/agent.css?v={ver}">\n<link rel="stylesheet" href="/css/ai101.css?v={ver}">\n<link rel="preload" as="image" href="/assets/agent-nelson.webp" type="image/webp" fetchpriority="high">\n</head>')
    words = "".join(f'<div class="a1-word"><dt>{w}</dt><dd>{d}</dd></div>' for w, d in WORDS)
    return h + header("Free class") + f"""
<main>
<section class="ag-hero"><div class="wrap"><div class="ag-grid">
<div class="ag-copy">
<span class="kicker gold">Free live class</span>
<h1 class="display-xl">AI 101.<br>Learn to <span class="u-gold">talk</span> to AI.</h1>
<p class="lead">{DATE}. 45 minutes, live online, free. Learn how to ask AI for what you want, and what all the AI words mean. <b>No experience needed. If you can send a text, you can do this.</b></p>
<div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn gold a1-jump" href="#top" data-scroll-form>Save my free seat <span class="arr">&rarr;</span></a><a class="btn ghost" href="#learn">See what you learn <span class="arr">&rarr;</span></a></div>
</div>
<div class="ag-sheet">{_form("a1Form", "ai101-hero")}</div>
<div class="ag-roster">
<span class="ag-stamp">Free &middot; 45 min</span>
<span class="ag-photo"><img src="/assets/agent-nelson.webp" width="715" height="1100" alt="Nelson Taylor in the navy and gold Taylormade Creative varsity jacket" decoding="async" fetchpriority="high"></span>
<div class="ag-plate"><img class="ag-logo" src="/assets/logo-mark.webp" alt="" width="40" height="40"><div><div class="ag-plate-h">Taught by Nelson Taylor</div><p class="ag-plate-p">Fourteen years a working creative in Dallas-Fort Worth. Taught AI to HBCU students with AUC's Data Science Institute and Johns Hopkins.</p></div></div>
</div>
</div></div></section>

<section class="ag-band on-ink" id="learn"><div class="wrap">
<span class="kicker gold">What you learn</span>
<h2 class="ag-band-h" style="margin-top:12px">Three things, in plain English.</h2>
<div class="ag-out">
<div class="ag-out-lead">
<h3>How to write a prompt</h3>
<p>A prompt is what you type to the AI. I show you a simple way to ask so the answer comes back right the first time, not the fifth. We try it together, live.</p>
<div class="ag-out-mock" aria-hidden="true">
<div class="ao-label">Before and after</div>
<div class="ao-line"><span class="ao-tag">Before</span> Write a post about my bakery.</div>
<div class="ao-line done"><span class="ao-tag">After</span> You are a social media writer for a small family bakery. Write an Instagram caption for our new sweet potato pie. It's my grandmother's recipe, sold on Fridays only. Our customers are busy parents. Keep it under 60 words, warm, end with a question.</div>
</div>
</div>
<div class="ag-out-rest">
<div class="ag-out-item"><div><h3>The AI words, decoded</h3><p>Model, prompt, hallucination, agent. Each word in one plain sentence, so you can follow any AI conversation.</p></div></div>
<div class="ag-out-item"><div><h3>A one-page cheat sheet</h3><p>The prompt steps and the words, on one page. It comes in your sign-up email, so you can keep it next to you.</p></div></div>
</div>
</div></div></section>

<section class="ag-define"><div class="wrap"><div class="ag-define-grid">
<div>
<span class="kicker gold">Start here</span>
<h2 style="margin-top:12px">What is a prompt?</h2>
<p class="ag-def">A <b>prompt</b> is the message you type to an AI like ChatGPT or Claude. The AI reads your words and writes an answer. It only knows what you tell it. So the more clearly you say what you want, the better the answer.</p>
<div class="ag-eg">Think of it like ordering food. “Something to eat” gets you anything. “A turkey sandwich on wheat, no onions” gets you lunch.</div>
</div>
<div class="ag-diagram">{_DIAGRAM}{_DIAGRAM_V}</div>
</div></div></section>

<section class="a1-words"><div class="wrap">
<span class="kicker gold">The words</span>
<h2 style="margin-top:12px">Six words you will hear everywhere.</h2>
<p class="lead" style="margin-top:12px">We go through these and a few more in class. Each one, in one plain sentence.</p>
<dl class="a1-wordlist">{words}</dl>
</div></section>

<section class="ag-night"><div class="wrap"><div class="ag-night-grid">
<div class="ag-night-intro">
<span class="kicker gold">The 45 minutes</span>
<h2 style="margin-top:12px">How the class runs.</h2>
<p class="lead">{DATE}, live in the Taylormade Academy room. Open it on a laptop, tablet, or phone. A laptop makes it easier to try things along with me.</p>
</div>
<ol class="ag-steps">
<li class="ag-step"><span class="t"><b>1</b> Words</span><h3>What AI is, and the words people use.</h3><p>No tech talk. Each word in plain English, with an everyday example.</p></li>
<li class="ag-step"><span class="t"><b>2</b> Prompts</span><h3>How to ask so you get a good answer.</h3><p>I show you a simple way to write a prompt, then we fix a few weak ones together, live on screen.</p></li>
<li class="ag-step"><span class="t"><b>3</b> Try it</span><h3>Your turn, plus questions.</h3><p>You write a prompt for something in your own life or business. Then I answer questions. In the last few minutes I tell you about the next step: the Build Your First AI Agent workshop on {AGENT_DAY}.</p></li>
</ol></div></div></section>

<section class="ag-note"><div class="wrap"><div class="ag-note-grid">
<div>
<h2>Why this one is free.</h2>
<div class="who"><img src="/assets/agent-nelson-sm.webp" alt="" width="48" height="48"><div><b>Nelson Taylor</b><span>Founder, Taylormade Academy</span></div></div>
<div class="letter" style="margin-top:22px">
<p>The thing I hear most is “I think I'm too old to learn this.” You are not. Most people just never had someone explain it plainly.</p>
<p>So this first step is free. Forty-five minutes, the words, and how to ask. If you like it, the Academy has more, and on {AGENT_DAY} I teach the next step: building your own AI agent.</p>
<a class="btn gold" href="#top" data-scroll-form style="margin-top:6px">Save my free seat <span class="arr">&rarr;</span></a>
</div>
</div>
<div class="ag-faq">
<details><summary>Is it really free?</summary><p>Yes. No card, no catch. You save a seat with your name and email.</p></details>
<details><summary>How do I get in?</summary><p>Your sign-up email has the room link. You sign in with a free Taylormade Academy account, using the same email. Making the account takes about a minute. You can do it now so you are ready.</p></details>
<details><summary>What do I need?</summary><p>A laptop, tablet, or phone with internet. A laptop is best if you want to try along with me. A free ChatGPT or Claude account helps, but you can just watch.</p></details>
<details><summary>Do I need to know anything about AI?</summary><p>No. This class is for beginners. We start from zero.</p></details>
<details><summary>Will there be a replay?</summary><p>The live class is free. The replay is for Academy members, at $15 a month. So come live if you can.</p></details>
<details><summary>Can I bring a friend?</summary><p>Yes. Send them this page. Each person saves their own seat with their own email.</p></details>
</div>
</div></div></section>

<section class="ag-close a1-close on-ink"><div class="wrap">
<h2>45 minutes. Free. Start here.</h2>
<p class="lead">{DATE}, online. Save your seat and the link comes to your email.</p>
{_form("a1Form2", "ai101-close", compact=True, on_ink=True)}
</div></section>
</main>
<script src="/js/ai101.js?v={ver}" defer></script>
""" + footer(pop=False)


def ai101_replay_page(head, header, footer, ver):
    h = head("AI 101 replay — Taylormade Academy", "The AI 101 replay is for Taylormade Academy members.", "/ai101/replay/").replace(
        "</head>", f'<meta name="robots" content="noindex">\n<link rel="stylesheet" href="/css/agent.css?v={ver}">\n<link rel="stylesheet" href="/css/ai101.css?v={ver}">\n</head>')
    return h + header("Free class") + f"""
<main><section class="a1-replay"><div class="wrap">
<span class="kicker gold">Replay</span>
<h1 class="display-l" style="margin-top:12px">AI 101, the replay.</h1>
<div class="a1-rp" id="rp" aria-live="polite"><p class="muted">Checking your account&hellip;</p></div>
</div></section></main>
<script type="module">
const CFG = window.BM_CONFIG || {{}};
const box = document.getElementById("rp");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({{ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }}[c]));
let settled = false;
const card = (h, p, acts) => {{ settled = true; box.innerHTML = '<div class="a1-rp-card"><h2>' + h + '</h2><p>' + p + '</p>' + (acts ? '<div class="a1-rp-acts">' + acts + '</div>' : '') + '</div>'; }};
const failCard = () => card("Something went wrong.", "The replay could not load. Refresh the page, or email <a class=\\"textlink\\" href=\\"mailto:hello@taylormadecreative.net\\">hello@taylormadecreative.net</a>.", "");
// a blocked or slow CDN must never leave "Checking your account" up forever
setTimeout(() => {{ if (!settled) failCard(); }}, 8000);
try {{
  // loaded inside the try, so a failed load lands on the error card
  const [{{ iframeUrl }}, {{ createClient }}] = await Promise.all([
    import("/js/room-page.js?v={ver}"),
    import("https://esm.sh/@supabase/supabase-js@2"),
  ]);
  const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  const {{ data: {{ session }} }} = await sb.auth.getSession();
  if (!session) {{
    card("Sign in to watch.", "The AI 101 replay is for Taylormade Academy members. Sign in first, and if you are a member it plays right here.",
      '<a class="btn gold" href="/login/?next=' + encodeURIComponent("/ai101/replay/") + '">Sign in <span class="arr">&rarr;</span></a><a class="btn ghost" href="/pricing/">What members get</a>');
  }} else {{
    const {{ data: member, error: mErr }} = await sb.rpc("ea_is_member");
    if (mErr) throw mErr;
    if (!member) {{
      card("The replay is for members.", "The live class was free. The replay is part of the Taylormade Academy membership: $15 a month, every replay, every ebook, every course. Cancel anytime. Use the same email you signed in with at checkout.",
        '<a class="btn gold" href="#" data-buy="all-access">Join for $15/mo to watch <span class="arr">&rarr;</span></a><a class="btn ghost" href="/pricing/">What members get</a>');
    }} else {{
      if (Date.now() < Date.parse("2026-10-04T00:45:00Z")) {{
        card("The replay is on its way.", "AI 101 is live on Saturday, October 3 at 7 PM Central. The replay shows up here after class.", '<a class="btn ghost" href="/ai101/">Save your free seat</a>');
        throw "shown";
      }}
      const {{ data: st, error: sErr }} = await sb.rpc("ea_room_state");
      if (sErr) throw sErr;
      const url = st && st.recording_url ? iframeUrl(st.recording_url) : null;
      if (!url) {{
        card("The replay is on its way.", "It shows up here once it is ready, usually within a day of the class. Check back soon.", '<a class="btn ghost" href="/live/">Go to Live</a>');
      }} else {{
        settled = true;
        box.innerHTML = '<div class="a1-rp-player"><iframe src="' + esc(url) + '" title="AI 101 replay" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
          '<p class="a1-rp-next">Ready for the next step? <a class="textlink" href="/agent/">Build Your First AI Agent, {AGENT_DAY}</a>.</p>';
      }}
    }}
  }}
}} catch (e) {{
  if (e !== "shown") failCard();
}}
</script>
""" + footer(pop=False)
