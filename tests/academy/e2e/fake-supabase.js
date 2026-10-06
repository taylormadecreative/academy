// tests/academy/e2e/fake-supabase.js — stands in for esm.sh/@supabase/supabase-js@2 in e2e runs.
// window.FAKE_SESSION: the signed-in session (null = signed out). window.FAKE_AUTH_ERROR: getSession fails.
// window.FAKE_RPC[name]: {data, error}, or a function(args) returning one; FAKE_RPC_DELAY_MS slows every rpc. rpc() and
// from() both take .abortSignal() like the real client. window.FAKE_ROWS[table]: rows for from(table).select().
// window.FAKE_UPDATED_AT[id]: a row's current updated_at; an update filtered on an older one touches nothing.
// Calls are logged to window.FAKE_LOG so tests can assert what the page sent.
export function createClient() {
  const log = (window.FAKE_LOG = window.FAKE_LOG || []);
  const answer = (v, args) => Promise.resolve(typeof v === 'function' ? v(args) : (v || { data: null, error: null }));
  const query = (table) => {
    const st = { table, filters: [] };
    const q = {
      select() { return q; }, eq(c, v) { st.filters.push([c, v]); return q; }, order() { return q; }, limit() { return q; },
      abortSignal() { return q; },
      update(v) { st.update = v; return q; },
      maybeSingle() { // filtered by id when the query names one; FAKE_UPDATED_AT shows a row edited since it was read
        log.push({ from: table, ...st });
        const rows = (window.FAKE_ROWS || {})[table] || [], id = (st.filters.find((f) => f[0] === 'id') || [])[1];
        let row = id !== undefined ? rows.find((r) => r.id === id) : rows[0];
        if (row && (window.FAKE_UPDATED_AT || {})[row.id] !== undefined) row = { ...row, updated_at: window.FAKE_UPDATED_AT[row.id] };
        return new Promise((ok) => setTimeout(() => ok({ data: row || null, error: null }), window.FAKE_DELAY_MS || 0));
      },
      then(res, rej) {
        if (st.update) { // an update: log it; it touches the row its eq('id') names unless FAKE_UPDATE_EMPTY (RLS said no)
          log.push({ update: table, values: st.update, filters: st.filters });
          const id = (st.filters.find((f) => f[0] === 'id') || [])[1];
          const at = (st.filters.find((f) => f[0] === 'updated_at') || [])[1], now = (window.FAKE_UPDATED_AT || {})[id];
          const stale = now !== undefined && at !== now;
          return Promise.resolve({ data: window.FAKE_UPDATE_EMPTY || stale ? [] : [{ id }], error: null }).then(res, rej);
        }
        log.push({ from: table, ...st });
        const rows = { data: (window.FAKE_ROWS || {})[table] || [], error: null }, ms = window.FAKE_DELAY_MS || 0; // FAKE_DELAY_MS: a slow read
        return new Promise((ok) => setTimeout(() => ok(rows), ms)).then(res, rej);
      },
    };
    return q;
  };
  return {
    auth: { getSession: () => Promise.resolve(window.FAKE_AUTH_ERROR ? { data: { session: null }, error: { message: 'auth down' } } : { data: { session: window.FAKE_SESSION || null }, error: null }) },
    rpc: (name, args) => {
      log.push({ rpc: name, args });
      const ms = window.FAKE_RPC_DELAY_MS || 0; // FAKE_RPC_DELAY_MS: a slow save
      const p = new Promise((ok) => setTimeout(ok, ms)).then(() => answer((window.FAKE_RPC || {})[name], args));
      return { abortSignal(sig) { log.push({ rpc: name, signal: !!sig }); return p; }, then: (res, rej) => p.then(res, rej) };
    },
    from: query,
  };
}
