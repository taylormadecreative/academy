// Taylormade Academy brand tokens, tuned for a dark (navy) surface.
// Sourced from css/build-mode.css: ink-panel #04123a, blue #0b40e0, gold #fdc921 / #f2b705.
export const COLOR = {
  navy: "#04123a", // crest navy (primary surface)
  navyDeep: "#020a1f", // gradient floor
  navyLift: "#0a205c", // upper glow tone
  gold: "#fdc921", // signature accent
  goldDeep: "#f2b705",
  blue: "#0b40e0", // brand primary
  blueBright: "#5b86ff", // brightened brand blue for legibility on navy
  cream: "#f7f9ff", // headline ink on navy
  slate: "#bcc8e6", // body copy on navy
  slateDim: "#7d8cb2", // captions / footnotes
  inkOnGold: "#04123a", // text sitting on a gold fill
};

// Composition geometry (matches the source clip: 720x1280, 24fps).
export const W = 720;
export const H = 1280;
export const FPS = 24;

// Timeline (frames).
export const SRC_FRAMES = 241; // full source clip
export const OVERLAP = 16; // crossfade: end card bg fades over the video tail
export const CARD_HOLD = 150; // dwell time on the finished card
export const CARD_START = SRC_FRAMES - OVERLAP; // 225
export const CARD_LEN = OVERLAP + CARD_HOLD; // 166
export const TOTAL = CARD_START + CARD_LEN; // 391

// Strong, intentional easings (Emil-style — no weak built-ins, no bounce on UI).
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
