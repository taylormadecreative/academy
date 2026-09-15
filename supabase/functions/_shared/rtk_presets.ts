// The room presets (Academy + HT), and the one call that makes sure Cloudflare has whichever
// pair a room's join needs. Nelson (or a host like Dr. Gray) has no shell token on the road, so
// the join function's room branch calls ensurePresets(cf, [hostPreset, guestPreset]) the first
// time a room is opened: list the app's presets, create any of the given names that is missing,
// and re-send a body if a guest's file-sharing switches are not off or the live copy disagrees
// with the body on transcription (HT guests are captioned since 9/15). Idempotent per name (cached
// per isolate, one Set<string> of confirmed-good names); never throws for a Cloudflare problem —
// a preset problem must not block a join (the participant POST will 4xx and the page says
// cloudflare_<status>). An unknown name (not in PRESET_BODIES) IS a throw — that is a bug in the
// caller (a room row with a typo'd preset column), not a Cloudflare hiccup.
//
// PRESET_BODIES are the committed JSON files, verbatim (rtk_presets_test.ts proves they match):
//   scripts/rtk-presets/tma-class-host.json   — a copy of opil-host.json, name changed
//   scripts/rtk-presets/tma-class-guest.json  — a copy of opil-student.json, name changed,
//                                               chat.public.files and chat.private.files false
//   scripts/rtk-presets/ht-class-host.json    — HT brand colors (maroon/gold), same shape
//   scripts/rtk-presets/ht-class-guest.json   — HT brand colors, chat files off like every guest,
//                                               transcription_enabled true (captions show the guest)
import type { JoinDeps } from "../ea-rtk-join/handler.ts";
/* The two OPIL presets whose bodies changed on 9/15 (students and judges are transcribed too, so
   the Transcript tab and Save transcript carry the whole room, not just the host). Copies of the
   committed files, because a function bundle cannot reach scripts/; rtk_presets_test.ts proves
   they match. They are never CREATED here — scripts/rtk-presets.sh made them — only brought in
   line when Cloudflare's copy disagrees on transcription. */
import opilStudent from "./rtk-presets/opil-student.json" with { type: "json" };
import opilJudge from "./rtk-presets/opil-judge.json" with { type: "json" };

const UI = {
  design_tokens: {
    theme: "darkest",
    font_family: "Inter",
    border_radius: "rounded",
    border_width: "thin",
    colors: {
      brand: { "300": "#fee38a", "400": "#fdd45a", "500": "#fdc921", "600": "#d9a90f", "700": "#b28a0a" },
      background: { "600": "#22345f", "700": "#162650", "800": "#0f1d44", "900": "#0a1733", "1000": "#04123a" },
      text: "#ffffff",
      text_on_brand: "#04123a",
      video_bg: "#0a1733",
      danger: "#ff5c5c",
      success: "#3ddc97",
      warning: "#fdc921",
    },
    logo: "https://taylormadeacademy.com/assets/logo-nav.webp",
    spacing_base: 4,
  },
};

const HT_UI = {
  design_tokens: {
    theme: "darkest",
    font_family: "Inter",
    border_radius: "rounded",
    border_width: "thin",
    colors: {
      brand: { "300": "#FFE580", "400": "#FFD940", "500": "#FFCC00", "600": "#D9AD00", "700": "#B38F00" },
      background: { "600": "#8F0000", "700": "#660100", "800": "#4D0000", "900": "#3B0000", "1000": "#291C14" },
      text: "#FFFFFF",
      text_on_brand: "#3B0000",
      video_bg: "#3B0000",
      danger: "#FA2626",
      success: "#94CCAB",
      warning: "#F2B00D",
    },
    logo: "https://taylormadeacademy.com/ht/img/ht-monogram-gold.png",
    spacing_base: 4,
  },
};

const CONFIG = {
  view_type: "GROUP_CALL",
  max_video_streams: { desktop: 9, mobile: 4 },
  max_screenshare_count: 1,
  media: {
    video: { frame_rate: 24, quality: "hd", simulcast: true },
    screenshare: { frame_rate: 5, quality: "hd" },
  },
};

export const PRESET_BODIES: Record<"tma-class-host" | "tma-class-guest" | "ht-class-host" | "ht-class-guest", Record<string, unknown>> = {
  "tma-class-host": {
    name: "tma-class-host",
    config: CONFIG,
    permissions: {
      media: { audio: { can_produce: "ALLOWED" }, video: { can_produce: "ALLOWED" }, screenshare: { can_produce: "ALLOWED" } },
      stage_enabled: false,
      stage_access: "ALLOWED",
      accept_stage_requests: true,
      can_accept_production_requests: true,
      accept_waiting_requests: true,
      kick_participant: true,
      pin_participant: true,
      can_spotlight: true,
      disable_participant_audio: true,
      disable_participant_video: true,
      disable_participant_screensharing: true,
      can_change_participant_permissions: true,
      can_record: true,
      can_livestream: false,
      chat: {
        public: { can_send: true, text: true, files: true },
        private: { can_send: true, can_receive: true, text: true, files: true },
      },
      polls: { can_create: true, can_view: true, can_vote: true },
      plugins: { can_start: true, can_close: true, can_edit_config: true, config: {} },
      connected_meetings: { can_alter_connected_meetings: true, can_switch_connected_meetings: true, can_switch_to_parent_meeting: true },
      show_participant_list: true,
      can_edit_display_name: true,
      hidden_participant: false,
      waiting_room_type: "SKIP",
      recorder_type: "NONE",
      transcription_enabled: true,
    },
    ui: UI,
  },
  "tma-class-guest": {
    name: "tma-class-guest",
    config: CONFIG,
    permissions: {
      media: { audio: { can_produce: "ALLOWED" }, video: { can_produce: "ALLOWED" }, screenshare: { can_produce: "ALLOWED" } },
      stage_enabled: false,
      stage_access: "ALLOWED",
      accept_stage_requests: false,
      can_accept_production_requests: false,
      accept_waiting_requests: false,
      kick_participant: false,
      pin_participant: false,
      can_spotlight: false,
      disable_participant_audio: false,
      disable_participant_video: false,
      disable_participant_screensharing: false,
      can_change_participant_permissions: false,
      can_record: false,
      can_livestream: false,
      chat: {
        public: { can_send: true, text: true, files: false },
        private: { can_send: true, can_receive: true, text: true, files: false },
      },
      polls: { can_create: false, can_view: true, can_vote: true },
      plugins: { can_start: false, can_close: false, can_edit_config: false, config: {} },
      connected_meetings: { can_alter_connected_meetings: false, can_switch_connected_meetings: true, can_switch_to_parent_meeting: true },
      show_participant_list: true,
      can_edit_display_name: false,
      hidden_participant: false,
      waiting_room_type: "SKIP",
      recorder_type: "NONE",
      transcription_enabled: false,
    },
    ui: UI,
  },
  "ht-class-host": {
    name: "ht-class-host",
    config: CONFIG,
    permissions: {
      media: { audio: { can_produce: "ALLOWED" }, video: { can_produce: "ALLOWED" }, screenshare: { can_produce: "ALLOWED" } },
      stage_enabled: false,
      stage_access: "ALLOWED",
      accept_stage_requests: true,
      can_accept_production_requests: true,
      accept_waiting_requests: true,
      kick_participant: true,
      pin_participant: true,
      can_spotlight: true,
      disable_participant_audio: true,
      disable_participant_video: true,
      disable_participant_screensharing: true,
      can_change_participant_permissions: true,
      can_record: true,
      can_livestream: false,
      chat: {
        public: { can_send: true, text: true, files: true },
        private: { can_send: true, can_receive: true, text: true, files: true },
      },
      polls: { can_create: true, can_view: true, can_vote: true },
      plugins: { can_start: true, can_close: true, can_edit_config: true, config: {} },
      connected_meetings: { can_alter_connected_meetings: true, can_switch_connected_meetings: true, can_switch_to_parent_meeting: true },
      show_participant_list: true,
      can_edit_display_name: true,
      hidden_participant: false,
      waiting_room_type: "SKIP",
      recorder_type: "NONE",
      transcription_enabled: true,
    },
    ui: HT_UI,
  },
  "ht-class-guest": {
    name: "ht-class-guest",
    config: CONFIG,
    permissions: {
      media: { audio: { can_produce: "ALLOWED" }, video: { can_produce: "ALLOWED" }, screenshare: { can_produce: "ALLOWED" } },
      stage_enabled: false,
      stage_access: "ALLOWED",
      accept_stage_requests: false,
      can_accept_production_requests: false,
      accept_waiting_requests: false,
      kick_participant: false,
      pin_participant: false,
      can_spotlight: false,
      disable_participant_audio: false,
      disable_participant_video: false,
      disable_participant_screensharing: false,
      can_change_participant_permissions: false,
      can_record: false,
      can_livestream: false,
      chat: {
        public: { can_send: true, text: true, files: false },
        private: { can_send: true, can_receive: true, text: true, files: false },
      },
      polls: { can_create: false, can_view: true, can_vote: true },
      plugins: { can_start: false, can_close: false, can_edit_config: false, config: {} },
      connected_meetings: { can_alter_connected_meetings: false, can_switch_connected_meetings: true, can_switch_to_parent_meeting: true },
      show_participant_list: true,
      can_edit_display_name: false,
      hidden_participant: false,
      waiting_room_type: "SKIP",
      recorder_type: "NONE",
      transcription_enabled: true,
    },
    ui: HT_UI,
  },
};

type PresetName = keyof typeof PRESET_BODIES;

/* every name ensurePresets has confirmed is right on Cloudflare this isolate — a Set, not one
   boolean, because different rooms need different name pairs (Academy vs HT) in the same warm
   instance; a name already in here is skipped without even a GET */
const okNames = new Set<string>();

/* Cloudflare answers GET /presets as [ {id,name,…} ] or { data: [ … ] } (rtkClient already peels
   one `data`); walk down `.data` until an array turns up, else treat it as an empty list. */
function presetList(data: unknown): Record<string, unknown>[] {
  let cur: unknown = data;
  for (let i = 0; i < 3 && cur && typeof cur === "object" && !Array.isArray(cur); i++) cur = (cur as Record<string, unknown>).data;
  return Array.isArray(cur) ? cur.filter((x) => x && typeof x === "object").map((x) => x as Record<string, unknown>) : [];
}

function guestFilesOff(preset: Record<string, unknown>): boolean {
  const perms = (preset.permissions || {}) as Record<string, unknown>;
  const chat = (perms.chat || {}) as Record<string, unknown>;
  const pub = (chat.public || {}) as Record<string, unknown>;
  const priv = (chat.private || {}) as Record<string, unknown>;
  return pub.files === false && priv.files === false;
}

/* whether a preset body (ours, or Cloudflare's live copy) has transcription on */
function transcribes(preset: Record<string, unknown>): boolean {
  return ((preset.permissions || {}) as Record<string, unknown>).transcription_enabled === true;
}

/* a live preset is re-sent when a guest's file switches are on, or when it disagrees with our
   body on transcription either way (ht-class-guest went true on 9/15; tma-class-guest stays
   false, so an Academy guest preset that matches is left alone) */
function needsPatch(name: PresetName, found: Record<string, unknown>): boolean {
  if (name.endsWith("-guest") && !guestFilesOff(found)) return true;
  return transcribes(found) !== transcribes(PRESET_BODIES[name]);
}

export async function ensurePresets(cf: JoinDeps["cf"], names: string[]): Promise<void> {
  /* a name not in PRESET_BODIES is a caller bug (a room row with a typo'd preset column), not a
     Cloudflare hiccup — that gets a real throw, checked before any network call and before the cache */
  for (const name of names) if (!(name in PRESET_BODIES)) throw new Error(`[rtk_presets] unknown preset name: ${name}`);
  const need = names.filter((n) => !okNames.has(n));
  if (need.length === 0) return;
  try {
    const listed = await cf("GET", "/presets");
    /* 404 = the app has no presets yet (the same convention ea-rtk-record uses for /webhooks) */
    if (!listed.ok && listed.status !== 404) { console.warn("[rtk_presets] list failed", listed.status); return; }
    const have = listed.ok ? presetList(listed.data) : [];
    for (const name of need as PresetName[]) {
      const found = have.find((p) => p.name === name);
      let ok = true;
      if (!found) {
        const r = await cf("POST", "/presets", PRESET_BODIES[name]);
        if (!r.ok) { console.warn("[rtk_presets] create failed", name, r.status); ok = false; }
      } else if (needsPatch(name, found)) {
        const r = await cf("PATCH", `/presets/${found.id}`, PRESET_BODIES[name]);
        if (!r.ok) { console.warn("[rtk_presets] update failed", name, r.status); ok = false; }
      }
      if (ok) okNames.add(name);
    }
  } catch (e) {
    console.warn("[rtk_presets]", String((e && (e as Error).message) || e));
  }
}

/* ── OPIL (9/15): students and judges are transcribed too ───────────────────────────────────
   Cloudflare transcribes per PRESET, and only opil-host had it on, so a saved transcript was the
   host talking. The two OPIL bodies whose flag changed ship here as copies of the committed
   files (a bundle cannot reach scripts/; rtk_presets_test.ts proves they match). They are never
   CREATED here — scripts/rtk-presets.sh made them — only brought in line when Cloudflare's copy
   disagrees on transcription. Same contract as ensurePresets: never throws, cached once right. */
export const OPIL_BODIES = { "opil-student": opilStudent, "opil-judge": opilJudge } as const;
const OPIL_NAMES = ["opil-student", "opil-judge"] as const;
let opilOk = false;

export async function ensureOpilPresets(cf: JoinDeps["cf"]): Promise<void> {
  if (opilOk) return;
  try {
    const listed = await cf("GET", "/presets");
    if (!listed.ok) { console.warn("[rtk_presets] list failed", listed.status); return; }
    const have = presetList(listed.data);
    let allGood = true;
    for (const name of OPIL_NAMES) {
      const found = have.find((p) => p.name === name);
      if (!found || transcribes(found) === OPIL_BODIES[name].permissions.transcription_enabled) continue;
      const r = await cf("PATCH", `/presets/${found.id}`, OPIL_BODIES[name]);
      if (!r.ok) { console.warn("[rtk_presets] update failed", name, r.status); allGood = false; }
    }
    opilOk = allGood;
  } catch (e) {
    console.warn("[rtk_presets]", String((e && (e as Error).message) || e));
  }
}
