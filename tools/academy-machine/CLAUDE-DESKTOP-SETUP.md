# Make Claude Desktop always use the Academy machine

Your MCP server loads fine (the logs confirm it). The problem is Claude Desktop's chat
has code tools and will *hand-render a flat SVG* unless you tell it not to. Two steps fix it.

## 1) Paste this into Claude Desktop → Customize (applies to EVERY chat)
> Whenever I ask for an image, post, carousel, quote card, story, hero graphic, flyer,
> or any visual for **Taylormade Academy**, you MUST use the `generate_academy_content`
> tool from the **academy-content-machine** MCP server. Do NOT hand-render images with
> SVG, HTML, code, or `sharp` — always call the tool. It uses my real reference photos
> and my real academy logo. If the post should feature me, use the `hero-post` (or
> `lifestyle`) recipe. Pass any pose/setting I describe (e.g. "pointing at the headline",
> "lifestyle coffee-shop") in the `notes` field. Do NOT add "Let me put you on" or any
> CTA to the headline unless I explicitly ask. Generate 2–3 variants. It opens a full-res
> contact sheet on my screen to pick from.

(For just the Academy project instead of everywhere, paste it into that **Project's**
custom instructions rather than global Customize.)

## 2) Make sure the connector is ON in the chat
In the message composer, open the tools/connectors menu (the **+** or the slider icon)
and confirm **academy-content-machine** is enabled/checked. If a chat doesn't show it,
toggle it on.

## Then test
New chat → "make me a hero post: 7 prompts that build a full week of content".
It should call `generate_academy_content`, return a preview inline, open the full-res
contact sheet, feature you (face from your refs), and stamp the real logo.

> If it ever still tries to render an SVG itself, reply: "Use the
> generate_academy_content tool — don't render it yourself." That snaps it back.
