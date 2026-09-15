# HT class room harness

Run: `python3 -m http.server 8790 --bind 127.0.0.1` from the repo root, then in another
shell `node tests/ht/harness/ht-room.mjs`.
Needs `npm i -D playwright` once (not committed to this repo).
It never touches prod: Supabase and the room kit are stubbed in-browser (`stub-supabase.js`,
`stub-room-v2.js`); nothing here signs in or reaches a real backend.

Since 9/15 (nobody ends a class by accident) the stub models the room module's exits: `leave()` only
leaves, `end()` says 'ended', and a roomLeft state that is not left / kicked / ended is a DROP — the
strip shows and the harness answers with `rejoinOk()` / `rejoinFail()`. Scenarios 5–5e cover the host's
Leave (still running, Rejoin + two-tap End), the 9/15 drop (no stop, no flip, no card, back in the same
meeting), End from Tools, a second screen taking the seat, and a guest who is removed (the ended card
polls and offers Rejoin once the room is live AGAIN), and a Rejoin pressed after another host ended the
session (the row is re-read first; nothing mounts). `window.__htRoomPollMs` shortens the page's poll for
the ended card; only the harness sets it.
