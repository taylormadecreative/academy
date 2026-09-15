# HT class room harness

Run: `python3 -m http.server 8790 --bind 127.0.0.1` from the repo root, then in another
shell `node tests/ht/harness/ht-room.mjs`.
Needs `npm i -D playwright` once (not committed to this repo).
It never touches prod: Supabase and the room kit are stubbed in-browser (`stub-supabase.js`,
`stub-room-v2.js`); nothing here signs in or reaches a real backend.
