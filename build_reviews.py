"""A strip of APPROVED workshop reviews, filled in the browser by js/reviews.js from ea_reviews_public (0059).
It ships hidden and shows only once there is at least one approved review, so an empty strip never appears.
Used on the home page, /ai101/ and /agent/ (Nelson 10/6). The verified tag's words come from the course module."""
import html
from ai101_course import EVENT

def reviews_section(slug, heading, label, ver):
    e = html.escape
    return (f'<section class="rv" data-reviews="{e(slug)}" data-label="{e(label)}" data-verified="{e(EVENT["verified_tag"])}" hidden '
            f'aria-labelledby="rv-{e(slug)}-h"><div class="wrap"><span class="kicker gold">Reviews</span>'
            f'<h2 class="display-m" id="rv-{e(slug)}-h">{e(heading)}</h2>'
            f'<p class="rv-avg" hidden></p><div class="rv-list"></div></div></section>'
            f'<script src="/js/reviews.js?v={ver}" defer></script>')
