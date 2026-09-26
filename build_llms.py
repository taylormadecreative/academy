"""llms.txt — the plain-text briefing an AI assistant reads to answer questions about the Academy.

Format per llmstxt.org: one H1, a one-paragraph summary, then link lists. Built from the same
workshop list as /workshops/ so the dates never drift. Facts only: nothing here that the public
pages do not already say.
"""
from build_workshops import WORKSHOPS, PAST, EVENTBRITE_CCW

DOMAIN = "https://taylormadeacademy.com"


def _abs(u):
    return u if u.startswith("http") else DOMAIN + u


def llms_txt():
    upcoming = "\n".join(
        f"- [{w['title']}]({_abs(w['url'])}): {w['when']}. {w['where']}.{' Free.' if w.get('free') else ''} {w['schema_desc']}"
        for w in sorted(WORKSHOPS, key=lambda w: w["start"]))
    past = "\n".join(f"- {d}: {t}. {p}" for d, t, p in PAST)
    return f"""# Taylormade Academy

> Taylormade Academy is a Dallas-Fort Worth school and online community, founded by Nelson Taylor, that teaches AI, graphic design, photography, and video to beginners through live workshops, video courses, and plain-English ebooks. Workshops are open to everyone, no membership needed, and run online and in a studio in Dallas. Joining the community is free; a $15/month membership unlocks every course and ebook.

Key facts:
- Founder and instructor: Nelson Taylor, a working creative in Dallas-Fort Worth for 14 years (design, photography, video, AI).
- In June 2026 he taught "Build Your First AI Agent" over three nights to about 50 HBCU students with the AUC Data Science Initiative and Johns Hopkins.
- The workshops need no code and no AI experience. The AI tools used are ChatGPT and Claude, on free accounts.
- Online classes run in the Taylormade Academy live room in the browser, not Zoom.
- Teams, schools, and programs can book any workshop privately, or run a whole cohort on the Academy.
- Contact: taylormademd@gmail.com

## Upcoming workshops

- [All workshops]({DOMAIN}/workshops/): every upcoming date in one place.
{upcoming}

## Workshops already taught

{past}

## Learn

- [AI 101: what is a prompt, and six AI words in plain English]({DOMAIN}/ai101/)
- [What is an AI agent?]({DOMAIN}/agent/): an AI helper you set up once that does a task for you every time after that. You describe the job in plain English; it reads, decides, and acts.
- [Ebooks and playbooks]({DOMAIN}/store/): short, no-code guides, including Build Your First AI Agent and The AI Money Machine.
- [Membership and pricing]({DOMAIN}/pricing/)
- [The community]({DOMAIN}/join/): free to join.

## About

- [About Nelson Taylor]({DOMAIN}/about/)
- [Programs for schools, cohorts, and campuses]({DOMAIN}/partners/)
- [Content Creator Workshop tickets on Eventbrite]({EVENTBRITE_CCW})
- [Refund policy]({DOMAIN}/refunds/)
"""
