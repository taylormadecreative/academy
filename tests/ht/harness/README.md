# HT class room harness

Run: `python3 -m http.server 8790 --bind 127.0.0.1` from the repo root, then in another
shell `node tests/ht/harness/ht-room.mjs`.
To use another local port, run `HT_TEST_BASE_URL=http://127.0.0.1:8871 node tests/ht/harness/ht-room.mjs`. The override also applies to the imported room-module and OPIL scenarios.

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

`room-v2-real.mjs` (R1–R3, run by ht-room.mjs after the page scenarios) loads the REAL `js/rtk-room-v2.js`
against a fake kit client answered in-browser (the three CDN files, the effects addon, and ea-rtk-join on the
page's own origin): a drop that cannot be mended tells the dead client to leave, so it never walks the person
back in behind the card; Leave pressed while a rejoin is in flight wins (the client that lands afterwards leaves
at once, and the page never hears 'joined' after 'left'); Split students into rooms is two taps.

`opil-live.mjs` (O1–O2, also run by ht-room.mjs) drives the OPIL live page (`/opil/hub/live/?s=7`) with the same
stubbed module and `stub-supabase-opil.js` (eq / neq / in filters honoured; updates noted in localStorage across
the page's own reload): the host's Start reads Entering… DISABLED until the host is in (never a second mount from
the camera-check screen), Leave keeps the class running, Rejoin asks the recording to start again, the card's End
pressed out of the room sends `end` (everyone out, server-side) before the row closes; a student whose class is
ended from outside the room is taken out by the row poll (`window.__opilRoomPollMs` shortens it) and sees "Class
ended." The stub module now resolves a host/student mount only on `state('joined')`, as the real one does.
