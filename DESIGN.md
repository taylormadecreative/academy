# Taylormade Academy — Design System (v4 "Varsity Modern")

The bar: it should read like a multi-million-dollar product site — Apple-calm,
confident, warm. Big type, generous air, one accent, buttery micro-interactions.

## Palette (locked to the crest — do not swap hues)
- Paper `#fcfdff` page, `#ffffff` cards, `#f6f8fc` soft panels
- Ink navy `#0a1733` headings, `#33415b` body, `#64748b` muted
- Crest navy `#04123a` — full-bleed anchor bands (drenched sections)
- Royal blue `#0b40e0` — THE accent. Buttons, links, active states. ≤10% of any light section.
- Gold `#fdc921` — signature only: kicker dash, one highlighted word (`.u-gold`),
  membership badge, tiny details on navy. Never large fills on white.
- Hairline `#e4e9f1`. No pure #000/#fff feel: everything navy-tinted.

## Type
- Display: Space Grotesk 600/700, tracking −.03em. Hero clamp(42px→84px),
  section clamp(30px→52px). Headlines are the design; let them be big and calm.
- Body/UI: Inter 400–700, 16–17px, line-height 1.6, 65ch cap.
- Eyebrow/kicker: 12.5px caps + 18px gold dash. Mono only for tiny footer sigils.

## Shape + depth
- Radius: 12 (small) / 18 (cards) / 24 (panels) / pill 980px (buttons, chips).
- Borders 1px hairline. Shadows are diffusion, navy-tinted, never harsh:
  `0 20px 40px -18px rgba(4,18,58,.18)` cards, larger for floating panels.
- Cards only where elevation means something; sections separate by space + bands.

## Motion (emil rules)
- `--ease-out: cubic-bezier(.23,1,.32,1)`; UI transitions 150–250ms; nothing over 500ms.
- Buttons: scale(.97) on :active, 160ms. Hover lifts ≤3px.
- Reveals: opacity + 14px rise, staggered 60ms via `[data-stag]`. Reduced-motion honored.
- Never animate layout properties; transform/opacity only.

## Section rhythm (brand pages)
white hero → navy drenched showcase → white pricing → soft ebooks → white receipts
→ navy CTA. Padding clamp(72px→128px). Inner copy blocks use `.narrow` (≤820px)
even when the shell is wide.

## Signature element
"Inside the Academy" — a hand-built, honest mock of the real platform UI (feed
post, DM, dashboard chips, ebook reader) floating in a navy band with layered
depth. It is the product shot; it sells the membership.

## Never
Rainbow icon rows, three-equal-card feature grids, gradient text, side-stripe
borders, glassmorphism decor, fake numbers, em dashes in copy, emoji in UI.
