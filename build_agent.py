"""/agent/ and /agent/thanks/ — Build Your First AI Agent (public waitlist + seat sales).

Rendered by build_site.py so the pages inherit the real site header and footer. Page
styles live in css/agent.css, behaviour in js/agent.js. Dates, tiers and prices are
never written here: the page reads ea_events_public / ea_tiers_public at load and the
founder dashboard (/founder/) is where Nelson sets them.
"""

TITLE = "Build Your First AI Agent — a one-night workshop by Taylormade Academy"
DESC = ("Build a working AI agent in one night, no code, and leave with the playbook to build the next one. "
        "First taught for AUC's Data Science Institute and Johns Hopkins. Join the waitlist: dates and the early-bird rate go to the list first.")

_ICON_AGENT = ('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
               '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/></svg>')
_ICON_BOOK = ('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
              '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/><path d="M9 7h6"/></svg>')
_ICON_ROOM = ('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
              '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="9" r="2.2"/><path d="M16.5 13.6A4.6 4.6 0 0 1 21 18"/></svg>')

_DIAGRAM = """<svg class="dg-h" viewBox="0 0 640 300" role="img" aria-labelledby="agdt">
<title id="agdt">How an agent works: you describe the job once, the agent reads, decides and acts, you check the result, and it repeats every time without you.</title>
<defs><marker id="agArr" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0b40e0"/></marker></defs>
<g font-family="Inter,system-ui,sans-serif" font-size="14">
  <rect x="12" y="70" width="176" height="96" rx="18" fill="#f5f7fc" stroke="#e4e9f1"/>
  <text x="100" y="105" text-anchor="middle" font-weight="700" fill="#0a1733" font-size="15">You describe the job</text>
  <text x="100" y="128" text-anchor="middle" fill="#5d6b84">in plain English,</text>
  <text x="100" y="146" text-anchor="middle" fill="#5d6b84">one time</text>
  <line x1="190" y1="118" x2="228" y2="118" stroke="#0b40e0" stroke-width="2.5" marker-end="url(#agArr)"/>
  <rect x="232" y="56" width="176" height="124" rx="18" fill="#04123a"/>
  <text x="320" y="92" text-anchor="middle" font-weight="700" fill="#ffffff" font-size="15">The agent</text>
  <text x="320" y="118" text-anchor="middle" fill="#fdc921" font-weight="600">reads</text>
  <text x="320" y="138" text-anchor="middle" fill="#fdc921" font-weight="600">decides</text>
  <text x="320" y="158" text-anchor="middle" fill="#fdc921" font-weight="600">acts</text>
  <line x1="410" y1="118" x2="448" y2="118" stroke="#0b40e0" stroke-width="2.5" marker-end="url(#agArr)"/>
  <rect x="452" y="70" width="176" height="96" rx="18" fill="#f5f7fc" stroke="#e4e9f1"/>
  <text x="540" y="105" text-anchor="middle" font-weight="700" fill="#0a1733" font-size="15">You check the result</text>
  <text x="540" y="128" text-anchor="middle" fill="#5d6b84">a minute, not</text>
  <text x="540" y="146" text-anchor="middle" fill="#5d6b84">an afternoon</text>
  <path d="M540 170 V228 H320 V184" fill="none" stroke="#c9d3e6" stroke-width="2.5" stroke-dasharray="6 6" marker-end="url(#agArr)"/>
  <rect x="332" y="238" width="196" height="30" rx="15" fill="#fff6da" stroke="#f3dfa0"/>
  <text x="430" y="258" text-anchor="middle" fill="#4a3700" font-weight="700" font-size="13">every new task, without you</text>
</g></svg>"""

_DIAGRAM_V = """<svg class="dg-v" viewBox="0 0 360 560" role="img" aria-hidden="true">
<defs><marker id="agArrV" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0b40e0"/></marker></defs>
<g font-family="Inter,system-ui,sans-serif" font-size="16">
  <rect x="40" y="12" width="280" height="92" rx="18" fill="#f5f7fc" stroke="#e4e9f1"/>
  <text x="180" y="48" text-anchor="middle" font-weight="700" fill="#0a1733" font-size="17">You describe the job</text>
  <text x="180" y="76" text-anchor="middle" fill="#5d6b84">in plain English, one time</text>
  <line x1="180" y1="106" x2="180" y2="144" stroke="#0b40e0" stroke-width="2.5" marker-end="url(#agArrV)"/>
  <rect x="40" y="150" width="280" height="140" rx="18" fill="#04123a"/>
  <text x="180" y="188" text-anchor="middle" font-weight="700" fill="#ffffff" font-size="17">The agent</text>
  <text x="180" y="218" text-anchor="middle" fill="#fdc921" font-weight="600">reads</text>
  <text x="180" y="242" text-anchor="middle" fill="#fdc921" font-weight="600">decides</text>
  <text x="180" y="266" text-anchor="middle" fill="#fdc921" font-weight="600">acts</text>
  <line x1="180" y1="292" x2="180" y2="330" stroke="#0b40e0" stroke-width="2.5" marker-end="url(#agArrV)"/>
  <rect x="40" y="336" width="280" height="92" rx="18" fill="#f5f7fc" stroke="#e4e9f1"/>
  <text x="180" y="372" text-anchor="middle" font-weight="700" fill="#0a1733" font-size="17">You check the result</text>
  <text x="180" y="400" text-anchor="middle" fill="#5d6b84">a minute, not an afternoon</text>
  <path d="M320 382 H344 V220 H326" fill="none" stroke="#c9d3e6" stroke-width="2.5" stroke-dasharray="6 6" marker-end="url(#agArrV)"/>
  <rect x="60" y="470" width="240" height="34" rx="17" fill="#fff6da" stroke="#f3dfa0"/>
  <text x="180" y="493" text-anchor="middle" fill="#4a3700" font-weight="700" font-size="14">every new task, without you</text>
</g></svg>"""


def _form(form_id, source, compact=False, on_ink=False):
    """The sign-up sheet. compact = name + email only (closing band)."""
    fields = f"""
<div class="ag-field"><label for="{form_id}-name">Your name</label><input id="{form_id}-name" name="name" type="text" autocomplete="name" placeholder="First and last" required maxlength="120"></div>
<div class="ag-field"><label for="{form_id}-email">Email</label><input id="{form_id}-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@email.com" required maxlength="200"></div>"""
    if not compact:
        fields += f"""
<div class="ag-field"><label for="{form_id}-phone">Phone <span>(optional, for a text the day before)</span></label><input id="{form_id}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="(214) 555-0100" maxlength="40"></div>
<div class="ag-field"><label>Where are you with AI?</label><div class="ag-seg">
<label><input type="radio" name="experience" value="new" checked><span>Brand new</span></label>
<label><input type="radio" name="experience" value="some"><span>I use ChatGPT</span></label>
<label><input type="radio" name="experience" value="building"><span>Already building</span></label></div></div>
<div class="ag-field full"><label for="{form_id}-goal">What should your agent handle? <span>(optional)</span></label><textarea id="{form_id}-goal" name="goal" rows="2" maxlength="500" placeholder="Follow up with new leads, answer the same five questions, write captions from my photos..."></textarea></div>"""
    return f"""<div class="ag-form{' on-paper' if on_ink else ''}">
<div class="ag-live">
<div class="ag-form-h">Put your name on the list</div>
<p class="ag-form-p">Dates go to the list first, with a personal link that opens the waitlist rate before seats go on public sale.</p>
<form id="{form_id}" data-source="{source}" novalidate>
<div class="ag-fields">{fields}</div>
<div class="ag-hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
<div class="ag-submit"><button class="btn gold" type="submit">Save my spot <span class="arr">&rarr;</span></button><span class="fine">No spam. One email when the date drops, one when seats open.</span></div>
<div class="err" role="alert"></div>
</form></div>
<div class="ag-done" aria-live="polite"></div>
</div>"""


def agent_page(head, header, footer, ver):
    h = head(TITLE, DESC, "/agent/", og="assets/og-agent.png").replace(
        "</head>", f'<link rel="stylesheet" href="/css/agent.css?v={ver}">\n<link rel="preload" as="image" href="/assets/agent-nelson.webp" type="image/webp" fetchpriority="high">\n</head>')
    return h + header("Workshop") + f"""
<main>
<section class="ag-hero"><div class="wrap"><div class="ag-grid">
<div class="ag-copy">
<span class="kicker gold">Taylormade Academy workshop</span>
<h1 class="display-xl">Build your first<br>AI <span class="u-gold">agent</span>.</h1>
<p class="lead">One night. No code. You leave with an agent that does a real job for you, and the playbook to build the next one. <b>First taught for AUC's Data Science Institute and Johns Hopkins. Now open to everyone.</b></p>
<div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn ghost" id="heroCta" href="#outcomes">See what you build <span class="arr">&rarr;</span></a></div>
</div>
<div class="ag-sheet">{_form("wlForm", "agent-hero")}</div>
<div class="ag-roster">
<span class="ag-stamp">First public run</span>
<span class="ag-photo"><img src="/assets/agent-nelson.webp" width="715" height="1100" alt="Nelson Taylor in the navy and gold Taylormade Creative varsity jacket" decoding="async" fetchpriority="high"></span>
<div class="ag-plate"><img class="ag-logo" src="/assets/logo-mark.webp" alt="" width="40" height="40"><div><div class="ag-plate-h">Taught by Nelson Taylor</div><p class="ag-plate-p">Fourteen years a working creative in Dallas-Fort Worth. Ran the first version of this workshop for about fifty HBCU students with AUC's Data Science Institute and Johns Hopkins.</p></div></div>
</div>
</div></div></section>

<section class="ag-band on-ink" id="outcomes"><div class="wrap">
<span class="kicker gold">What you walk out with</span>
<h2 class="ag-band-h" style="margin-top:12px">Not notes about agents. An agent.</h2>
<div class="ag-out">
<div class="ag-out-lead">
<div class="ic">{_ICON_AGENT}</div>
<h3>A working agent</h3>
<p>Built by you, on the night, doing one real task from your business or your craft. Not a demo you watched. Yours, running when you get home.</p>
<div class="ag-out-mock" aria-hidden="true">
<div class="ao-bar"><span class="ao-dot"></span><span class="ao-dot"></span><span class="ao-dot"></span><b>Your agent</b></div>
<div class="ao-line"><span class="ao-tag">Reads</span> New inquiry from Danielle</div>
<div class="ao-line"><span class="ao-tag">Decides</span> Pricing question, consult not booked</div>
<div class="ao-line done"><span class="ao-tag">Acts</span> Replied and offered Thursday at 2</div>
</div>
</div>
<div class="ag-out-rest">
<div class="ag-out-item"><div class="ic">{_ICON_BOOK}</div><div><h3>The playbook</h3><p>A step-by-step guide built from the AUC run, prompts included, so you can build the second one on your own.</p></div></div>
<div class="ag-out-item"><div class="ic">{_ICON_ROOM}</div><div><h3>A room that answers</h3><p>A small room. Questions answered while you are stuck instead of three days later, and the Academy community afterwards.</p></div></div>
</div>
</div></div></section>

<section class="ag-define"><div class="wrap"><div class="ag-define-grid">
<div>
<span class="kicker gold">Start here</span>
<h2 style="margin-top:12px">First, what is an AI agent?</h2>
<p class="ag-def">An <b>AI agent</b> is a helper you set up once that does a task for you every time after that. You describe the job in plain English and give it what it needs. It reads, decides, and acts. No code, no engineering degree, no waiting on a developer.</p>
<div class="ag-eg">Picture a salon owner's agent: it reads every new inquiry, answers the three questions everyone asks, and offers a consult time. She checks what it did over coffee.</div>
</div>
<div class="ag-diagram">{_DIAGRAM}{_DIAGRAM_V}</div>
</div></div></section>

<section class="ag-night"><div class="wrap"><div class="ag-night-grid">
<div class="ag-night-intro">
<span class="kicker gold">The night</span>
<h2 style="margin-top:12px">How the evening runs.</h2>
<p class="lead">Bring a laptop and a charger. The tools are free to start and I walk you through the accounts. We build in three moves.</p>
</div>
<ol class="ag-steps">
<li class="ag-step"><span class="t"><b>1</b> Frame</span><h3>Pick the one task that eats your week.</h3><p>We write the job description your agent will follow, in plain words. If you can explain it to a new hire, you can explain it to an agent.</p></li>
<li class="ag-step"><span class="t"><b>2</b> Build</span><h3>Build it live, on the same screen as me.</h3><p>Step by step, click by click. We feed it real examples and test it until it behaves the way you would.</p></li>
<li class="ag-step"><span class="t"><b>3</b> Show</span><h3>Run it for the room.</h3><p>Everyone shows their agent doing its job. You leave with it working, and the playbook to build the next one.</p></li>
</ol></div></div></section>

<section class="ag-dates" id="dates"><div class="wrap">
<span class="kicker gold">Dates</span>
<h2 style="margin-top:12px">Upcoming dates.</h2>
<p class="ag-empty" id="datesEmpty"><b>No public date yet.</b> The first run is being scheduled now. The waitlist hears the date before it appears here, with the link that opens the waitlist rate.</p>
<div class="ag-datelist" id="datesList" style="display:none"></div>
</div></section>

<section class="ag-seats" id="seats" hidden><div class="wrap">
<span class="kicker gold">Seats</span>
<h2 style="margin-top:12px">Get your seat.</h2>
<p class="lead">Small room on purpose. Checkout is secure and handled by Stripe; your seat code comes straight to your email.</p>
<div class="ag-early" id="earlyNote">You came from your waitlist link, so the waitlist rate is showing below.</div>
<div class="ag-tiers" id="tiers"></div>
</div></section>

<section class="ag-note"><div class="wrap"><div class="ag-note-grid">
<div>
<h2>Why I am opening this up.</h2>
<div class="who"><img src="/assets/agent-nelson-sm.webp" alt="" width="48" height="48"><div><b>Nelson Taylor</b><span>Founder, Taylormade Academy</span></div></div>
<div class="letter" style="margin-top:22px">
<p>I taught this first for AUC's Data Science Institute and Johns Hopkins in June 2026: three nights, about fifty students from HBCUs across the country, most of them starting from zero. By the third night they were pitching agents they built themselves.</p>
<p>The question I get most is not "what is AI". It is "what do I actually do with it". This is my answer. One night, one agent, built by you, doing a job you are tired of doing.</p>
<p>If that is what you have been waiting for, put your name down. I will tell you the date before anyone else, and the first seats are yours.</p>
<a class="btn gold" href="#top" data-scroll-form style="margin-top:6px">Put my name down <span class="arr">&rarr;</span></a>
</div>
</div>
<div class="ag-faq">
<details><summary>Do I need to know how to code?</summary><p>No. You describe the job in plain English. The building is clicking, pasting, and testing. If you can write a text message, you can do this.</p></details>
<details><summary>What do I bring?</summary><p>A laptop and a charger. The tools are free to start, and I walk you through the accounts on the night. Phones are fine for following along but not for building.</p></details>
<details><summary>What does it cost?</summary><p>Pricing is announced with the date. The waitlist gets a lower rate before seats go on public sale, and that rate is only ever offered through the link in your waitlist email.</p></details>
<details><summary>Is it online or in person?</summary><p>The first public run is being scheduled now, and the format goes out with the date. If it is in person, it is in Dallas-Fort Worth.</p></details>
<details><summary>What if I cannot make the first date?</summary><p>Stay on the list. Every date goes to the list first, and your personal link keeps working for the next one.</p></details>
<details><summary>What is the refund policy?</summary><p>Seven days, no questions, as long as it is before the workshop date. The full policy is on the <a class="textlink" href="/refunds/">refunds page</a>.</p></details>
</div>
</div></div></section>

<section class="ag-close on-ink"><div class="wrap">
<h2>The first seats go to the list.</h2>
<p class="lead">Dates first. Early bird first. One email when it drops.</p>
{_form("wlForm2", "agent-close", compact=True, on_ink=True)}
</div></section>
</main>

<dialog class="ag-dialog" id="buyDlg" aria-labelledby="bdTitle">
<form class="in" id="bdForm" method="dialog" novalidate>
<h3 id="bdTitle">Seat</h3>
<p class="sub" id="bdSub"></p>
<div class="ag-fields">
<div class="ag-field"><label for="bd-name">Name on the seat</label><input id="bd-name" name="name" type="text" autocomplete="name" required maxlength="120"></div>
<div class="ag-field"><label for="bd-email">Email for the ticket</label><input id="bd-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="200"></div>
<div class="ag-field"><label>Seats</label><div class="qty"><button type="button" id="bdMinus" aria-label="One fewer seat">&minus;</button><output id="bdQty" aria-live="polite">1</output><button type="button" id="bdPlus" aria-label="One more seat">+</button></div></div>
</div>
<div class="tot" id="bdTot"></div>
<p class="bd-fine">Payment is handled by Stripe. Your seat code and the address arrive by email straight after.</p>
<div class="err" role="alert" id="bdErr"></div>
<div class="row"><button class="btn ghost" type="button" id="bdClose">Not now</button><button class="btn gold" type="submit" id="bdGo">Continue to checkout <span class="arr">&rarr;</span></button></div>
</form>
</dialog>
<script src="/js/agent.js?v={ver}" defer></script>
""" + footer()


def agent_thanks_page(head, header, footer, ver):
    h = head("Your seat is confirmed — Taylormade Academy", "Your seat is confirmed. Your seat code is on its way.", "/agent/thanks/").replace(
        "</head>", f'<meta name="robots" content="noindex">\n<link rel="stylesheet" href="/css/agent.css?v={ver}">\n</head>')
    return h + header("Workshop") + """
<main><section class="ag-thanks"><div class="wrap"><div class="card">
<span class="kicker gold" id="thKicker">Ticket</span>
<h1 id="thTitle">Confirming your seat</h1>
<div class="when" id="thWhen" style="display:none"></div>
<div class="ag-codes" id="thCodes"></div>
<p id="thMsg">One moment while Stripe hands the payment back to me.</p>
<a class="btn gold" id="thCta" href="/login/?mode=join">Join the Academy free before the night <span class="arr">&rarr;</span></a>
</div></div></section></main>
<script>
(function(){
  var CFG=window.BM_CONFIG||{}, q=new URLSearchParams(location.search), $=function(i){return document.getElementById(i)};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})};
  var HELP='<a class="textlink" href="mailto:hello@taylormadecreative.net">hello@taylormadecreative.net</a>';
  function when(d){
    if(!d.event){return;}
    $('thWhen').style.display='';
    $('thWhen').innerHTML='<b>'+esc(d.event.title)+'</b>'+(d.tier?' &middot; '+esc(d.tier):'')+'<br>'+esc(d.event.when)+(d.event.venue_label?'<br>'+esc(d.event.venue_label):(d.event.format==='virtual'?'<br>Online':''));
  }
  /* We have codes and the order is paid. Only this state says "you are in". */
  function confirmed(d){
    $('thTitle').textContent=(d.first_name?d.first_name+', you':'You')+' are in.';
    when(d);
    $('thCodes').innerHTML=(d.codes||[]).map(function(c){return '<span class="ag-code">'+esc(c)+'</span>'}).join('');
    $('thMsg').innerHTML='That is your seat code. It is also in your email, with the address and everything to bring.';
  }
  /* Paid, but the seats have not landed yet. Never claim more than we know. */
  function pending(d){
    $('thKicker').textContent='Almost there';
    $('thTitle').textContent='Your payment went through.';
    when(d);
    $('thMsg').innerHTML='Your seat code is still being issued. It lands in your email within a few minutes, with the address and everything to bring. If it has not arrived within the hour, email '+HELP+' and I will sort it out.';
  }
  /* No completed order behind this link. Do not tell anyone they have a seat. */
  function unknown(){
    $('thKicker').textContent='Check your email';
    $('thTitle').textContent='I cannot confirm this one from here.';
    $('thMsg').innerHTML='This link does not show a completed order. If you were charged, your seat code is in your email. If nothing arrived, email '+HELP+' with the name you used and I will find it.';
    $('thCta').outerHTML='<a class="btn gold" href="/agent/#seats">Back to the workshop <span class="arr">&rarr;</span></a>';
  }
  if(q.get('free')==='1'){
    var freeCodes=(q.get('codes')||'').split(',').filter(Boolean);
    if(freeCodes.length){confirmed({codes:freeCodes});}else{unknown();}
    return;
  }
  var sid=q.get('session_id')||'', tries=0;
  if(!/^cs_[A-Za-z0-9_]{10,}$/.test(sid)){unknown();return;}
  (function poll(){
    fetch(CFG.FUNCTIONS_BASE+'/ea-ticket-checkout?session_id='+encodeURIComponent(sid))
      .then(function(r){return r.status===404?'gone':(r.ok?r.json():null)})
      .then(function(d){
        if(d==='gone'){ if(++tries<6){setTimeout(poll,2500);}else{unknown();} return; }
        if(d&&d.status==='paid'&&d.codes&&d.codes.length){confirmed(d);return;}
        if(++tries<8){setTimeout(poll,2000);return;}
        if(d&&(d.status==='refunded'||d.status==='canceled')){unknown();}
        else if(d){pending(d);}
        else{unknown();}
      })
      .catch(function(){if(++tries<8){setTimeout(poll,2500);}else{unknown();}});
  })();
})();
</script>
""" + footer()
