"""Search + answer-engine layer for the generated pages: schema.org JSON-LD, llms.txt.

Everything a crawler or an AI assistant reads about the Academy as *data* lives here, so the
facts stay in one place. Pages call ld(...) for the <script type="application/ld+json"> blocks
and inject() puts them in <head>. The workshop dates come from build_agent.py, build_ai101.py
and build_workshops.py (the same constants the page copy uses), so a date change in one of
those files moves the schema with it on the next build.

Rules: only facts that are true and public. No studio street address (the ticket email has it).
No numbers the pages do not already say.
"""
import html as _html
import json
import re

DOMAIN = "https://taylormadeacademy.com"
ORG_ID = DOMAIN + "/#org"
SITE_ID = DOMAIN + "/#website"
NELSON_ID = DOMAIN + "/about/#nelson"

SAME_AS = [
    "https://instagram.com/taylormade_creative",
    "https://tiktok.com/@taylormadecreative",
    "https://linkedin.com/in/taylormademd",
    "https://www.facebook.com/groups/taylormadeacademy",
]

DFW = {"@type": "Place", "name": "Dallas-Fort Worth, Texas"}

# The studio: the city is public, the street address is not.
STUDIO = {
    "@type": "Place",
    "name": "Taylormade Academy studio, Dallas",
    "address": {"@type": "PostalAddress", "addressLocality": "Dallas", "addressRegion": "TX", "addressCountry": "US"},
}


def ld(*objs):
    """One <script> per object, compact, and safe to drop inside <head>."""
    out = []
    for o in objs:
        if not o:
            continue
        o = {"@context": "https://schema.org", **o}
        s = json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        out.append(f'<script type="application/ld+json">{s}</script>')
    return "\n".join(out)


def inject(page_html, *objs):
    block = ld(*objs)
    return page_html.replace("</head>", block + "\n</head>", 1) if block else page_html


def text(s):
    """HTML fragment -> plain sentence for schema text fields."""
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", _html.unescape(s)).strip()


# ---------- the site, the school, the teacher ----------
def organization():
    return {
        "@type": ["EducationalOrganization", "Organization"],
        "@id": ORG_ID,
        "name": "Taylormade Academy",
        "alternateName": "Taylormade Academy by Taylormade Creative",
        "url": DOMAIN + "/",
        "logo": {"@type": "ImageObject", "url": DOMAIN + "/assets/logo-full.png"},
        "image": DOMAIN + "/assets/og-image.png",
        "description": ("Taylormade Academy is a Dallas-Fort Worth school and online community, founded by "
                        "Nelson Taylor, that teaches AI, graphic design, photography, and video to beginners "
                        "through live workshops, video courses, and plain-English ebooks."),
        "founder": {"@id": NELSON_ID},
        "parentOrganization": {"@type": "Organization", "name": "Taylormade Creative", "url": "https://taylormadecreative.net"},
        "areaServed": [DFW, {"@type": "Country", "name": "United States"}],
        "knowsAbout": ["Artificial intelligence", "AI agents", "Prompt writing", "ChatGPT", "Claude",
                       "Graphic design", "Photography", "Video production", "Content creation"],
        "email": "taylormademd@gmail.com",
        "sameAs": SAME_AS,
    }


def website():
    return {"@type": "WebSite", "@id": SITE_ID, "name": "Taylormade Academy", "url": DOMAIN + "/",
            "publisher": {"@id": ORG_ID}, "inLanguage": "en-US"}


def nelson():
    return {
        "@type": "Person",
        "@id": NELSON_ID,
        "name": "Nelson Taylor",
        "jobTitle": "Founder and instructor, Taylormade Academy",
        "url": DOMAIN + "/about/",
        "image": DOMAIN + "/assets/hero-nelson.png",
        "description": ("Dallas-Fort Worth creative with 14 years of client work in graphic design, photography, "
                        "video, and AI. Taught Build Your First AI Agent to about 50 HBCU students with the AUC "
                        "Data Science Initiative and Johns Hopkins."),
        "worksFor": {"@id": ORG_ID},
        "homeLocation": DFW,
        "knowsAbout": ["AI agents", "Prompt writing", "Graphic design", "Photography", "Video production"],
        "sameAs": SAME_AS[:3] + ["https://taylormadecreative.net"],
    }


def breadcrumbs(*trail):
    """breadcrumbs(("Workshops", "/workshops/"), ("AI 101", "/ai101/"))"""
    items = [("Home", "/")] + list(trail)
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": DOMAIN + p} for i, (n, p) in enumerate(items)]}


def faq_from_html(page_html):
    """FAQPage built from the page's own <details><summary> blocks, so the schema can never
    say something the page does not. Returns None when the page has no FAQ."""
    pairs = re.findall(r"<details><summary>(.*?)</summary>\s*<(?:p|div)[^>]*>(.*?)</(?:p|div)>\s*</details>", page_html, flags=re.S)
    if not pairs:
        return None
    return {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": text(q), "acceptedAnswer": {"@type": "Answer", "text": text(a)}}
        for q, a in pairs]}


# ---------- events ----------
def event(w):
    """w: a workshop dict from build_workshops.WORKSHOPS."""
    online = {"@type": "VirtualLocation", "url": w["url"] if w["url"].startswith("http") else DOMAIN + w["url"]}
    if w["mode"] == "mixed":
        mode, loc = "MixedEventAttendanceMode", [online, STUDIO]
    elif w["mode"] == "online":
        mode, loc = "OnlineEventAttendanceMode", online
    else:
        mode, loc = "OfflineEventAttendanceMode", w.get("place", STUDIO)
    page = w["url"] if w["url"].startswith("http") else DOMAIN + w["url"]
    offers = []
    for o in w.get("offers", []):
        off = {"@type": "Offer", "name": o["name"], "url": o.get("url", page), "priceCurrency": "USD",
               "availability": "https://schema.org/InStock"}
        if "price" in o:
            off["price"] = str(o["price"])
        for k in ("validFrom", "validThrough"):
            if o.get(k):
                off[k] = o[k]
        offers.append(off)
    ev = {
        "@type": "EducationEvent",
        "@id": page + "#event",
        "name": w["title"],
        "description": w["schema_desc"],
        "startDate": w["start"],
        "endDate": w["end"],
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/" + mode,
        "location": loc,
        "image": [DOMAIN + "/" + w["og"]],
        "url": page,
        "inLanguage": "en-US",
        "isAccessibleForFree": bool(w.get("free")),
        "educationalLevel": "Beginner",
        "teaches": w.get("teaches"),
        "organizer": {"@type": "Organization", "@id": ORG_ID, "name": "Taylormade Academy", "url": DOMAIN + "/"},
        "performer": {"@type": "Person", "@id": NELSON_ID, "name": "Nelson Taylor"},
    }
    if offers:
        ev["offers"] = offers
    if w.get("capacity"):
        ev["maximumAttendeeCapacity"] = w["capacity"]
    return {k: v for k, v in ev.items() if v is not None}


def course(w):
    """Course + its instances, for course listings. Only for workshops that teach a skill end to end."""
    page = DOMAIN + w["url"]
    inst = []
    for m in (["Online", "Onsite"] if w["mode"] == "mixed" else ["Online" if w["mode"] == "online" else "Onsite"]):
        ci = {"@type": "CourseInstance", "courseMode": m, "startDate": w["start"], "endDate": w["end"],
              "courseWorkload": w["workload"], "instructor": {"@id": NELSON_ID, "@type": "Person", "name": "Nelson Taylor"}}
        ci["location"] = STUDIO if m == "Onsite" else {"@type": "VirtualLocation", "url": page}
        inst.append(ci)
    c = {
        "@type": "Course",
        "@id": page + "#course",
        "name": w["title"],
        "description": w["schema_desc"],
        "url": page,
        "provider": {"@type": "Organization", "@id": ORG_ID, "name": "Taylormade Academy", "sameAs": DOMAIN + "/"},
        "educationalLevel": "Beginner",
        "teaches": w.get("teaches"),
        "inLanguage": "en-US",
        "isAccessibleForFree": bool(w.get("free")),
        "hasCourseInstance": inst,
        "image": DOMAIN + "/" + w["og"],
    }
    if w.get("offers"):
        low = min(o["price"] for o in w["offers"] if "price" in o)
        c["offers"] = {"@type": "Offer", "category": "Free" if low == 0 else "Paid", "price": str(low),
                       "priceCurrency": "USD", "url": page, "availability": "https://schema.org/InStock"}
    return c


def glossary(words, page):
    return {"@type": "DefinedTermSet", "@id": DOMAIN + page + "#words", "name": "AI words, in plain English",
            "hasDefinedTerm": [{"@type": "DefinedTerm", "name": text(w), "description": text(d),
                                "inDefinedTermSet": DOMAIN + page + "#words"} for w, d in words]}
