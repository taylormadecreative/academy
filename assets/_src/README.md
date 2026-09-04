# Open Graph card sources — /agent/

Two finished cards, both 1200x630, both built from Nelson's varsity-jacket portrait
(`assets/agent-nelson.png`, background removed with the macOS Vision cutout script).

| File | Live as | Look |
| --- | --- | --- |
| `b.html` | `assets/og-agent.png` | Navy drenched. Space Grotesk, gold bar under one word, a thin light rim so the navy jacket does not sink into the navy ground. |
| `c.html` | `assets/og-agent-popart.png` | Pop-art sticker. Royal blue sunburst, halftone, Anton caps with a gold outline, thick white sticker stroke on the cutout. |

To swap which one the page uses:

```bash
cp assets/og-agent-popart.png assets/og-agent.png   # go loud
git commit -am "chore(og): swap the agent card" && git push origin domain-migration:main
```

To re-render after an edit:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1200,630 --allow-file-access-from-files \
  --virtual-time-budget=6000 --screenshot=out.png "file://$PWD/assets/_src/b.html"
```

Two things that went wrong the first time and are worth not repeating: a badge placed
top-right disappears behind his head, and the navy jacket merges into a navy background
unless it gets a rim or a light card behind it.
