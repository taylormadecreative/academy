# Academy Content Machine

Viral, on-brand **Taylormade Academy** social content from one command. Wraps your
Nano Banana 2 (Gemini) + ChatGPT image APIs, locks the Academy aesthetic, makes
variants, and builds a contact sheet so you pick the cleanest.

> Driving it from Claude Desktop? It reads `BRAIN.md` — that's the operator's manual.

## Run
```bash
cd tools/academy-machine
node make.mjs --list                 # recipes + formats

# a quote card, 3 variants per engine, both engines
node make.mjs quote-card "Start before you feel ready" --n 3

# a 9:16 story
node make.mjs story-frame "The skill that pays you forever" --format reel

# a 4-slide carousel (pipe-separated points)
node make.mjs carousel "3 AI tools I use daily | ChatGPT for scripts | Nano Banana for images | Claude for everything"

# you as the hero — face auto-locked from refs/nelson-*.jpg, outfit auto-varies
node make.mjs hero-post "You don't need a big team to start"

# control the outfit for a specific post (never the ref's white tank)
node make.mjs hero-post "Ship it ugly" --outfit "a charcoal bomber jacket over a black tee"

# preview the prompt without spending API calls
node make.mjs quote-card "Test line" --dry-run
```

Output → `out/<date>-<label>/` with every variant + `index.html`. Open it:
```bash
open out/<date>-<label>/index.html
```

## Recipes
`web-hero` (wide website-hero banner — Claude/TikTok icons, chips, CTAs; routes to ChatGPT) ·
`hero-post` · `lifestyle` (founder in a real-world scene) · `quote-card` · `lesson-card` ·
`stat-flex` (`--stat 82K`) · `behind-the-build` · `launch` · `story-frame` · `carousel`

## Art direction (`--note`)
Steer pose, setting, action, mood: `--note "pointing at the headline"`,
`--note "lifestyle coffee-shop, laughing"`, `--note "sitting at a laptop in the studio"`.

## Real brand logos (`--brands`)
Stamp REAL third-party logos (the AI garbles them otherwise): `--brands tiktok,claude`.
They composite from `assets/brands/<name>-badge.png` top-right. Add a brand by dropping a
transparent PNG into `assets/brands/` and building a white-chip `-badge.png` for it.
Available: **tiktok, claude**.

## Formats & any custom size
Named: `post` 4:5 · `reel`/`story` 9:16 · `square` 1:1 · `wide` 16:9.
**Any exact size:** `--size 1200x628` (or 1080x1080, 1080x1920, 2000x500 …). It generates at
the closest ratio the engine supports, then crops/scales to your exact pixels.

## Options
`--format` · `--engine both|gemini|openai` · `--n <k>` · `--slides <n>` ·
`--size <WxH>` · `--ref <photo>` (repeatable) · `--no-ref` · `--keep-outfit` ·
`--outfit "<desc>"` · `--note "<desc>"` · `--brands a,b` · `--no-logo` · `--logo-pos <p>` ·
`--stat <v>` · `--label <slug>` · `--out <dir>` · `--dry-run` · `--list`

## You as the hero
`hero-post` and `behind-the-build` auto-lock your face from `refs/nelson-*.jpg` and
default to Nano Banana 2 (keeps the face, swaps the outfit). The **outfit changes every
post** (auto-varies by topic; never the ref's white tank). Steer it with `--outfit`.

## The logo (always)
The real academy logo (`assets/academy-logo.png`) is **auto-composited** bottom-center on
every post via ImageMagick — a full-color logo on a subtle white chip
(`assets/academy-logo-badge.png`) that reads on light or dark backgrounds. The AI is
blocked from drawing a fake wordmark. `--no-logo` to skip, `--logo-pos southeast|southwest`
to corner it. Rebuild the badge from the logo with ImageMagick if you want it bigger/smaller.

## Use in ANY Claude Desktop chat (MCP)
`mcp-server.mjs` exposes the machine to Claude Desktop as tools, so you can type
"make an academy quote card: …" in **any chat** and the images come back inline.

- Registered in `~/Library/Application Support/Claude/claude_desktop_config.json`
  under `mcpServers → academy-content-machine` (command = node, args = this server).
- **Fully quit and reopen Claude Desktop** to load it. You'll then see two tools:
  `generate_academy_content` and `list_academy_recipes`.
- Returns small JPEG **thumbnails inline** (Desktop rejects full-res payloads) and
  **auto-opens the full-res contact sheet on your screen** to pick from. Full-res
  images always save to `out/`.
- Smoke-test it anytime: `node test-mcp.mjs` (spawns the server and generates one image).
- Deps: `@modelcontextprotocol/sdk` + `zod` (installed here via `npm install`).
- After editing `mcp-server.mjs`, fully quit + reopen Desktop to reload it.

## Engines
**Default = ChatGPT** (`gpt-image-2`) — the preferred look; every output is cropped to the
exact format pixels. `--engine gemini` for Nano Banana 2 (faster, native 9:16), `--engine both`
to compare.

## Keys
Reads `GOOGLE_API_KEY` + `OPENAI_API_KEY` from your shell, falling back to a
gitignored `.env` (auto-loaded by `env.mjs`) — so it runs even when Claude Desktop
launches it in a bare shell. See `.env.example`.

## Rules baked in
1. Build **fresh from real refs** — never image-to-image an AI-generated slide.
2. **Outfit changes every post** — never reuse the ref's white tank.
3. **2–4 variants, pick the cleanest** — never ship the first blind render.
4. Text spelled **perfectly** or regenerate.
5. **Academy aesthetic only** while we master social.

## How it's built
- `style.mjs` — the locked aesthetic (STYLE block) + format presets *(edit this to evolve the look everywhere)*
- `recipes.mjs` — the social templates
- `engines.mjs` — Nano Banana 2 + ChatGPT wrappers (with retry + ref support)
- `make.mjs` — the orchestrator CLI
- `contact-sheet.mjs` — the HTML picker
