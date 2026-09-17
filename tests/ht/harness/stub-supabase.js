// stub-supabase.js — createClient() driven by window.__db, which the harness sets per scenario.
// __db.stateFor(args), when the harness installs one, answers ea_room_state from the args
// (p_key) instead of the fixed __db.state — for a key the server no longer knows.
export const createClient = () => ({
  auth: { getSession: async () => ({ data: { session: window.__db.session || null } }) },
  rpc: async (name, args) => {
    window.__calls.push(['rpc', name, args]);
    if (name === 'ea_room_state') return { data: typeof window.__db.stateFor === 'function' ? window.__db.stateFor(args) : window.__db.state, error: null };
    if (name === 'ea_is_admin') return { data: !!window.__db.admin, error: null };
    if (name === 'ea_room_rotate_link') { window.__db.room.link_key = 'NEWKEY_NEWKEY_NEWKEY_1'; return { data: window.__db.room.link_key, error: null }; }
    if (name === 'ea_room_set_hosts') { window.__db.room.host_emails = args.p_emails.map(s => s.toLowerCase()); return { data: window.__db.room.host_emails, error: null }; }
    if (name === 'ea_room_publish_replay') { const r = window.__db.replays.find(x => x.id === args.p_replay); r.published = args.p_publish; window.__db.state.recording_url = args.p_publish ? r.watch_url : null; return { data: { ok: true }, error: null }; }
    return { data: null, error: null };
  },
  from: (table) => {
    const q = { _t: table, _f: [], _patch: null };
    /* the class tables the replay page reads (0044/0045/0054): events, summaries, transcripts, materials */
    const rowsOf = () => table === 'ea_room_replays' ? window.__db.replays : table === 'ea_room_members' ? window.__db.members : table === 'ea_profiles' ? window.__db.profiles
      : table === 'ea_class_events' ? (window.__db.events || []) : table === 'ea_class_transcripts' ? (window.__db.transcripts || []) : table === 'ea_opil_materials' ? (window.__db.materials || []) : [];
    const chain = {
      select: () => chain, eq: (c, v) => { q._f.push([c, v]); return chain; }, gte: () => chain, lte: () => chain, in: () => chain, order: () => chain, limit: () => chain, range: () => chain,
      update: (p) => { q._patch = p; return chain; },
      maybeSingle: async () => {
        window.__calls.push(['from', table, 'maybeSingle', q._f, null]);
        if (table === 'ea_rooms') return { data: window.__db.room, error: null };
        if (table === 'ea_class_summaries') return { data: window.__db.summary || null, error: null };
        return { data: null, error: null };
      },
      then: (res) => {
        window.__calls.push(['from', table, q._patch ? 'update' : 'select', q._f, q._patch]);
        if (q._patch && table === 'ea_rooms') { Object.assign(window.__db.room, q._patch); Object.assign(window.__db.state, { is_live: window.__db.room.is_live }); return res({ data: null, error: null }); }
        return res({ data: rowsOf(), error: null });
      },
    };
    return chain;
  },
});
