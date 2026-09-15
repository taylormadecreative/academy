// The two Academy room presets, and the one call that makes sure Cloudflare has them.
// Nelson has no shell token on the road, so the join function's room branch calls
// ensurePresets() the first time he opens the room: list the app's presets, create either
// of the two that is missing, and re-send the guest body if its file-sharing switches are
// not off. Idempotent; cached per isolate once everything is right; never throws — a preset
// problem must not block a join (the participant POST will 4xx and the page says cloudflare_<status>).
//
// PRESET_BODIES are the committed JSON files, verbatim (rtk_presets_test.ts proves they match):
//   scripts/rtk-presets/tma-class-host.json   — a copy of opil-host.json, name changed
//   scripts/rtk-presets/tma-class-guest.json  — a copy of opil-student.json, name changed,
//                                               chat.public.files and chat.private.files false
import type { JoinDeps } from "../ea-rtk-join/handler.ts";

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

const CONFIG = {
  view_type: "GROUP_CALL",
  max_video_streams: { desktop: 9, mobile: 4 },
  max_screenshare_count: 1,
  media: {
    video: { frame_rate: 24, quality: "hd", simulcast: true },
    screenshare: { frame_rate: 5, quality: "hd" },
  },
};

export const PRESET_BODIES: Record<"tma-class-host" | "tma-class-guest", Record<string, unknown>> = {
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
};

const NAMES = ["tma-class-host", "tma-class-guest"] as const;

/* set once every preset is known to be right; a failed run leaves it false so the next join tries again */
let ensured = false;

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

export async function ensurePresets(cf: JoinDeps["cf"]): Promise<void> {
  if (ensured) return;
  try {
    const listed = await cf("GET", "/presets");
    /* 404 = the app has no presets yet (the same convention ea-rtk-record uses for /webhooks) */
    if (!listed.ok && listed.status !== 404) { console.warn("[rtk_presets] list failed", listed.status); return; }
    const have = listed.ok ? presetList(listed.data) : [];
    let allGood = true;
    for (const name of NAMES) {
      const found = have.find((p) => p.name === name);
      if (!found) {
        const r = await cf("POST", "/presets", PRESET_BODIES[name]);
        if (!r.ok) { console.warn("[rtk_presets] create failed", name, r.status); allGood = false; }
      } else if (name === "tma-class-guest" && !guestFilesOff(found)) {
        const r = await cf("PATCH", `/presets/${found.id}`, PRESET_BODIES[name]);
        if (!r.ok) { console.warn("[rtk_presets] update failed", name, r.status); allGood = false; }
      }
    }
    ensured = allGood;
  } catch (e) {
    console.warn("[rtk_presets]", String((e && (e as Error).message) || e));
  }
}
