# Taylormade Academy — project guide for Claude

This repo is the **Taylormade Academy** site (storefront, courses, community, ebooks)
deployed to GitHub Pages → `academy.taylormadecreative.net`.

## Making social content / images — use the Content Machine
When asked to make hero images, social posts, carousels, quote cards, or any visual
content for the Academy, **do not hand-write image prompts.** Use the on-brand machine:

➡️ **Read and follow `tools/academy-machine/BRAIN.md`**, then run `tools/academy-machine/make.mjs`.

It locks the Academy aesthetic (navy `#0a1733` · gold `#fdc921` · paper white · Space
Grotesk/Inter), fans out across Nano Banana 2 + ChatGPT image, makes variants, and builds
a contact sheet to pick from. We are **mastering social content in the Academy aesthetic first.**

Quick start:
```
cd tools/academy-machine && node make.mjs --list
node make.mjs quote-card "Start before you feel ready" --n 3 --engine both
```

Also available in **any Claude Desktop chat** via the `academy-content-machine` MCP
server (`tools/academy-machine/mcp-server.mjs`) — tools `generate_academy_content` +
`list_academy_recipes`. Registered in the Desktop config; restart Desktop to load.

## Brand quick reference
- Palette: deep navy `#0a1733`/`#04123a`, royal blue, gold `#fdc921`/`#f2b705`, paper `#fcfdff`
- Type: Space Grotesk (display) + Inter (body); gold highlight bar under one key word
- Hero subject: Nelson — locs, navy+gold letterman jacket, white tee
- Always: build fresh from real reference photos; 2–4 variants, pick the cleanest; perfect spelling
