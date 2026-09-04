# Open Graph card sources — /agent/

Two finished cards, both 1200x630, both built from Nelson's varsity-jacket portrait
(`assets/agent-nelson.png`, background removed with the macOS Vision cutout script).

| File | Live as | Look |
| --- | --- | --- |
| `a.html` | **`assets/og-agent.png`** (live) | White. Nelson's pick. Paper ground, Space Grotesk, gold bar under one word. A hairline border and a navy base bar give it a defined edge, because a near-white card with no edge dissolves against a white chat window. |
| `b.html` | `assets/og-agent-navy.png` | Navy drenched. A thin light rim keeps the navy jacket off the navy ground. |
| `c.html` | `assets/og-agent-popart.png` | Pop-art sticker. Royal blue sunburst, halftone, Anton caps with a gold outline, thick white sticker stroke on the cutout. |

To swap which one the page uses:

```bash
cp assets/og-agent-popart.png assets/og-agent.png   # go loud
cp assets/og-agent-navy.png    assets/og-agent.png   # go dark
git commit -am "chore(og): swap the agent card" && git push origin domain-migration:main
```

To re-render after an edit:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1200,630 --allow-file-access-from-files \
  --virtual-time-budget=6000 --screenshot=out.png "file://$PWD/assets/_src/b.html"
```

Three things that went wrong and are worth not repeating: a badge placed top-right
disappears behind his head; the navy jacket merges into a navy background unless it gets
a rim; and a white card with no edge treatment vanishes against a white chat window,
which is what the hairline and the navy base bar in a.html are there to prevent.
