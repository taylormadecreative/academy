// tests/academy/e2e/fake-supabase-lobby.js — stands in for esm.sh/@supabase/supabase-js@2 in lobby.e2e.mjs.
// The "server" is localStorage, shared by every page in one browser context: 'fake-live' = '1' while the room is live.
// window.FAKE_ROLE ('host' | 'guest') decides what ea_room_state says about the person. Realtime presence is a
// BroadcastChannel per topic, so a host page and guest pages in the same context see each other like the real channel.
// window.FAKE_RT_FAIL: subscribe answers CHANNEL_ERROR (the lobby must fail open).
export function createClient() {
  const log = (window.FAKE_LOG = window.FAKE_LOG || []);
  const roomState = () => ({
    id: 'room-1', slug: 'academy', title: 'AI 101: Learn to talk to AI', host_name: 'Nelson Taylor',
    is_live: localStorage.getItem('fake-live') === '1', signed_in: !!window.FAKE_SESSION, is_host: window.FAKE_ROLE === 'host',
    can_join: true, open_door: false, bad_link: !!window.FAKE_BAD_LINK, warmup_q: "Finish this sentence: I'd love help with ___",
    next_at: window.FAKE_NEXT_AT || null,
  });
  const query = (table) => {
    const st = { table, filters: [] };
    const done = (data) => Promise.resolve({ data, error: null });
    const q = {
      select() { return q; }, eq(c, v) { st.filters.push([c, v]); return q; }, order() { return q; }, limit() { return q; }, in() { return q; }, ilike() { return q; }, neq() { return q; },
      abortSignal() { return q; },
      update(v) { st.update = v; return q; }, delete() { st.del = true; return q; }, insert(v) { st.insert = v; return q; },
      upsert(v) { log.push({ upsert: table, values: v }); return done([v]); },
      maybeSingle() { log.push({ from: table, ...st }); if (table === 'ea_profiles') return done(window.FAKE_NAME ? { display_name: window.FAKE_NAME } : null); return done(null); },
      single() { log.push({ from: table, ...st }); if (table === 'ea_rooms') return done({ link_key: 'AbC123_-xyzXYZ0987ab-_', title: 'AI 101: Learn to talk to AI' }); return done(null); },
      then(res, rej) {
        if (st.update) { log.push({ update: table, values: st.update }); if (table === 'ea_rooms' && st.update.is_live === false) localStorage.setItem('fake-live', '0'); return done([{ id: 'room-1' }]).then(res, rej); }
        log.push({ from: table, ...st });
        return done((window.FAKE_ROWS || {})[table] || []).then(res, rej);
      },
    };
    return q;
  };
  function channel(topic, opts) {
    const key = (opts && opts.config && opts.config.presence && opts.config.presence.key) || ('k' + Math.random());
    const bc = new BroadcastChannel('fake-rt:' + topic);
    const others = new Map(); let mine = null, sync = null, closed = false;
    const fire = () => { if (sync && !closed) setTimeout(() => sync(), 0); };
    bc.onmessage = (e) => {
      const d = e.data || {};
      if (d.key === key) return;
      if (d.t === 'track') { others.set(d.key, d.meta); fire(); if (d.hello && mine) bc.postMessage({ t: 'track', key, meta: mine }); }
      else if (d.t === 'leave') { others.delete(d.key); fire(); }
    };
    let hello = true;
    /* a page that goes away says so, like the real channel's presence leave */
    window.addEventListener('pagehide', () => { try { bc.postMessage({ t: 'leave', key }); } catch (e) {} });
    const ch = {
      topic,
      on(type, filter, cb) { if (type === 'presence' && filter && filter.event === 'sync') sync = cb; return ch; },
      subscribe(cb) { setTimeout(() => cb && cb(window.FAKE_RT_FAIL ? 'CHANNEL_ERROR' : 'SUBSCRIBED'), 60); return ch; },
      track(meta) { if (closed) return Promise.resolve('closed'); mine = { ...meta }; bc.postMessage({ t: 'track', key, meta: mine, hello }); hello = false; fire(); return Promise.resolve('ok'); },
      untrack() { mine = null; try { bc.postMessage({ t: 'leave', key }); } catch (e) {} return Promise.resolve('ok'); },
      presenceState() { const s = {}; for (const [k, m] of others) if (m) s[k] = [m]; if (mine) s[key] = [mine]; return s; },
      send() { return Promise.resolve('ok'); },
      _close() { closed = true; try { bc.close(); } catch (e) {} },
    };
    window.__fakeChannels = (window.__fakeChannels || []); window.__fakeChannels.push(ch);
    return ch;
  }
  return {
    auth: { getSession: () => Promise.resolve({ data: { session: window.FAKE_SESSION || null }, error: null }) },
    rpc: (name, args) => {
      log.push({ rpc: name, args });
      const p = Promise.resolve(name === 'ea_room_state' ? { data: roomState(), error: null } : { data: null, error: null });
      return { abortSignal() { return p; }, then: (res, rej) => p.then(res, rej) };
    },
    from: query,
    channel,
    removeChannel(ch) { try { ch.untrack(); ch._close(); } catch (e) {} },
    realtime: { setAuth: async () => {} },
  };
}
