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

# Profiles the Academy itself owns (the Organization) vs Nelson's own (the Person). Keeping them
# apart stops engines merging the Academy with Taylormade Creative or with other "Taylormade"s.
ORG_SAME_AS = ["https://www.facebook.com/groups/taylormadeacademy"]
NELSON_SAME_AS = [
    "https://instagram.com/taylormade_creative",
    "https://tiktok.com/@taylormadecreative",
    "https://linkedin.com/in/taylormademd",
    "https://taylormadecreative.net",
]
AUC = "Atlanta University Center (AUC) Data Science Initiative"
AUDIENCE = {"@type": "Audience", "audienceType": "Beginners, small business owners and creatives"}
CITY = {"@type": "PostalAddress", "addressLocality": "Dallas", "addressRegion": "TX", "addressCountry": "US"}

DFW = {"@type": "Place", "name": "Dallas-Fort Worth, Texas"}

# The studio: the city is public, the street address is not.
STUDIO = {
    "@type": "Place",
    "name": "Taylormade Academy studio, Dallas",
    "address": CITY,
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
        "disambiguatingDescription": "An AI and creative-skills school in Dallas-Fort Worth, Texas, founded by Nelson Taylor.",
        "address": CITY,
        "founder": {"@id": NELSON_ID},
        "parentOrganization": {"@type": "Organization", "name": "Taylormade Creative", "url": "https://taylormadecreative.net"},
        "areaServed": [DFW, {"@type": "Country", "name": "United States"}],
        "knowsAbout": ["Artificial intelligence", "AI agents", "Prompt writing", "ChatGPT", "Claude",
                       "Graphic design", "Photography", "Video production", "Content creation"],
        "email": "taylormademd@gmail.com",
        "sameAs": ORG_SAME_AS,
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
                        f"video, and AI. Taught Build Your First AI Agent to about 50 HBCU students with the {AUC} "
                        "and Johns Hopkins."),
        "worksFor": {"@id": ORG_ID},
        "homeLocation": DFW,
        "knowsAbout": ["AI agents", "Prompt writing", "Graphic design", "Photography", "Video production"],
        "sameAs": NELSON_SAME_AS,
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
def event(w, with_offers=True):
    """w: a workshop dict from build_workshops.WORKSHOPS. with_offers=False leaves the prices to the
    workshop's own page (the /workshops/ hub shows no prices, so its schema carries none either)."""
    online = {"@type": "VirtualLocation", "url": w["url"] if w["url"].startswith("http") else DOMAIN + w["url"]}
    if w["mode"] == "mixed":
        # the physical place first: it is the part search engines can list
        mode, loc = "MixedEventAttendanceMode", [STUDIO, online]
    elif w["mode"] == "online":
        mode, loc = "OnlineEventAttendanceMode", online
    else:
        mode, loc = "OfflineEventAttendanceMode", w.get("place", STUDIO)
    page = w["url"] if w["url"].startswith("http") else DOMAIN + w["url"]
    offers = []
    for o in (w.get("offers", []) if with_offers else []):
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
        # an event sold elsewhere (Eventbrite) still gets an id in our own namespace
        "@id": (DOMAIN + "/workshops/#" + w["slug"]) if w["url"].startswith("http") else page + "#event",
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
        "audience": AUDIENCE,
        "teaches": w.get("teaches"),
        "organizer": {"@type": "Organization", "@id": ORG_ID, "name": "Taylormade Academy", "url": DOMAIN + "/"},
        "performer": {"@type": "Person", "@id": NELSON_ID, "name": "Nelson Taylor"},
    }
    if offers:
        ev["offers"] = offers
    if w.get("capacity"):
        ev["maximumAttendeeCapacity"] = w["capacity"]
    return {k: v for k, v in ev.items() if v is not None}



def profile_page():
    return {"@type": "ProfilePage", "url": DOMAIN + "/about/", "mainEntity": nelson()}


def glossary(words, page):
    return {"@type": "DefinedTermSet", "@id": DOMAIN + page + "#words", "name": "AI words, in plain English",
            "hasDefinedTerm": [{"@type": "DefinedTerm", "name": text(w), "description": text(d),
                                "inDefinedTermSet": DOMAIN + page + "#words"} for w, d in words]}
