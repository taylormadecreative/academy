#!/usr/bin/env python3
"""Build a branded Taylormade Academy ebook (HTML -> Chrome prints to PDF) from a JSON spec.
Usage: python3 build_ebook.py <data.json> <out.html>

data.json schema:
{
  "kicker": "Free starter guide",
  "title_html": "BUILD YOUR<br>FIRST <span class='blue'>AI AGENT</span>",
  "subtitle": "...",
  "cover_ill": "assets/ill-ai-agent.png",   # relative to repo root
  "run_title": "BUILD YOUR FIRST AI AGENT",  # footer running title
  "intro": {"heading": "...", "dek": "...", "body_html": "...", "callout": "..."},
  "chapters": [ {"n":1,"heading":"...","dek":"...","body_html":"...","callout":"...","graphic_html":"<...>"} ],
  "cta": {"heading":"...","body_html":"...","signoff":"John Doe"}
}
graphic_html is optional per chapter (a diagram/illustration block).
"""
import json, sys, pathlib

CSS = """
:root{--navy:#04123a;--blue:#0b40e0;--blue-2:#3a63f0;--gold:#fdc921;--gold-deep:#f2b705;
  --ink:#0a1733;--ink-2:#33415b;--muted:#64748b;--hair:#e4e9f1;--bg-soft:#f6f8fc;
  --font:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--display:'Space Grotesk','Inter',sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{font-family:var(--font);color:var(--ink-2);line-height:1.7;font-size:12.5pt;}
@page{size:Letter;margin:0;}
.page{width:8.5in;min-height:11in;padding:0.66in 0.82in 0.75in;position:relative;page-break-after:always;background:#fff;}
.page:last-child{page-break-after:auto;}
.page.cover{height:11in;min-height:0;overflow:hidden;padding:0.7in 0.8in;}
h1,h2,h3,.display{font-family:var(--display);color:var(--ink);letter-spacing:-.02em;line-height:1.08;font-weight:700;}
h2{font-size:25pt;margin-bottom:4pt;}
h3{font-size:14pt;margin:13pt 0 4pt;}
p{margin-bottom:11pt;max-width:60ch;}
.blue{color:var(--blue);}.gold{color:var(--gold-deep);}
.kicker{font-family:var(--font);font-size:8.5pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--blue);display:flex;align-items:center;gap:9px;margin-bottom:10pt;}
.kicker::before{content:"";width:20px;height:3px;border-radius:2px;background:var(--gold-deep);}
.dek{font-size:13pt;color:var(--ink-2);margin:2pt 0 0;font-weight:600;}
.divider{height:3px;width:52px;border-radius:3px;background:linear-gradient(90deg,var(--gold),var(--gold-deep));margin:9pt 0 11pt;}
.lead{font-size:13.5pt;color:var(--ink-2);line-height:1.55;}
.pagenum{position:absolute;bottom:0.42in;right:0.8in;font-size:8.5pt;color:var(--muted);font-weight:600;}
.foot-brand{position:absolute;bottom:0.42in;left:0.8in;font-size:8.5pt;color:var(--muted);font-weight:600;}
ul.flist{list-style:none;margin:4pt 0 9pt;}
ul.flist li{margin-bottom:7pt;padding-left:22px;position:relative;font-size:11.8pt;}
ul.flist li::before{content:"";position:absolute;left:0;top:6px;width:8px;height:8px;border-radius:50%;background:var(--gold-deep);}
ol.steps{list-style:none;margin:6pt 0 9pt;counter-reset:s;}
ol.steps li{display:flex;gap:12px;margin-bottom:9pt;align-items:flex-start;}
ol.steps .snum{flex:0 0 auto;width:25px;height:25px;border-radius:50%;background:var(--blue);color:#fff;font-family:var(--display);font-weight:700;font-size:10.5pt;display:flex;align-items:center;justify-content:center;margin-top:1px;}
ol.steps li div{font-size:11.8pt;line-height:1.55;}
strong{color:var(--ink);font-weight:700;}
.callout{background:var(--navy);color:#cdd8f0;border-radius:14px;padding:15px 19px;margin-top:13pt;font-size:11.5pt;line-height:1.55;break-inside:avoid;}
ol.steps li,ul.flist li,.three,.flow{break-inside:avoid;}
.callout strong{color:#fff;}
.callout .lbl{display:block;font-family:var(--display);font-weight:700;color:var(--gold);font-size:9pt;letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px;}
/* cover */
.cover{background:linear-gradient(180deg,#04102e,#020a1f);color:#fff;display:flex;flex-direction:column;}
.cover .brand{display:flex;align-items:center;gap:11px;}
.cover .brand img{width:42px;height:42px;}
.cover .brand span{font-family:var(--display);font-weight:700;font-size:16px;letter-spacing:.04em;color:#fff;}
.cover .ck{margin-top:30pt;font-size:9pt;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);}
.cover h1{font-family:var(--display);font-weight:700;font-size:50pt;line-height:.96;letter-spacing:-.03em;color:#fff;margin-top:10pt;}
.cover h1 .blue{color:#5b8bff;}.cover h1 .gold{color:var(--gold);}
.cover .sub{font-size:14pt;font-weight:600;color:#c7d4f5;margin-top:16pt;max-width:30ch;line-height:1.4;}
.cover .ci{position:absolute;right:-0.3in;bottom:1.3in;width:3.7in;}
.cover .auth{position:absolute;left:0.8in;bottom:0.9in;}
.cover .auth .n{font-family:var(--display);font-weight:700;font-size:15pt;letter-spacing:.12em;color:#fff;}
.cover .auth .p{font-size:9pt;color:#aebbd8;font-weight:600;margin-top:2px;}
/* graphic blocks */
.gfx{margin:8pt 0 4pt;}
.gfx img{width:100%;border-radius:12px;}
.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin:8pt 0;}
.three .c{background:var(--bg-soft);border:1px solid var(--hair);border-radius:12px;padding:12px 13px;}
.three .c .ic{width:30px;height:30px;border-radius:9px;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:700;margin-bottom:7px;}
.three .c h4{font-family:var(--display);font-size:11pt;color:var(--ink);margin-bottom:3px;}
.three .c p{font-size:9pt;margin:0;color:var(--ink-2);}
.flow{display:flex;align-items:center;gap:8px;margin:9pt 0;flex-wrap:wrap;}
.flow .node{flex:1;min-width:90px;background:var(--bg-soft);border:1px solid var(--hair);border-radius:11px;padding:11px 10px;text-align:center;}
.flow .node .t{font-family:var(--display);font-weight:700;font-size:10.5pt;color:var(--ink);}
.flow .node .s{font-size:8.5pt;color:var(--muted);margin-top:2px;}
.flow .arrow{color:var(--gold-deep);font-weight:800;font-size:15pt;}
"""

def page(inner, cls=""):
    return f'<section class="page {cls}">{inner}</section>'

def chapter_page(c, run_title):
    g = c.get("graphic_html", "")
    callout = ""
    if c.get("callout"):
        callout = f'<div class="callout"><span class="lbl">Remember</span>{c["callout"]}</div>'
    return page(
        f'<div class="kicker">Chapter {c["n"]}</div>'
        f'<h2>{c["heading"]}</h2>'
        + (f'<div class="dek">{c["dek"]}</div>' if c.get("dek") else "")
        + '<div class="divider"></div>'
        + (f'<div class="gfx">{g}</div>' if g else "")
        + c["body_html"]
        + callout
        + f'<div class="foot-brand">{run_title}</div><div class="pagenum">{c["n"]+2}</div>'
    )

def build(d):
    pages = []
    # cover
    pages.append(page(
        f'<div class="brand"><img src="../{("../" if False else "")}../assets/logo-mark.png"><span>TAYLORMADE ACADEMY</span></div>'
        .replace("../../assets", "../../assets")
        + f'<div class="ck">{d["kicker"]}</div>'
        + f'<h1>{d["title_html"]}</h1>'
        + f'<div class="sub">{d["subtitle"]}</div>'
        + f'<img class="ci" src="../../{d["cover_ill"]}">'
        + '<div class="auth"><div class="n">NELSON TAYLOR</div><div class="p">academy.taylormadecreative.net</div></div>',
        "cover"))
    # intro
    intro = d["intro"]
    pages.append(page(
        f'<div class="kicker">Start here</div><h2>{intro["heading"]}</h2>'
        + (f'<div class="dek">{intro["dek"]}</div>' if intro.get("dek") else "")
        + '<div class="divider"></div>' + intro["body_html"]
        + (f'<div class="callout"><span class="lbl">The promise</span>{intro["callout"]}</div>' if intro.get("callout") else "")
        + f'<div class="foot-brand">{d["run_title"]}</div><div class="pagenum">2</div>'))
    # chapters
    for c in d["chapters"]:
        pages.append(chapter_page(c, d["run_title"]))
    # cta
    cta = d["cta"]
    n = len(d["chapters"]) + 3
    pages.append(page(
        f'<div class="kicker">Your next move</div><h2>{cta["heading"]}</h2><div class="divider"></div>'
        + cta["body_html"]
        + '<div style="position:absolute;left:0.8in;bottom:0.8in;display:flex;align-items:center;gap:10px">'
          '<img src="../../assets/logo-mark.png" width="32" height="32"><span style="font-family:var(--display);font-weight:600;color:var(--ink);font-size:12pt">Taylormade Academy</span></div>'
        + f'<div class="pagenum">{n}</div>'))
    html = (f'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>{d["run_title"]}</title>'
            '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">'
            f'<style>{CSS}</style></head><body>{"".join(pages)}</body></html>')
    return html

if __name__ == "__main__":
    data = json.loads(pathlib.Path(sys.argv[1]).read_text())
    pathlib.Path(sys.argv[2]).write_text(build(data))
    print("built", sys.argv[2], "with", len(data["chapters"]), "chapters")
