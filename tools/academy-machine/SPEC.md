# Academy Content Machine — design spec
_2026-06-29_

## Goal
A reliable "content machine" that lets a Claude Desktop project produce **viral, on-brand
Taylormade Academy social content** by orchestrating Nelson's existing image APIs
(Nano Banana 2 / Gemini + ChatGPT image) — instead of weak one-shot prompts. Scope v1:
**master social content in the Academy aesthetic first.**

## Problem
The APIs were already wired (`tools/gen-image.mjs`, `tools/openai-image.mjs`,
`tools/openai-edit.mjs`) but output looked weak because nothing encoded the brand taste,
the variant-and-pick workflow, or viral social composition. The gap was the *brain*, not
the wiring.

## Architecture — three layers
1. **Brain** (`BRAIN.md` + root `CLAUDE.md`): operator's manual Claude Desktop reads —
   the locked aesthetic, recipe map, engine selection, Nelson's non-negotiable rules,
   and the run-every-time workflow.
2. **Machine** (`make.mjs` + `style.mjs` + `engines.mjs` + `contact-sheet.mjs`):
   one command composes a recipe prompt, wraps it in the locked STYLE block, fans out
   across both engines, makes N variants, saves to `out/<date>-<label>/`, retries on API
   error, and writes an `index.html` contact sheet for visual picking.
3. **Recipes** (`recipes.mjs`): social templates — hero-post, quote-card, lesson-card,
   stat-flex, behind-the-build, launch, story-frame, carousel.

## Locked aesthetic (single source of truth = `style.mjs` STYLE)
Navy ink `#0a1733` / royal blue · gold `#fdc921` · paper `#fcfdff`; Space Grotesk display +
Inter body with gold highlight bar under one key word; blue blobs, gold+blue sparkles,
rounded pills/cards, soft shadows, negative space; hero = Nelson in navy+gold letterman
jacket; mood = aspirational "build/ship/create."

## Engines
- **Nano Banana 2** (`gemini-3.1-flash-image`): true 4:5 / 9:16, reference photos, fast — the social workhorse.
- **ChatGPT** (`gpt-image-1`, edits `gpt-image-2`): crisp typographic text; limited aspect ratios (letterbox/crop).
- Default `--engine both`; the contact sheet decides.

## Format presets
post 4:5 (1080×1350) · reel/story 9:16 (1080×1920) · square 1:1 · wide 16:9.
Gemini gets the exact aspect ratio; OpenAI gets the closest size.

## Rules encoded
Fresh from real refs (never i2i an AI slide) · 2–4 variants pick the cleanest ·
perfect spelling or regenerate · one idea per frame · Academy aesthetic only.

## Verification (done)
- `--list`, `--dry-run` (single + carousel) compose correct prompts.
- Live `quote-card --n 1 --engine both` produced two clean, on-brand 4:5 cards
  (gold highlight under key word, sparkles, academy wordmark, perfect spelling) and a
  working contact sheet. Pipeline proven end-to-end.

## Out of scope (later)
MCP connector for inline chat anywhere · non-social formats (web heroes, course cards,
ads) · auto-crop OpenAI 2:3 → exact 4:5 · scheduling/Blotato handoff.
