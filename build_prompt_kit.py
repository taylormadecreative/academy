"""The AI 101 Prompt Kit: the 3-page class-day cheat sheet (US Letter), built from ai101_course.py and printed to
PDF with headless Chrome. It replaces the old one-pager AT THE SAME ADDRESS, /ai101/cheat-sheet.pdf, so every
link already out there gets the new kit. Nelson hands it out in the room's Files tab at 7:58.
Page 1 is the reference (5 parts, 3 rules, the loop, the words), page 2 is "use it tonight" (fill-in with real
writing lines, follow-ups, fix-its, never paste), page 3 is 15 prompts. Prompts print at 8.8pt: on paper, for a
35-65 crowd, 7pt was too small (design review 10/6), and the accurate copy no longer fits two pages.

Run:  python3 build_prompt_kit.py     → ai101/cheat-sheet.pdf + a pickup copy in ~/Downloads/Fall AI Workshops/Class/
The work folder (kit.html, fonts, previews) lives outside the public repo. Fonts are local TTFs so the PDF never
waits on a network font. No CSS masks: they break Chrome's PDF output.
"""
import html, pathlib, re, shutil, subprocess
from ai101_course import (EVENT, PARTS, DEMO, LIBRARY, FOLLOW_UPS, FIX_IT, NEVER_PASTE, NEVER_PASTE_SLIP, WORDS_FULL, TOOLS,
                          TOOL_ORDER, FOLLOW, TEN_THINGS)
from build_ai101_class import check_public_copy

e = html.escape
ROOT = pathlib.Path(__file__).parent
WORK = pathlib.Path.home() / "workshop-campaigns/ai-101-free/prompt-kit"
OLD = pathlib.Path.home() / "workshop-campaigns/ai-101-free/cheat-sheet"
PICKUP = pathlib.Path.home() / "Downloads/Fall AI Workshops/Class/AI-101-Prompt-Kit.pdf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
COLORS = {"role": "#0b40e0", "task": "#a16207", "context": "#0b7a53", "format": "#c2410c", "example": "#7048e8"}  # = css/ai101-class.css --p-*
PICKS = 3     # prompts per library group on page 3 → 15; all 30 are on the class page
PAGES = 3

FIT = """
/* fit: both pages print on one sheet each with the footer showing (tests/academy/prompt-kit.test.mjs checks) */
header{padding:.15in .45in .13in}
.brand{margin-bottom:6px}
.words .w{padding:2px 0 3px}
.band .never,.band .box{padding:6px 9px}
.band h2{margin-bottom:3px}
.kp-prompt{padding:2px 0 3px}
.kp-prompt b{font-size:8pt}
.kp-prompt span{font-size:7.4pt;line-height:1.27}
header.slim{padding:.1in .45in .09in}
header.slim h1{font-size:19pt}
header.slim .hsub{margin-top:3px}
.p2 .fill i{height:12px}
.p2 .kp-fu{font-size:7.6pt;padding:1px 6px}
.fix3 dd{font-size:7.6pt}
.p2 .box h2{margin-bottom:2px}
.save-cell{grid-column:span 2}
.save-cell p{margin:1px 0 0;font-size:8.2pt;color:var(--ink)}
.save-cell p b{display:inline;font:700 8.2pt 'IN'}
.band{display:block}
.band .never ul{columns:3;column-gap:16px}
/* final review (10/6): readable on paper (prompts 8.8pt, nothing under 7pt), and every word at least .25in from the
   paper's edge, where home printers can't print */
header{padding-top:.24in}
header.slim{padding-top:.22in}
footer{padding:.1in .45in .3in}
main{gap:.07in}
.lib .grp{break-inside:avoid}
.kp-prompt b{font-size:9.2pt}.kp-prompt span{font-size:8.8pt;line-height:1.32}
.fix3 dt{font-size:8.8pt}.fix3 dd{font-size:8.2pt}.p2 .kp-fu{font-size:8.2pt}.grp h3{font-size:7.6pt}
.seg i{font-size:7pt}.tag{font-size:7.4pt}
.p2 .fill{gap:6px}.p2 .fill i{height:30px}.fill div{grid-template-columns:16px 58px 1fr}
.p2 .never ul{columns:2;column-gap:16px}.p2 .never li{break-inside:avoid;font-size:8.6pt}
.slip{margin-top:5px;font-weight:700;color:#9a3412}.ask{margin-top:3px;color:var(--ink)}
header.slim{padding-top:.27in}
.p2 .fill{gap:8px}.p2 .fill i{height:38px}.p2 .fix3 dt{font-size:9.6pt}.p2 .fix3 dd{font-size:9pt}.p2 .kp-fu{font-size:8.8pt}
.p2 .never li,.p2 .never p{font-size:9pt}
.notes{flex:1;display:flex;flex-direction:column;min-height:.6in}.notes .lines{flex:1;background:repeating-linear-gradient(transparent 0 29px,#b9c3dc 29px 30px)}
.p3 .kp-prompt b{font-size:10pt}.p3 .lib .kp-prompt span{font-size:9.6pt}.p3 .grp h3{font-size:8pt}
footer .more{display:block;font-size:7.4pt;color:#9fb0d4}
"""  # appended after CSS so these sizes win

CSS = """
@font-face{font-family:'SG';src:url('fonts/SpaceGrotesk-600.ttf');font-weight:600}
@font-face{font-family:'SG';src:url('fonts/SpaceGrotesk-700.ttf');font-weight:700}
@font-face{font-family:'IN';src:url('fonts/Inter-400.ttf');font-weight:400}
@font-face{font-family:'IN';src:url('fonts/Inter-500.ttf');font-weight:500}
@font-face{font-family:'IN';src:url('fonts/Inter-700.ttf');font-weight:700}
@font-face{font-family:'IN';src:url('fonts/Inter-800.ttf');font-weight:800}
@page{size:Letter;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
:root{--navy:#04123a;--blue:#0b40e0;--gold:#fdc921;--paper:#fcfdff;--ink:#0d1530;--mute:#4a5578;--line:#dfe5f3;--tint:#f1f4fc}
html,body{background:var(--paper)}
body{font-family:'IN';color:var(--ink);font-size:8.6pt;line-height:1.38;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:8.5in;height:11in;position:relative;overflow:hidden;display:flex;flex-direction:column;page-break-after:always}
.page:last-child{page-break-after:auto}
.hair{height:6px;flex:none;background:linear-gradient(90deg,var(--blue) 0 34%,var(--gold) 34% 100%)}
header{background:var(--navy);color:#fff;padding:.18in .45in .16in;display:flex;justify-content:space-between;align-items:flex-end;gap:.2in}
.brand{display:flex;align-items:center;gap:7px;font:600 10pt 'SG';letter-spacing:-.02em;margin-bottom:9px}
.brand img{width:26px;height:26px}
h1{font:700 26pt/1 'SG';letter-spacing:-.035em}
h1 u{text-decoration:none;position:relative;z-index:0}
h1 u::after{content:'';position:absolute;left:-.03em;right:-.03em;bottom:.02em;height:.16em;background:var(--gold);border-radius:2px;z-index:-1}
.hsub{color:#b8c5e6;font-size:9.5pt;margin-top:6px}
.hright{text-align:right;font-size:8pt;color:#b8c5e6;line-height:1.5}
.hright b{display:block;color:var(--gold);font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:7pt}
main{padding:.14in .45in .1in;flex:1;display:flex;flex-direction:column;gap:.09in}
h2{font:700 12.5pt/1.1 'SG';letter-spacing:-.02em;margin-bottom:5px;display:flex;gap:8px;align-items:baseline}
h2 small{font:500 8.4pt 'IN';color:var(--mute)}
.f5{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.f5 div{background:var(--tint);border-radius:9px;padding:8px 9px;border-top:3px solid var(--c)}
.f5 b{font:700 15pt/1 'SG';color:var(--c);margin-right:4px}
.f5 strong{font:700 10pt 'SG'}
.f5 p{color:var(--mute);margin-top:3px;font-size:8.3pt}
.ba{display:grid;grid-template-columns:.75fr 2fr;gap:7px;margin-top:7px}
.ba>div{border-radius:9px;padding:8px 10px;background:#fff}
.before{border:1.5px dashed #c3cbe0;color:var(--mute)}
.after{border:1.5px solid var(--navy);line-height:1.5}
.tag{display:block;font:800 6.8pt 'IN';letter-spacing:.16em;text-transform:uppercase;margin-bottom:3px;color:#8a93ad}
.after .tag{color:var(--blue)}
.seg{border-bottom:2px solid var(--c)}
.seg i{font:800 6.2pt 'IN';font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--c);border-radius:99px;padding:1px 5px;margin-left:3px;vertical-align:1px}
.mid{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}
.rules{list-style:none;display:grid;gap:4px;counter-reset:r}
.rules li{counter-increment:r;display:grid;grid-template-columns:20px 1fr;gap:6px}
.rules li::before{content:counter(r);width:18px;height:18px;border-radius:50%;background:var(--gold);color:#231a00;font:800 8pt 'IN';display:grid;place-items:center}
.rules b{font:700 9.4pt 'SG';display:block}
.rules span{color:var(--mute)}
.loop{background:var(--tint);border-radius:11px;padding:9px 11px}
.loop svg{width:100%;height:auto;display:block}
.words{display:grid;grid-template-columns:repeat(3,1fr);gap:0 14px}
.w{padding:3px 0 4px;border-top:1px solid var(--line)}
.w b{font:700 9.2pt 'SG';display:block}
.w span{color:var(--mute);font-size:8.3pt;line-height:1.28;display:block}
footer{margin-top:auto;background:var(--navy);color:#fff;padding:.13in .45in;display:flex;justify-content:space-between;align-items:center;font-size:8.4pt;gap:.2in}
footer .url{font:700 10.5pt 'SG'}
footer .url b{color:var(--gold)}
footer .fol{color:#c9d3ee;text-align:right}
footer .fol b{color:#fff}
/* page 1 bottom band */
.band{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.save-lead{color:var(--mute);margin-bottom:3px}
/* page 2 */
header.slim{padding:.12in .45in .12in}
header.slim h1{font-size:21pt}
.top2{display:grid;grid-template-columns:1fr 1.15fr;gap:14px}
.lib{column-count:2;column-gap:14px}
.lib .grp{break-inside:auto}
.lib .grp h3{break-after:avoid}
.lib .kp-prompt{break-inside:avoid}
.fix3{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 12px}
.fix3 dt{font-size:8.3pt}
.fix3 dd{margin:0;font-size:7.8pt;line-height:1.3}
.p2 main{gap:.07in;padding-top:.1in}
.p2 h2{font-size:11.5pt;margin-bottom:4px}
.p2 .fill{gap:3px}
.p2 .fill i{height:14px}
.p2 .kp-fu{padding:2px 7px;font-size:7.9pt}
.p2 .fus{gap:3px}
.p2 .box{padding:6px 9px}
/* page 1: the bottom band stays compact */
.band .never ul{columns:2;column-gap:14px}
.band .never li{break-inside:avoid;font-size:8.2pt}
.band .box p,.band .save-lead{font-size:8.2pt}
.words .w span{font-size:8.1pt;line-height:1.25}
.ba>div{padding:7px 9px}

.two{display:grid;grid-template-columns:1fr 1.25fr;gap:14px;flex:1}
.col{display:flex;flex-direction:column;gap:.09in}
.fill{display:grid;gap:5px}
.fill div{display:grid;grid-template-columns:16px auto 1fr;gap:6px;align-items:end}
.fill b{font:700 11pt/1 'SG';color:var(--c)}
.fill strong{font:700 8.6pt 'SG'}
.fill i{border-bottom:1.2px solid #b9c3dc;height:16px}
.fus{display:flex;flex-wrap:wrap;gap:4px}
.kp-fu{background:var(--tint);border-radius:99px;padding:3px 8px;font-weight:500}
.box{background:#fff;border:1px solid var(--line);border-radius:9px;padding:7px 9px}
.box dt{font:700 8.8pt 'SG'}
.box dd{color:var(--mute);margin:0 0 4px}
.never{background:#fff4ef;border:1px solid #f6cbb7;border-radius:9px;padding:7px 9px}
.never ul{padding-left:14px;color:var(--ink)}
.never h2{color:#9a3412}
.save p{margin:0 0 2px}
.grp{margin-bottom:5px}
.grp h3{font:800 7pt 'IN';letter-spacing:.14em;text-transform:uppercase;color:var(--blue);margin:2px 0 3px}
.kp-prompt{padding:3px 0 4px;border-top:1px solid var(--line)}
.kp-prompt b{font:700 8.3pt 'SG';display:block}
.kp-prompt span{color:var(--ink);font-size:7.7pt;line-height:1.3;display:block}
"""

def _parts_css():
    return "".join(f".p-{k}{{--c:{c}}}" for k, c in COLORS.items())

def _loop_svg():
    return """<svg viewBox="0 0 320 120" role="img" aria-label="You write a prompt, the AI reads it and writes back, you reply to make it better.">
<g font-family="IN" font-size="12">
<rect x="4" y="22" width="88" height="46" rx="10" fill="#fff" stroke="#dfe5f3"/><text x="48" y="42" text-anchor="middle" font-weight="700" fill="#04123a">You</text><text x="48" y="57" text-anchor="middle" fill="#4a5578">write a prompt</text>
<rect x="116" y="16" width="88" height="58" rx="10" fill="#04123a"/><text x="160" y="40" text-anchor="middle" font-weight="700" fill="#fff">The AI</text><text x="160" y="56" text-anchor="middle" fill="#fdc921">reads + writes</text>
<rect x="228" y="22" width="88" height="46" rx="10" fill="#fff" stroke="#dfe5f3"/><text x="272" y="42" text-anchor="middle" font-weight="700" fill="#04123a">Answer</text><text x="272" y="57" text-anchor="middle" fill="#4a5578">you check it</text>
<defs><marker id="k" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0b40e0"/></marker>
<marker id="kg" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="#b8860b"/></marker></defs>
<path d="M92 45H112" stroke="#0b40e0" stroke-width="2" marker-end="url(#k)"/><path d="M204 45H224" stroke="#0b40e0" stroke-width="2" marker-end="url(#k)"/>
<path d="M272 70V100H48V74" fill="none" stroke="#b8860b" stroke-width="2.5" marker-end="url(#kg)"/>
<text x="160" y="114" text-anchor="middle" font-weight="700" fill="#6b4f00">Reply to make it better. Repeat.</text></g></svg>"""

def _footer(left_html, more=False):
    ig, fb, tt, li = FOLLOW["instagram"], FOLLOW["facebook"], FOLLOW["tiktok"], FOLLOW["linkedin"]
    extra = f'<span class="more">Also on TikTok {e(tt["handle"])} · LinkedIn {e(li["handle"])}</span>' if more else ""
    return (f'<footer><span class="url">{left_html}</span><span class="fol">Follow <b>{e(ig["handle"])}</b> on Instagram · '
            f'join the <b>{e(fb["handle"])}</b> Facebook group{extra}</span></footer>')

def kit_html():
    f5 = "".join(f'<div class="p-{p["key"]}"><b>{p["letter"]}</b><strong>{e(p["name"])}</strong><p>{e(p["ask"])}</p></div>' for p in PARTS)
    segs = " ".join(f'<span class="seg p-{p["key"]}">{e(DEMO["parts"][p["key"]])}<i>{e(p["name"])}</i></span>' for p in PARTS)
    rules = "".join(f"<li><div><b>{e(a)}</b><span>{e(b)}</span></div></li>" for a, b in (TEN_THINGS[0], TEN_THINGS[2], TEN_THINGS[1]))
    words = "".join(f'<div class="w"><b>{e(w)}</b><span>{e(d)}</span></div>' for w, d in WORDS_FULL)
    fill = "".join(f'<div class="p-{p["key"]}"><b>{p["letter"]}</b><strong>{e(p["name"])}</strong><i></i></div>' for p in PARTS)
    fus = "".join(f'<span class="kp-fu">{e(x)}</span>' for x in FOLLOW_UPS)
    fix = "".join(f"<div><dt>{e(a)}</dt><dd>{e(b)}</dd></div>" for a, b in FIX_IT)
    never = "".join(f"<li>{e(x)}</li>" for x in NEVER_PASTE)
    save = "".join(f'<p><b>{e(TOOLS[t]["name"])}:</b> {e(TOOLS[t]["save_short"])}</p>' for t in TOOL_ORDER)
    groups = "".join(f'<div class="grp"><h3>{e(g["group"])}</h3>' + "".join(
        f'<div class="kp-prompt"><b>{e(it["title"])}</b><span>{e(it["prompt"])}</span></div>' for it in g["items"][:PICKS]) + "</div>" for g in LIBRARY)
    nxt = f"Next: <b>{e(EVENT['next_title'])}</b>, {e(re.search(r'[A-Z][a-z]+ \d+', EVENT['next_when'].split('·')[0]).group(0))}"
    page = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>AI 101 Prompt Kit — Taylormade Academy</title>
<style>{CSS}{FIT}{_parts_css()}</style></head><body>
<div class="page"><div class="hair"></div>
<header><div><div class="brand"><img src="logo-mark.png" alt="">Taylormade Academy</div><h1>AI 101 <u>Prompt</u> Kit</h1>
<p class="hsub">How to talk to AI, and what all the words mean. Keep this next to your keyboard.</p></div>
<div class="hright"><b>Works in</b>Claude · ChatGPT · Gemini<br>Copilot · any chatbot</div></header>
<main>
<section><h2>The 5-part prompt <small>Use all five and your answers get better right away.</small></h2><div class="f5">{f5}</div>
<div class="ba"><div class="before"><span class="tag">Before</span>“{e(DEMO['bad'])}”<br><br>You get something bland that sounds like everybody else.</div>
<div class="after"><span class="tag">After</span>{segs}</div></div></section>
<section class="mid"><div><h2>3 rules that fix most answers</h2><ol class="rules">{rules}</ol></div>
<div class="loop"><h2>How a chat works</h2>{_loop_svg()}</div></section>
<section><h2>{len(WORDS_FULL)} AI words, in plain English</h2><div class="words">{words}<div class="w save-cell"><b>Save it once</b><span>Save your “About me” so every chat knows you.</span>{save}</div></div></section>
</main>{_footer('taylormade<b>academy</b>.com', more=True)}</div>

<div class="page p2"><div class="hair"></div>
<header class="slim"><div><h1>Use it <u>tonight</u></h1>
<p class="hsub">Fill in your own prompt, steer the answer, and fix what goes wrong.</p></div>
<div class="hright"><b>AI 101</b>{e(EVENT['date_line'])}</div></header>
<main>
<section class="top2"><div><h2>Fill in your prompt</h2><div class="fill">{fill}</div></div>
<div><h2>Say this next</h2><div class="fus">{fus}</div></div></section>
<section class="box"><h2>When something goes wrong</h2><dl class="fix3">{fix}</dl></section>
<section class="never"><h2>Never paste</h2><ul>{never}</ul><p class="slip">{e(NEVER_PASTE_SLIP)}</p>
<p class="ask">At work, ask one question: “Which AI tools can I use, and what can I put in them?”</p></section>
<section class="notes"><h2>Notes</h2><div class="lines"></div></section>
</main>{_footer('Your class page: taylormade<b>academy</b>.com/ai101/class')}</div>

<div class="page p3"><div class="hair"></div>
<header class="slim"><div><h1>Keep <u>going</u></h1>
<p class="hsub">{PICKS * len(LIBRARY)} prompts to try. Swap the [BRACKETS] for your own words. All 30 are on your class page.</p></div>
<div class="hright"><b>AI 101</b>{e(EVENT['date_line'])}</div></header>
<main>
<section class="lib">{groups}</section>
</main>{_footer(nxt)}</div>
</body></html>"""
    return check_public_copy(page)

def main():
    WORK.mkdir(parents=True, exist_ok=True)
    if not (WORK / "fonts").exists():
        shutil.copytree(OLD / "fonts", WORK / "fonts")
    shutil.copy(OLD / "logo-mark.png", WORK / "logo-mark.png")
    (WORK / "kit.html").write_text(kit_html())
    out = WORK / "AI-101-Prompt-Kit.pdf"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=4000",
                    f"--print-to-pdf={out}", (WORK / "kit.html").as_uri()], check=True, capture_output=True, timeout=120)
    pages = len(re.findall(rb"/Type\s*/Page[^s]", out.read_bytes()))
    if pages != PAGES:
        raise SystemExit(f"Prompt Kit printed {pages} pages, not {PAGES} — something overflowed; check {WORK/'kit.html'}")
    shutil.copy(out, ROOT / "ai101/cheat-sheet.pdf")
    PICKUP.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(out, PICKUP)
    print(f"Prompt Kit: {PAGES} pages → ai101/cheat-sheet.pdf and {PICKUP}")

if __name__ == "__main__":
    main()
