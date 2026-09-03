/* /founder/ — Nelson's founder dashboard. Everything here runs as the signed-in admin:
   reads and writes go straight through supabase-js under the admin RLS policies
   (profiles.role = 'admin'); the only edge function call is the announcement send. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CFG = window.BM_CONFIG || {};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (c) => { const d = (c || 0) / 100; return c % 100 === 0 ? "$" + d.toLocaleString() : "$" + d.toFixed(2); };
const WORKSHOP = "build-your-first-ai-agent";
const SITE = "https://taylormadeacademy.com";

/* ---------- dates in the event's own time zone ---------- */
function when(iso, tz = "America/Chicago", opts = {}) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: opts.short ? "short" : "long", month: opts.short ? "short" : "long", day: "numeric", ...(opts.year ? { year: "numeric" } : {}) }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
  return `${date} at ${time}`;
}
function ago(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
  const dd = Math.floor(h / 24); if (dd < 14) return dd + "d ago";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
// datetime-local string ("2026-10-23T19:00") in tz -> ISO instant.
function zonedToISO(local, tz) {
  if (!local) return null;
  const [dpart, tpart] = local.split("T");
  const [y, mo, d] = dpart.split("-").map(Number);
  const [h, mi] = tpart.split(":").map(Number);
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const off = tzOffsetMinutes(tz, guess);
    guess = Date.UTC(y, mo - 1, d, h, mi) - off * 60000;
  }
  return new Date(guess).toISOString();
}
function tzOffsetMinutes(tz, at) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date(at));
  const s = (parts.find((p) => p.type === "timeZoneName") || {}).value || "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(s);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}
// ISO instant -> datetime-local string in tz.
function isoToZoned(iso, tz) {
  if (!iso) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
function csv(rows) {
  const cell = (v) => {
    let s = v == null ? "" : String(v);
    if (/^[=+@]/.test(s) || (/^-/.test(s) && !/^-?\d/.test(s))) s = "'" + s; // formula guard that leaves signed numbers alone
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
let toastT;
function toast(msg, ms = 3200) { const t = $("toast"); t.innerHTML = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), ms); }
function confirmDlg(h, p, yes = "Yes") {
  return new Promise((res) => {
    $("cfH").textContent = h; $("cfP").textContent = p; $("cfYes").textContent = yes;
    const d = $("confirmDlg"); d.showModal();
    $("cfYes").onclick = () => { d.close(); res(true); };
    $("cfNo").onclick = () => { d.close(); res(false); };
  });
}

/* ---------- auth gate ---------- */
const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
const { data: { session } } = await sb.auth.getSession();
if (!session) { location.replace("/login/?next=" + encodeURIComponent("/founder/")); throw new Error("redirect"); }
$("ue").textContent = session.user.email || "";
$("so").onclick = async () => { await sb.auth.signOut(); location.href = "/"; };
const { data: isAdmin } = await sb.rpc("ea_is_admin");
$("boot").hidden = true;
if (!isAdmin) {
  $("gate").hidden = false;
  $("gateH").textContent = "This page is for the founder.";
  $("gateP").textContent = "You are signed in as " + (session.user.email || "a member") + ". Your own dashboard is over here.";
  $("gateA").innerHTML = '<a class="btn gold" href="/dashboard/">Go to my dashboard</a>';
  throw new Error("not admin");
}
$("app").hidden = false;

/* ---------- state ---------- */
let signups = [], events = [], tiers = [], orders = [], tickets = [], stats = {};

async function loadAll() {
  // Sweep holds that never reached Stripe so they stop cluttering Orders. Harmless if none.
  sb.rpc("ea_expire_stale_holds").then(({ error }) => { if (error) console.warn("hold sweep", error.message); });
  const [s, e, t, o, k, st] = await Promise.all([
    sb.from("ea_wl_signups").select("*").eq("workshop_slug", WORKSHOP).order("created_at", { ascending: false }).limit(2000),
    sb.from("ea_events").select("*").order("starts_at", { ascending: true }),
    sb.from("ea_ticket_tiers").select("*").order("sort").order("price_cents"),
    sb.from("ea_orders").select("*").order("created_at", { ascending: false }).limit(500),
    sb.from("ea_tickets").select("*").order("created_at").limit(2000),
    sb.rpc("ea_founder_stats"),
  ]);
  signups = s.data || []; events = e.data || []; tiers = t.data || []; orders = o.data || []; tickets = k.data || []; stats = st.data || {};
  const err = [s, e, t, o, k, st].find((r) => r.error);
  if (err) toast("Some data did not load: " + esc(err.error.message));
  $("nWait").textContent = signups.filter((x) => x.status !== "unsubscribed").length;
  $("nEv").textContent = events.filter((x) => !["past", "canceled"].includes(x.status)).length;
  $("nOrd").textContent = orders.filter((x) => x.status === "paid").length;
  $("asof").textContent = "Live numbers as of " + new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + ".";
  renderOverview(); renderWaitlist(); renderEvents(); renderOrders(); renderAnnounce();
}

/* ---------- tabs (hash routed so emails can deep link) ---------- */
function go(tab) {
  const valid = ["overview", "waitlist", "events", "orders", "announce"];
  if (!valid.includes(tab)) tab = "overview";
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.id === "p-" + tab));
  document.querySelectorAll("#tabs a").forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle("on", on);
    a.setAttribute("aria-selected", on ? "true" : "false");
  });
  if (location.hash !== "#" + tab) history.replaceState(null, "", "#" + tab);
}
window.addEventListener("hashchange", () => go(location.hash.slice(1)));
// Tell people the tab strip keeps going when it is cut off at phone widths.
function tabOverflow() {
  const n = $("tabs"), w = $("tabsWrap");
  if (n && w) w.classList.toggle("more", n.scrollWidth - n.clientWidth - n.scrollLeft > 8);
}
$("tabs").addEventListener("scroll", tabOverflow);
window.addEventListener("resize", tabOverflow);
tabOverflow();
document.querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(a.dataset.go); }));
document.querySelectorAll("#tabs a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(a.dataset.tab); }));

/* ---------- overview ---------- */
function renderOverview() {
  const paidRevenue = stats.ticket_revenue || 0;
  const tiles = [
    { v: stats.waitlist_total ?? 0, l: "On the waitlist", d: (stats.waitlist_7d || 0) + " joined this week", hero: true },
    { v: stats.tickets_sold ?? 0, l: "Seats sold", d: money(paidRevenue) + " in ticket revenue" },
    { v: stats.waitlist_invited ?? 0, l: "Invited to a date", d: (stats.waitlist_purchased || 0) + " went on to buy" },
    { v: stats.members_total ?? 0, l: "Academy members", d: (stats.members_7d || 0) + " new this week" },
    { v: stats.memberships_active ?? 0, l: "Paid memberships", d: "active right now" },
    { v: stats.subscribers ?? 0, l: "Newsletter subscribers", d: (stats.store_orders || 0) + " store purchases all time" },
  ];
  $("tiles").innerHTML = tiles.map((t) => `<div class="tile${t.hero ? " hero" : ""}"><div class="v">${esc(t.v)}</div><div class="l">${esc(t.l)}</div><div class="d">${esc(t.d)}</div></div>`).join("");

  // 14-day signups: one series, thin bars, direct label only on the max day.
  const days = [], now = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); days.push({ d, n: 0 }); }
  signups.forEach((s) => { const t = new Date(s.created_at); t.setHours(0, 0, 0, 0); const idx = 13 - Math.round((now - t) / 86400000); if (idx >= 0 && idx < 14) days[idx].n++; });
  const max = Math.max(1, ...days.map((x) => x.n)), total = days.reduce((a, b) => a + b.n, 0);
  $("sparkSum").textContent = total + " in 14 days";
  const W = 560, H = 120, pad = 18, bw = (W - pad * 2) / 14 - 6;
  $("spark").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Waitlist signups per day for the last 14 days">` +
    `<line class="axis" x1="${pad}" y1="${H - 22}" x2="${W - pad}" y2="${H - 22}"/>` +
    days.map((x, i) => {
      const h = Math.round((x.n / max) * (H - 50)), xx = pad + i * ((W - pad * 2) / 14) + 3, y = H - 22 - h;
      const lbl = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(x.d);
      return `<rect x="${xx}" y="${y}" width="${bw}" height="${Math.max(h, x.n ? 4 : 1)}" rx="3"><title>${esc(lbl)}: ${x.n} signup${x.n === 1 ? "" : "s"}</title></rect>` +
        (x.n === max && x.n > 0 ? `<text class="lbl" x="${xx + bw / 2}" y="${y - 6}" text-anchor="middle">${x.n}</text>` : "") +
        (i % 3 === 0 || i === 13 ? `<text x="${xx + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(x.d))}</text>` : "");
    }).join("") + `</svg>`;

  const next = events.filter((e) => ["announced", "on_sale", "sold_out", "draft"].includes(e.status) && new Date(e.starts_at) > new Date(Date.now() - 3 * 3600e3))[0];
  if (!next) {
    $("nextEv").innerHTML = `<div class="empty"><b>No date on the calendar.</b>Add one under Dates, keep it as a draft until you are sure, then announce it to the list.</div>`;
  } else {
    const evTiers = tiers.filter((t) => t.event_id === next.id);
    const sold = tickets.filter((k) => k.event_id === next.id && k.status === "valid").length;
    $("nextEv").innerHTML = `<div style="font-family:var(--display);font-weight:700;font-size:20px;letter-spacing:-.02em;color:var(--ink)">${esc(next.title)}</div>` +
      `<div style="margin-top:6px;color:var(--ink-2)">${esc(when(next.starts_at, next.tz))}${next.venue_label ? " · " + esc(next.venue_label) : ""}</div>` +
      `<div class="row" style="margin-top:10px"><span class="st ${esc(next.status)}">${esc(label(next.status))}</span><span>${sold} of ${next.capacity} seats sold</span><span>${evTiers.length} tier${evTiers.length === 1 ? "" : "s"}</span></div>` +
      `<div class="row" style="margin-top:14px"><a class="btn ghost xs" href="#events" data-go="events">Edit</a>${next.status !== "draft" ? `<a class="btn gold xs" href="#announce" data-go="announce">Announce</a>` : ""}</div>`;
    $("nextEv").querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(a.dataset.go); }));
  }

  const recent = signups.slice(0, 6);
  $("recentTbl").innerHTML = recent.length
    ? `<thead><tr><th>Name</th><th>Email</th><th>Level</th><th>Wants an agent to</th><th>Joined</th></tr></thead><tbody>` +
      recent.map((s) => `<tr><td class="strong">${esc(s.full_name)}${s.city ? `<span class="sub">${esc(s.city)}</span>` : ""}</td><td>${esc(s.email)}</td><td>${esc(level(s.experience))}</td><td>${esc(s.goal || "")}</td><td class="nowrap">${esc(ago(s.created_at))}</td></tr>`).join("") + `</tbody>`
    : `<tbody><tr><td><div class="empty"><b>Nobody yet.</b>Share taylormadeacademy.com/agent and the first names show up here.</div></td></tr></tbody>`;
}
const level = (e) => ({ new: "Brand new", some: "Uses ChatGPT", building: "Already building" }[e] || e || "");
const label = (s) => ({ on_sale: "On sale", announced: "Announced", sold_out: "Sold out", draft: "Draft", past: "Past", canceled: "Canceled", waiting: "Waiting", invited: "Invited", purchased: "Bought a seat", unsubscribed: "Left the list", paid: "Paid", pending: "Pending", refunded: "Refunded", valid: "Valid", void: "Void" }[s] || s);

/* ---------- waitlist ---------- */
function filteredSignups() {
  const q = ($("wlQ").value || "").trim().toLowerCase(), st = $("wlStatus").value;
  return signups.filter((s) => (!st || s.status === st) && (!q || [s.full_name, s.email, s.city, s.goal, s.phone, s.notes].join(" ").toLowerCase().includes(q)));
}
function renderWaitlist() {
  const list = filteredSignups();
  $("wlCount").textContent = list.length + " of " + signups.length;
  $("wlTbl").innerHTML = list.length
    ? `<thead><tr><th>#</th><th>Name</th><th>Contact</th><th>Level</th><th>Wants an agent to</th><th>Joined</th><th>Status</th><th>Notes</th></tr></thead><tbody>` +
      list.map((s) => {
        const pos = signups.length - signups.findIndex((x) => x.id === s.id);
        return `<tr data-id="${esc(s.id)}"><td class="nowrap">${pos}</td><td class="strong">${esc(s.full_name)}${s.city ? `<span class="sub">${esc(s.city)}</span>` : ""}</td>` +
          `<td>${esc(s.email)}${s.phone ? `<span class="sub">${esc(s.phone)}</span>` : ""}</td><td class="nowrap">${esc(level(s.experience))}</td><td>${esc(s.goal || "")}</td>` +
          `<td class="nowrap">${esc(ago(s.created_at))}${s.invited_at ? `<span class="sub">invited ${esc(ago(s.invited_at))}</span>` : ""}</td>` +
          `<td><select class="fi" data-status style="padding:6px 28px 6px 10px;font-size:13px;min-width:150px"><option value="waiting"${s.status === "waiting" ? " selected" : ""}>Waiting</option><option value="invited"${s.status === "invited" ? " selected" : ""}>Invited</option><option value="purchased"${s.status === "purchased" ? " selected" : ""}>Bought a seat</option><option value="unsubscribed"${s.status === "unsubscribed" ? " selected" : ""}>Left the list</option></select></td>` +
          `<td style="min-width:200px"><textarea class="fi note-edit" data-notes rows="1" placeholder="Add a note">${esc(s.notes || "")}</textarea></td></tr>`;
      }).join("") + `</tbody>`
    : `<tbody><tr><td><div class="empty"><b>Nothing matches.</b>Try a different search or status.</div></td></tr></tbody>`;
  $("wlTbl").querySelectorAll("[data-status]").forEach((sel) => sel.addEventListener("change", async () => {
    const id = sel.closest("tr").dataset.id;
    const { error } = await sb.from("ea_wl_signups").update({ status: sel.value }).eq("id", id);
    if (error) return toast("Could not save: " + esc(error.message));
    const s = signups.find((x) => x.id === id); if (s) s.status = sel.value;
    toast("Status saved");
  }));
  $("wlTbl").querySelectorAll("[data-notes]").forEach((ta) => ta.addEventListener("change", async () => {
    const id = ta.closest("tr").dataset.id;
    const { error } = await sb.from("ea_wl_signups").update({ notes: ta.value.trim() || null }).eq("id", id);
    if (error) return toast("Could not save the note: " + esc(error.message));
    const s = signups.find((x) => x.id === id); if (s) s.notes = ta.value.trim();
    toast("Note saved");
  }));
}
$("wlQ").addEventListener("input", renderWaitlist);
$("wlStatus").addEventListener("change", renderWaitlist);
$("wlCopy").onclick = async () => {
  const emails = filteredSignups().filter((s) => s.status !== "unsubscribed").map((s) => s.email);
  try { await navigator.clipboard.writeText(emails.join(", ")); toast(emails.length + " emails copied"); } catch (_) { toast("Copy blocked by the browser. Use Download CSV."); }
};
$("wlCsv").onclick = () => {
  const rows = [["position", "name", "email", "phone", "city", "level", "goal", "status", "joined", "invited_at", "notes", "source"]];
  filteredSignups().forEach((s) => rows.push([signups.length - signups.findIndex((x) => x.id === s.id), s.full_name, s.email, s.phone, s.city, level(s.experience), s.goal, s.status, s.created_at, s.invited_at, s.notes, s.source]));
  download("agent-waitlist-" + new Date().toISOString().slice(0, 10) + ".csv", csv(rows));
};

/* ---------- events + tiers ---------- */
function renderEvents() {
  const list = events.slice().sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  $("evList").innerHTML = list.length ? list.map((e) => {
    const evTiers = tiers.filter((t) => t.event_id === e.id);
    const sold = (tid) => orders.filter((o) => o.tier_id === tid && o.status === "paid").reduce((a, o) => a + o.qty, 0);
    const holds = (tid) => orders.filter((o) => o.tier_id === tid && o.status === "pending" && Date.now() - new Date(o.created_at) < 30 * 60000).reduce((a, o) => a + o.qty, 0);
    return `<div class="ev" data-id="${esc(e.id)}">
      <div class="row between"><div><h3>${esc(e.title)}</h3><div class="meta">${esc(when(e.starts_at, e.tz, { year: true }))}${e.ends_at ? " to " + esc(new Intl.DateTimeFormat("en-US", { timeZone: e.tz, hour: "numeric", minute: "2-digit" }).format(new Date(e.ends_at))) : ""} · ${e.format === "virtual" ? "Online" : "In person"}${e.venue_label ? " · " + esc(e.venue_label) : ""} · ${e.capacity} seats</div></div>
      <div class="row"><span class="st ${esc(e.status)}">${esc(label(e.status))}</span><button class="btn ghost xs" data-edit>Edit</button>${e.status === "draft" ? `<button class="btn ghost xs" data-set="announced">Show on the page</button>` : ""}${["announced", "sold_out"].includes(e.status) ? `<button class="btn gold xs" data-set="on_sale">Put on sale</button>` : ""}${e.status === "on_sale" ? `<button class="btn ghost xs" data-set="announced">Pause sales</button>` : ""}<a class="btn ghost xs" href="#announce" data-go="announce" data-ev="${esc(e.id)}">Email the list</a></div></div>
      <div class="tierlist">
        <div class="row between"><span class="muted-sm"><b style="color:var(--ink)">Ticket tiers</b> · the page shows these when the date is on sale</span><button class="btn ghost xs" data-tier-new>Add a tier</button></div>
        ${evTiers.length ? evTiers.map((t) => `<div class="tier-row" data-tier="${esc(t.id)}"><div class="nm">${esc(t.name)}${t.description ? `<small>${esc(t.description)}</small>` : ""}${t.status === "hidden" ? `<small>hidden</small>` : ""}</div><div>${t.price_cents === 0 ? "Free" : money(t.price_cents)}</div><div>${sold(t.id)} / ${t.qty}${holds(t.id) ? ` <span class="muted-sm">(+${holds(t.id)} held)</span>` : ""}</div><div class="muted-sm">${t.access === "waitlist" ? "Waitlist link only" : "Anyone"}${t.sales_start ? `<br>opens ${esc(when(t.sales_start, e.tz, { short: true }))}` : ""}${t.sales_end ? `<br>closes ${esc(when(t.sales_end, e.tz, { short: true }))}` : ""}</div><div class="row acts"><button class="btn ghost xs" data-tier-edit>Edit</button><button class="btn danger xs" data-tier-del>Delete</button></div></div>`).join("") : `<p class="muted-sm" style="margin-top:8px">No tiers yet. Add at least one before putting the date on sale. A "Waitlist link only" tier is how the early-bird rate stays exclusive.</p>`}
      </div></div>`;
  }).join("") : `<div class="empty"><b>No dates yet.</b>Add the first one. Keep it as a draft until the details are final, then announce it to the list.</div>`;

  $("evList").querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openEvent(events.find((e) => e.id === b.closest(".ev").dataset.id)));
  $("evList").querySelectorAll("[data-set]").forEach((b) => b.onclick = async () => {
    const id = b.closest(".ev").dataset.id, status = b.dataset.set;
    if (status === "on_sale" && !tiers.some((t) => t.event_id === id && t.status === "active")) return toast("Add a ticket tier first, then put it on sale.");
    const { error } = await sb.from("ea_events").update({ status }).eq("id", id);
    if (error) return toast("Could not update: " + esc(error.message));
    toast(status === "on_sale" ? "On sale. Checkout is open on the page." : (status === "announced" ? "Now visible on the workshop page. Nobody was emailed." : "Saved"));
    await loadAll();
  });
  $("evList").querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); if (a.dataset.ev) $("anEv").value = a.dataset.ev; fillAnnounce(); go("announce"); }));
  $("evList").querySelectorAll("[data-tier-new]").forEach((b) => b.onclick = () => openTier(null, b.closest(".ev").dataset.id));
  $("evList").querySelectorAll("[data-tier-edit]").forEach((b) => b.onclick = () => openTier(tiers.find((t) => t.id === b.closest(".tier-row").dataset.tier)));
  $("evList").querySelectorAll("[data-tier-del]").forEach((b) => b.onclick = async () => {
    const t = tiers.find((x) => x.id === b.closest(".tier-row").dataset.tier);
    if (orders.some((o) => o.tier_id === t.id)) return toast("This tier has orders. Hide it instead of deleting it.");
    if (!(await confirmDlg("Delete " + t.name + "?", "The tier disappears from the page immediately.", "Delete"))) return;
    const { error } = await sb.from("ea_ticket_tiers").delete().eq("id", t.id);
    if (error) return toast("Could not delete: " + esc(error.message));
    toast("Tier deleted"); await loadAll();
  });
}
let editingEvent = null;
function openEvent(e) {
  editingEvent = e || null;
  const f = $("evForm");
  $("evDlgH").textContent = e ? "Edit date" : "New date";
  f.title.value = e ? e.title : "Build Your First AI Agent";
  f.tz.value = e ? e.tz : "America/Chicago";
  f.starts.value = e ? isoToZoned(e.starts_at, e.tz) : "";
  f.ends.value = e && e.ends_at ? isoToZoned(e.ends_at, e.tz) : "";
  f.format.value = e ? e.format : "in_person";
  f.capacity.value = e ? e.capacity : 15;
  f.status.value = e ? e.status : "draft";
  f.venue_label.value = e ? e.venue_label || "" : "Private studio, Dallas-Fort Worth";
  f.venue_address.value = e ? e.venue_address || "" : "";
  f.join_url.value = e ? e.join_url || "" : "";
  f.blurb.value = e ? e.blurb || "" : "";
  $("evDlg").showModal();
}
$("evNew").onclick = () => openEvent(null);
$("evCancel").onclick = () => $("evDlg").close();
$("evForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target, tz = f.tz.value;
  const row = {
    workshop_slug: WORKSHOP, title: f.title.value.trim(), tz, starts_at: zonedToISO(f.starts.value, tz), ends_at: zonedToISO(f.ends.value, tz),
    format: f.format.value, capacity: Number(f.capacity.value) || 15, status: f.status.value,
    venue_label: f.venue_label.value.trim() || null, venue_address: f.venue_address.value.trim() || null, join_url: f.join_url.value.trim() || null, blurb: f.blurb.value.trim() || null,
  };
  if (!row.title || !row.starts_at) return toast("A title and a start time are required.");
  const q = editingEvent ? sb.from("ea_events").update(row).eq("id", editingEvent.id) : sb.from("ea_events").insert(row);
  const { error } = await q;
  if (error) return toast("Could not save: " + esc(error.message));
  $("evDlg").close(); toast(editingEvent ? "Date saved" : "Date added. Add a ticket tier next.");
  await loadAll();
});
let editingTier = null, tierEvent = null;
function openTier(t, eventId) {
  editingTier = t || null; tierEvent = t ? t.event_id : eventId;
  const e = events.find((x) => x.id === tierEvent), tz = e ? e.tz : "America/Chicago", f = $("tierForm");
  $("tierDlgH").textContent = t ? "Edit tier" : "New ticket tier";
  f.name.value = t ? t.name : ""; f.price.value = t ? (t.price_cents / 100).toFixed(2) : ""; f.qty.value = t ? t.qty : 5;
  f.access.value = t ? t.access : "public"; f.sales_start.value = t && t.sales_start ? isoToZoned(t.sales_start, tz) : ""; f.sales_end.value = t && t.sales_end ? isoToZoned(t.sales_end, tz) : "";
  f.description.value = t ? t.description || "" : ""; f.sort.value = t ? t.sort : tiers.filter((x) => x.event_id === tierEvent).length; f.status.value = t ? t.status : "active";
  $("tierDlg").showModal();
}
$("tierCancel").onclick = () => $("tierDlg").close();
$("tierForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target, e = events.find((x) => x.id === tierEvent), tz = e ? e.tz : "America/Chicago";
  const row = {
    event_id: tierEvent, name: f.name.value.trim(), price_cents: Math.round(Number(f.price.value || 0) * 100), qty: Number(f.qty.value) || 1,
    access: f.access.value, sales_start: zonedToISO(f.sales_start.value, tz), sales_end: zonedToISO(f.sales_end.value, tz),
    description: f.description.value.trim() || null, sort: Number(f.sort.value) || 0, status: f.status.value,
  };
  if (!row.name) return toast("Give the tier a name.");
  const q = editingTier ? sb.from("ea_ticket_tiers").update(row).eq("id", editingTier.id) : sb.from("ea_ticket_tiers").insert(row);
  const { error } = await q;
  if (error) return toast("Could not save: " + esc(error.message));
  $("tierDlg").close(); toast("Tier saved"); await loadAll();
});

/* ---------- orders + check-in ---------- */
function renderOrders() {
  const sel = $("orEv"), cur = sel.value;
  sel.innerHTML = `<option value="">Every date</option>` + events.map((e) => `<option value="${esc(e.id)}"${cur === e.id ? " selected" : ""}>${esc(e.title)} · ${esc(when(e.starts_at, e.tz, { short: true }))}</option>`).join("");
  const q = ($("orQ").value || "").trim().toLowerCase(), ev = sel.value, st = $("orStatus").value;
  const list = orders.filter((o) => (!ev || o.event_id === ev) && (!st || o.status === st) && (!q || [o.full_name, o.email, ...tickets.filter((k) => k.order_id === o.id).map((k) => k.code)].join(" ").toLowerCase().includes(q)));
  const paid = list.filter((o) => o.status === "paid");
  $("orSum").textContent = paid.reduce((a, o) => a + o.qty, 0) + " seats · " + money(paid.reduce((a, o) => a + o.amount_cents, 0));
  $("orTbl").innerHTML = list.length
    ? `<thead><tr><th>When</th><th>Buyer</th><th>Date</th><th>Tier</th><th>Seats</th><th>Paid</th><th>Status</th><th>Seat codes</th></tr></thead><tbody>` +
      list.map((o) => {
        const e = events.find((x) => x.id === o.event_id), t = tiers.find((x) => x.id === o.tier_id), ks = tickets.filter((k) => k.order_id === o.id);
        return `<tr><td class="nowrap">${esc(ago(o.created_at))}</td><td class="strong">${esc(o.full_name || "")}<span class="sub">${esc(o.email)}</span></td><td>${e ? esc(when(e.starts_at, e.tz, { short: true })) : ""}</td><td>${t ? esc(t.name) : ""}</td><td>${o.qty}</td><td>${money(o.amount_cents)}</td><td><span class="st ${esc(o.status)}">${esc(label(o.status))}</span></td>` +
          `<td><div class="codes">${ks.map((k) => `<button class="code${k.status === "void" ? " void" : k.checked_in_at ? " done" : ""}" data-ticket="${esc(k.id)}" title="${k.checked_in_at ? "Checked in " + esc(ago(k.checked_in_at)) : "Tap to check in"}"${k.status === "void" ? " disabled" : ""}>${esc(k.code)}${k.checked_in_at ? " ✓" : ""}</button>`).join("") || `<span class="muted-sm">${o.status === "pending" ? "Waiting on Stripe" : ""}</span>`}</div></td></tr>`;
      }).join("") + `</tbody>`
    : `<tbody><tr><td><div class="empty"><b>No orders yet.</b>Seats sold through the page land here, with their codes for check-in on the night.</div></td></tr></tbody>`;
  $("orTbl").querySelectorAll("[data-ticket]").forEach((b) => b.onclick = async () => {
    const k = tickets.find((x) => x.id === b.dataset.ticket);
    // Checking someone in is cheap to undo. Un-checking someone already in the room is not.
    if (k.checked_in_at && !(await confirmDlg("Undo check-in for " + k.code + "?", "This marks them as not yet arrived.", "Undo check-in"))) return;
    const { error } = await sb.from("ea_tickets").update({ checked_in_at: k.checked_in_at ? null : new Date().toISOString() }).eq("id", k.id);
    if (error) return toast("Could not update: " + esc(error.message));
    k.checked_in_at = k.checked_in_at ? null : new Date().toISOString();
    toast(k.checked_in_at ? esc(k.code) + " checked in" : esc(k.code) + " check-in undone"); renderOrders();
  });
}
["orQ", "orEv", "orStatus"].forEach((id) => $(id).addEventListener(id === "orQ" ? "input" : "change", renderOrders));
$("orCsv").onclick = () => {
  const rows = [["created", "name", "email", "event", "tier", "seats", "amount", "status", "codes", "checked_in"]];
  orders.forEach((o) => { const e = events.find((x) => x.id === o.event_id), t = tiers.find((x) => x.id === o.tier_id), ks = tickets.filter((k) => k.order_id === o.id); rows.push([o.created_at, o.full_name, o.email, e ? e.title + " " + when(e.starts_at, e.tz, { short: true, year: true }) : "", t ? t.name : "", o.qty, (o.amount_cents / 100).toFixed(2), o.status, ks.map((k) => k.code).join(" "), ks.filter((k) => k.checked_in_at).length]); });
  download("agent-orders-" + new Date().toISOString().slice(0, 10) + ".csv", csv(rows));
};

/* ---------- announce ---------- */
function renderAnnounce() {
  const sel = $("anEv"), cur = sel.value;
  const options = events.filter((e) => !["past", "canceled"].includes(e.status));
  sel.innerHTML = `<option value="">No specific date (just a note to the list)</option>` + options.map((e) => `<option value="${esc(e.id)}"${cur === e.id ? " selected" : ""}>${esc(e.title)} · ${esc(when(e.starts_at, e.tz, { short: true }))} (${esc(label(e.status))})</option>`).join("");
  if (!cur && options.length) sel.value = options[0].id;
  if (!$("anSubject").value) fillAnnounce();
  preview();
}
function fillAnnounce() {
  const e = events.find((x) => x.id === $("anEv").value);
  $("anSubject").value = e ? "The date is set: " + e.title : "A note about Build Your First AI Agent";
  $("anBody").value = e
    ? `{name}, you asked to hear first, so here it is before anyone else.\n\n${e.title} is happening ${when(e.starts_at, e.tz)}${e.venue_label ? ", " + e.venue_label : ""}. One night, no code, and you leave with an agent that does a real job for you.\n\nYour button below is yours alone. It opens the waitlist rate before the public sale, and the room is small on purpose, so the first seats go to the first replies.\n\nQuestions? Reply to this email. It comes straight to me.`
    : `{name}, a quick note from me about Build Your First AI Agent.\n\nThe first public date is close. You are on the list, so you hear before anyone else, and your button below will open the waitlist rate the moment seats go live.\n\nReply to this email with anything you want the night to cover.`;
  preview();
}
function preview() {
  const e = events.find((x) => x.id === $("anEv").value);
  const paras = ($("anBody").value || "").replace(/\{name\}/g, "Nelson").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#33415b">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const dateBox = e ? `<div style="background:#f5f7fc;border-radius:14px;padding:16px 20px;margin:0 0 18px;font-size:15px;line-height:1.7;color:#33415b"><b>${esc(e.title)}</b><br>${esc(when(e.starts_at, e.tz))}<br>${esc(e.format === "virtual" ? "Online" : (e.venue_label || "Dallas-Fort Worth"))}</div>` : "";
  const html = `<!doctype html><body style="margin:0;background:#f5f7fc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><div style="padding:22px 12px"><div style="max-width:560px;margin:0 auto">
    <div style="background:#04123a;border-radius:18px 18px 0 0;padding:18px 24px;color:#fff;font-weight:700;font-size:16px"><img src="${SITE}/assets/logo-email.png" width="34" height="34" alt="" style="vertical-align:middle;border-radius:8px;margin-right:10px">Taylormade Academy</div>
    <div style="background:#fff;border:1px solid #e4e9f1;border-top:0;border-radius:0 0 18px 18px;padding:30px 28px 26px">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#0730ad;margin-bottom:12px"><span style="display:inline-block;width:20px;height:3px;background:#f2b705;border-radius:2px;vertical-align:middle;margin-right:10px"></span>From the waitlist</div>
    <h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;letter-spacing:-.02em;color:#0a1733">${esc($("anSubject").value)}</h1>${paras}${dateBox}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px"><tr><td style="background:#0b40e0;border-radius:980px"><a style="display:inline-block;padding:14px 26px;font-weight:700;font-size:15px;color:#fff;text-decoration:none">${esc($("anCta").value || "Open my early-bird link")} &rarr;</a></td></tr></table>
    <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#94a3b8">That button is yours alone. It unlocks the waitlist rate before the public sale.</p>
    <p style="margin:22px 0 0;font-size:15px;line-height:1.6;color:#33415b">Nelson<br><span style="color:#5d6b84">Taylormade Academy, Dallas-Fort Worth</span></p></div>
    <p style="margin:16px 8px 0;font-size:12px;line-height:1.6;color:#94a3b8">You are on the Build Your First AI Agent waitlist at taylormadeacademy.com/agent. <a style="color:#94a3b8">Leave the list</a>.</p></div></div></body>`;
  $("anPreview").srcdoc = html;
}
$("anEv").addEventListener("change", fillAnnounce);
["anSubject", "anBody", "anCta"].forEach((id) => $(id).addEventListener("input", preview));
async function announce(testTo) {
  const body = { event_id: $("anEv").value || undefined, subject: $("anSubject").value.trim(), body_text: $("anBody").value.trim(), cta_label: $("anCta").value.trim() };
  if (testTo) body.test_to = testTo;
  const { data: { session: s } } = await sb.auth.getSession();
  const r = await fetch(CFG.FUNCTIONS_BASE + "/ea-waitlist-announce", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ("HTTP " + r.status));
  return d;
}
$("anTest").onclick = async () => {
  const b = $("anTest"); b.disabled = true; b.textContent = "Sending...";
  try { await announce(session.user.email); $("anResult").textContent = "Test sent to " + session.user.email + ". Check it on your phone, then send to the list."; toast("Test sent"); }
  catch (e) { $("anResult").textContent = "The test did not send: " + e.message; }
  b.disabled = false; b.textContent = "Send me a test";
};
$("anSend").onclick = async () => {
  const n = signups.filter((s) => ["waiting", "invited"].includes(s.status)).length;
  if (!n) return toast("Nobody on the list to send to yet.");
  if (!$("anSubject").value.trim() || $("anBody").value.trim().length < 10) return toast("Write a subject and a message first.");
  if (!(await confirmDlg("Send to " + n + " people?", "Each person gets their own early-bird button. This cannot be unsent.", "Send to " + n))) return;
  const b = $("anSend"); b.disabled = true; b.textContent = "Sending...";
  try { const d = await announce(); $("anResult").textContent = "Sent to " + d.sent + " of " + d.total + (d.failed ? ". " + d.failed + " failed, try again for those." : "."); toast("Sent to " + d.sent); await loadAll(); }
  catch (e) { $("anResult").textContent = "The send did not go through: " + e.message; }
  b.disabled = false; b.textContent = "Send to the list";
};

/* ---------- boot ---------- */
await loadAll();
go(location.hash.slice(1) || "overview");
