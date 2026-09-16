// stub-supabase-opil.js — createClient() for the OPIL live page, driven by window.__db (the harness sets it
// per scenario): __db.session, __db.role (ea_opil_my_role), and one array per table (ea_opil_sessions,
// ea_opil_live_chat, ea_opil_replays). eq / neq / in filters are honoured so the page's own reads of ONE
// session (the in-room poll, Rejoin's re-read) answer truthfully; an update patches the matching rows in
// place and is also noted in localStorage['__updates'], which survives the page's own location.reload().
export const createClient = () => ({
  auth: { getSession: async () => ({ data: { session: window.__db.session || null } }) },
  rpc: async (name, args) => {
    window.__calls.push(['rpc', name, args]);
    if (name === 'ea_opil_my_role') return { data: window.__db.role, error: null };
    if (name === 'ea_opil_session_facilitator') return { data: 'Casey Dike', error: null };
    return { data: null, error: null };
  },
  from: (table) => {
    const q = { f: [], patch: null, ins: null };
    const rows = () => (window.__db[table] || []).filter((r) => q.f.every(([op, c, v]) => op === 'eq' ? r[c] === v : op === 'neq' ? r[c] !== v : op === 'in' ? v.includes(r[c]) : true));
    const chain = {
      select: () => chain, order: () => chain, limit: () => chain, is: () => chain,
      eq: (c, v) => { q.f.push(['eq', c, v]); return chain; }, neq: (c, v) => { q.f.push(['neq', c, v]); return chain; }, in: (c, v) => { q.f.push(['in', c, v]); return chain; },
      update: (p) => { q.patch = p; return chain; }, insert: (r) => { q.ins = r; return chain; },
      maybeSingle: async () => ({ data: rows()[0] || null, error: null }),
      then: (res) => {
        window.__calls.push(['from', table, q.patch ? 'update' : q.ins ? 'insert' : 'select', q.f, q.patch || q.ins]);
        if (q.patch) {
          rows().forEach((r) => Object.assign(r, q.patch));
          try { const u = JSON.parse(localStorage.getItem('__updates') || '[]'); u.push([table, q.f, q.patch]); localStorage.setItem('__updates', JSON.stringify(u)); } catch (e) {}
          return res({ data: null, error: null });
        }
        if (q.ins) { (window.__db[table] = window.__db[table] || []).push(q.ins); return res({ data: null, error: null }); }
        return res({ data: rows(), error: null });
      },
    };
    return chain;
  },
  channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
  removeChannel: () => {},
});
