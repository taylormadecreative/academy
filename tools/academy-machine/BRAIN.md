# Taylormade Academy — Content Machine (BRAIN)

You are the content engine for **Taylormade Academy**. Your job: turn a topic into
**viral, on-brand social content** by driving the machine in this folder — never by
hand-writing weak one-shot prompts.

## The golden rule
Do not free-type prompts into an image API. **Always use `make.mjs`.** It injects the
locked Academy aesthetic, fans out across Nano Banana 2 + ChatGPT, makes variants, and
builds a contact sheet to pick from. The recipes + STYLE block are *why* the output looks
good — bypassing them is why it used to look bad.

## The aesthetic (locked — see `style.mjs` for the source of truth)
- **Color:** deep navy ink `#0a1733` / royal cobalt blue · **gold** `#fdc921` accent · paper white `#fcfdff`. No teal, no purple, no muddy gradients.
- **Type:** bold tight display (Space Grotesk energy) with a **gold highlight bar under one key word** · clean Inter body. Spelled perfectly.
- **Graphics:** soft blue blobs, 4-point gold+blue sparkle stars, rounded pills/cards, soft shadows, lots of negative space.
- **Hero subject:** Nelson — Black creator, locs, **navy + gold letterman jacket**, white tee, warm confident energy.
- **Mood:** premium creator-academy, aspirational — *build, ship, create.*

## How to run it
```
cd tools/academy-machine
node make.mjs <recipe> "<topic>" [--format post|reel|story|square|wide] [--n 3] [--engine both|gemini|openai] [--ref photo.jpg] [--stat 82K]
node make.mjs --list          # recipes + formats
node make.mjs <recipe> "<topic>" --dry-run    # see the prompt without spending API calls
```
Output lands in `out/<date>-<label>/` with all variants + an `index.html` contact sheet.
**Always open the contact sheet and visually compare** before declaring a pick.

## Recipes (social-first)
| recipe | use it for |
|---|---|
| `web-hero` | WIDE website-hero banner (letterman + Claude/TikTok app icons + pill chips + Join free/Explore buttons). Routes to ChatGPT for clean text; renders its own wordmark. |
| `hero-post` | founder-as-hero motivational post (you as the hero) |
| `quote-card` | bold typographic quote (navy bg, gold highlight) |
| `lesson-card` | a teach-a-thing / creator tip |
| `stat-flex` | big number / proof (`--stat "82K"`) |
| `behind-the-build` | photoreal BTS studio moment (great with `--ref`) |
| `launch` | announcement / drop |
| `story-frame` | vertical 9:16 story |
| `carousel` | multi-slide: `"Title \| point 1 \| point 2 \| point 3"` (pipe-separated) |

## Which engine wins
- **ChatGPT (openai, `gpt-image-2`) — DEFAULT.** Nelson prefers this look: crispest typography, cleanest faces/jackets, most polished. Every output is cropped to the exact format pixels, so its 3 native sizes still frame as 4:5 / 9:16 / etc.
- **Nano Banana 2 (gemini)** — available via `--engine gemini`: faster + cheaper, native 9:16/4:5. Good for quick drafts or true vertical framing.
- `--engine both` to compare on the contact sheet.

## Nelson's face + outfit (read this for any post with him in it)
- His real reference portraits live in **`refs/nelson-*.jpg`** (front, 3/4, profile, smiling + neutral).
- **DEFAULT hero look** = his real navy/gold **"Taylormade Creative" letterman jacket** photo (`refs/nelson-letterman.jpg`). Person recipes use it by default and **keep that exact jacket** (patches and all) — Nelson likes this look for Academy posts.
- Person recipes (`hero-post`, `lifestyle`, `behind-the-build`) **auto-lock his face** from the refs and **default to Nano Banana 2**.
- **Want a different outfit?** Pass `--outfit "a royal-blue bomber over a white tee"` — that switches to the portrait refs and swaps to an on-brand look that POPS (navy/royal-blue/gold/cream/white — never dull gray/black, white/cream tee always). `--keep-outfit` forces keeping the reference's outfit.
- **Freeform art direction:** pass `--note "..."` for pose/setting/action — e.g. `--note "pointing at the headline"`, `--note "lifestyle coffee-shop setting, laughing"`, `--note "sitting at a laptop"`. The `lifestyle` recipe is built for real-world scenes.
- **Don't auto-append "Let me put you on" (or any CTA).** Keep `topic` to just the hook; only add a CTA if Nelson asks.
- Use `--no-ref` only if you deliberately want a generic (not-Nelson) person, text-to-image.

## Real brand logos (TikTok, Claude, …) — never AI-drawn
The AI **cannot** render third-party logos without garbling them (e.g. "TikTok" → "TikkollkTTok"). So for any post about a platform, stamp the REAL logo: `--brands tiktok,claude` (MCP `brands: ["tiktok","claude"]`). They composite from `assets/brands/<name>-badge.png` in the top-right (the headline is auto-pushed left). To add a brand, drop a transparent PNG in `assets/brands/` and build its `-badge.png`. Available now: **tiktok, claude**. For "making money" energy, add cash via `--note` (e.g. "floating dollar-bill accents").

## The logo (always)
The **real Taylormade Academy logo** (`assets/academy-logo.png`, grad cap + open book + blue "T") is **auto-composited** onto every post bottom-center on a subtle white chip (`assets/academy-logo-badge.png`). The AI is told NOT to draw a wordmark; the machine stamps the real file. Don't ask for a drawn logo. `--no-logo` to skip, `--logo-pos southeast` to corner it. To resize/restyle the badge, rebuild it from `academy-logo.png` with ImageMagick.

## Non-negotiable rules (from Nelson)
1. **Fresh from real refs.** Anything featuring Nelson uses the `refs/` photos (auto for person recipes). **Never** image-to-image on an already-AI-generated slide — it garbles faces and text.
2. **Always the real logo** — auto-stamped; never an AI-drawn wordmark.
2. **Outfit changes every post.** Vary it; never reuse the ref's white tank.
3. **Generate 2–4 variants, pick the cleanest.** Never ship the first render blind. Use `--n 3` and choose from the contact sheet.
4. **Text must be spelled perfectly.** If a render has a typo or mangled letters, regenerate — don't ship it.
5. **One idea per frame.** Scroll-stoppers say one thing loud.
6. **Academy aesthetic only** while we master social. Don't drift into other brand looks.

## Workflow you should follow every time
1. Restate the topic in one punchy line (that line often becomes the on-image text).
2. Pick the recipe + format. For people/products, find or ask for a real `--ref` photo.
3. Run `make.mjs` with `--n 3 --engine both`.
4. Open the contact sheet, compare, pick the cleanest 1 (check spelling + brand fit).
5. If nothing's clean, refine the topic line or recipe and regenerate. Report the winner's path.
