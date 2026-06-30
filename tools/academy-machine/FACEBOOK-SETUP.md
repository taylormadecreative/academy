# Daily Facebook auto-posting — setup

The Academy posts one on-brand image to Facebook every day, fully automated, with no
clicks from you. It's already built and a starter queue of 6 posts is loaded. It just
needs **3 one-time things only you can do** (they involve Facebook + Blotato logins).

## Why a Facebook *Page* is required
Facebook's API does **not** allow posting to a personal profile — only to a **Page**
(this is Facebook's rule, not a Blotato limit). So the Academy needs its own free Page.

## Step 1 — Create a free Taylormade Academy Facebook Page  (~2 min)
1. facebook.com → Pages → **Create new Page**.
2. Name: **Taylormade Academy**. Category: *Education* (or *Education Website*).
3. Add the Academy logo as the profile picture. Publish. That's it — no audience needed to start.

## Step 2 — Connect that Page in Blotato  (~1 min)
1. In Blotato: **Settings → Accounts → Add Account → Facebook**.
2. Log in / authorize, and pick the **Taylormade Academy** Page.
3. It'll now appear in your account list (the same way "World of Baths" does today).

## Step 3 — Add 3 repo secrets on GitHub  (~2 min)
Tell me the Page is connected and I'll read the two IDs from Blotato for you. Then in
GitHub → the **academy** repo → **Settings → Secrets and variables → Actions → New
repository secret**, add:

| Secret name       | Value |
|-------------------|-------|
| `BLOTATO_API_KEY` | your Blotato API key (same one in your shell) |
| `FB_ACCOUNT_ID`   | the Blotato account id for the Academy page |
| `FB_PAGE_ID`      | the Facebook Page id |

(I can't add secrets for you — GitHub never exposes them back — but I'll hand you the
exact values to paste.)

## That's it — then it runs itself
- A GitHub Action (`.github/workflows/fb-daily.yml`) fires **every day at 10am CT** and
  posts the next image in the queue to the Page. No Mac needed, no clicks.
- **Test it first:** GitHub → Actions → *Daily Facebook post* → **Run workflow** with
  *dry run* checked. It logs exactly what it would post without publishing. When that
  looks right, run it once without dry-run to publish the first one.

## The content queue
- Pre-made images live in `fb/queue/` (public via GitHub Pages); captions + state live
  in `fb/queue.json`. Each post fires once, in order, then is marked done.
- **Refill anytime:** add topics to `tools/academy-machine/fb-topics.json`, then run
  `node tools/academy-machine/fb-fill-queue.mjs` — it generates the new images locally
  (full quality, your face + logo) and appends them. Commit `fb/` and push.
- The daily job warns in its log when the queue is down to its last few posts.

## Want a review step instead of fully-automatic?
You chose fully-automatic. If you ever want to eyeball each post first, say so — your
`/review` approval surface already exists (the POTD pipeline uses it) and I can route
the daily Facebook post through it the same way.
