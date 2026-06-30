# Prompt of the Day — daily Cowork video pipeline

Renders the daily "Prompt of the Day" video (a Claude Cowork task, in `tasks.json`)
and stages it as a **hidden** community post for Nelson to approve.

## Flow
1. **GitHub Actions** (`.github/workflows/potd.yml`) runs daily at 13:00 UTC (8am CT)
   — also runnable on-demand from the Actions tab (`workflow_dispatch`).
2. `potd-publish.mjs`: picks the day's task → renders the Remotion video →
   uploads it to the `community-media` bucket → stages a **hidden** post.
3. Nelson opens **https://academy.taylormadecreative.net/review/**, watches it, and
   **Approve & publish** (it goes live in the feed) or **Reject** (discarded).

## One-time setup (Nelson)
Add a single repo secret so the Action can post:
- GitHub → this repo → **Settings → Secrets and variables → Actions → New repository secret**
- Name: `BOT_SECRET`
- Value: the `ea-community-bot` x-bot-secret (ask Claude / see the edge-function source).

That's it — the workflow handles Chromium + rendering on its own. (No Supabase keys
needed in CI; the bot returns a short-lived signed upload URL.)

## Content
`tasks.json` is the rotating bank of Cowork tasks (income / student / corporate /
creative). It rotates by day-of-year. Refill / add fresh tasks anytime — batch a bunch
on weekends. Each entry: `{ category, task, steps[4], result }`.

## Local
```bash
npm install
npm run studio          # preview the composition
BOT_SECRET=... node potd-publish.mjs   # render + stage today's (or --index=N)
```
