// style.mjs — the locked Taylormade Academy visual DNA + format presets.
// Every prompt the machine builds is wrapped with STYLE so output stays on-brand.

// The single source of truth for "what Academy content looks like."
// Edit this block to evolve the aesthetic everywhere at once.
export const STYLE = [
  "TAYLORMADE ACADEMY brand visual style — premium creator-academy aesthetic.",
  "Color world: deep navy ink (#0a1733) and royal cobalt blue as primary darks,",
  "bright warm gold (#fdc921, deeper #f2b705) as the single accent, and clean",
  "near-white paper (#fcfdff) for breathing room. No muddy gradients, no teal,",
  "no purple, no 2010s web gradients.",
  "Typography feel: bold, tight, confident display lettering (Space Grotesk energy)",
  "with ONE key word underlined by a hand-laid solid gold highlight bar; clean,",
  "even body text (Inter energy). Type is crisp, perfectly spelled, well-kerned.",
  "Graphic language: clean editorial layout with generous negative space; rounded",
  "pill buttons and rounded cards with soft realistic drop shadows; at most a few",
  "small 4-point gold/blue sparkle accents, used sparingly. Do NOT place a large",
  "blue blob / colored blob shape behind the subject — keep the background clean.",
  "Lighting + finish: crisp optimistic studio lighting, modern, high-end,",
  "uncluttered, photoreal where photoreal, flat-vector-clean where graphic.",
  "Mood: aspirational, motivational, Black creative excellence — build, ship, create.",
  "IMPORTANT: do NOT draw any logo, wordmark, or 'Taylormade' / 'Academy' text —",
  "leave the bottom-center area clear; the real logo is composited in afterward.",
  "Avoid: stock-photo cheese, clutter, watermarks, gibberish text, extra fingers,",
  "distorted faces.",
].join(" ");

// Nelson's IDENTITY — face/hair/build only, NEVER the outfit. The outfit is a
// per-post variable (see OUTFITS / --outfit). Used as the text description when
// no reference photo is supplied; when refs ARE supplied the engine locks the
// real face from the photos and this just reinforces it.
export const IDENTITY =
  "a confident Black man in his mid-30s with medium-length two-strand twists / locs " +
  "pulled back, a full goatee and short beard, warm dark-brown skin, and arm tattoos";

// On-brand wardrobe rotation — navy / royal-blue / gold / cream / white that POP
// against the paper-white or navy backgrounds. The outfit ALWAYS changes per post;
// pick one that fits the vibe, or pass --outfit "...". Never the ref's white tank,
// and avoid dull grays/blacks that don't pop.
export const OUTFITS = [
  "a navy-and-gold varsity letterman jacket over a crisp white tee",
  "a bold royal-blue bomber jacket over a white tee",
  "a clean white crewneck sweater with a thin gold chain",
  "a mustard-gold hoodie",
  "a tailored navy blazer over a white tee with a gold chain",
  "a warm cream chunky-knit sweater",
  "a royal-blue denim jacket over a white tee",
  "a crisp white button-up, sleeves rolled, with navy-and-gold accents",
];

// Deterministic-but-varying outfit pick from the topic, so each post differs
// without randomness. Override always wins.
export function pickOutfit(seed = "", override) {
  if (override) return override;
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return OUTFITS[h % OUTFITS.length];
}

// Build the identity + outfit clause for person-featuring recipes.
export function identityClause({ outfit, hasRefs, keepOutfit }) {
  const teeRule =
    " Any tee or shirt visible under the outfit must be WHITE or cream — never black, " +
    "never dark gray. Keep the look bright and on-brand.";
  if (keepOutfit && hasRefs) {
    return (
      `The person is the SAME REAL MAN in the attached reference photo — preserve his EXACT ` +
      `face, twists/locs, beard, AND his exact outfit: the navy-and-gold "Taylormade Creative" ` +
      `varsity letterman jacket (with the AI / Design / Photography / Video patches on the sleeve) ` +
      `over a white tee. Do NOT change his face or clothing; only the background scene and graphics ` +
      `change around him. Natural, flattering, true-to-life.`
    );
  }
  if (hasRefs) {
    return (
      `The person is the SAME REAL MAN in the attached reference photo(s) — preserve his ` +
      `EXACT face, skin tone, twists/locs hairstyle and beard precisely; do not alter his ` +
      `face or identity. IGNORE the plain white tank top in the references and instead dress ` +
      `him in ${outfit}.${teeRule} Natural, flattering, true-to-life.`
    );
  }
  return `The hero is ${IDENTITY}, wearing ${outfit}, with a warm authentic expression.${teeRule}`;
}

// Social format presets. gemini takes an exact aspect ratio; openai is limited to
// a few sizes, so we pick the closest portrait/landscape/square and note the crop.
export const FORMATS = {
  post:    { label: "IG feed 4:5",     ar: "4:5",  oaiSize: "1024x1536", px: "1080x1350", note: "crop openai 2:3 -> 4:5" },
  reel:    { label: "Reel/Story 9:16", ar: "9:16", oaiSize: "1024x1536", px: "1080x1920", note: "prefer gemini for true 9:16" },
  story:   { label: "Story 9:16",      ar: "9:16", oaiSize: "1024x1536", px: "1080x1920", note: "prefer gemini for true 9:16" },
  square:  { label: "Square 1:1",      ar: "1:1",  oaiSize: "1024x1024", px: "1080x1080", note: "" },
  wide:    { label: "Wide 16:9",       ar: "16:9", oaiSize: "1536x1024", px: "1920x1080", note: "" },
};

export function resolveFormat(name = "post") {
  const f = FORMATS[name] || FORMATS.post;
  const [w, h] = f.px.split("x").map(Number);
  return { ...f, w, h }; // attach exact pixel dims so every output crops to them
}

// Aspect ratios Nano Banana 2 (Gemini) accepts — we snap a custom size to the nearest.
const GEMINI_ARS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "9:21"];
function nearestGeminiAR(ratio) {
  let best = "1:1", diff = Infinity;
  for (const ar of GEMINI_ARS) {
    const [a, b] = ar.split(":").map(Number);
    const d = Math.abs(a / b - ratio);
    if (d < diff) { diff = d; best = ar; }
  }
  return best;
}
function nearestOpenAISize(ratio) {
  if (ratio > 1.2) return "1536x1024";   // landscape
  if (ratio < 0.84) return "1024x1536";  // portrait
  return "1024x1024";                     // square-ish
}

// Parse "1080x1350" / "1080×1350" / "1080,1350" into clamped {w,h}, or null.
export function parseSize(s) {
  const m = String(s).trim().match(/^(\d{2,5})\s*[x×,]\s*(\d{2,5})$/i);
  if (!m) return null;
  const clamp = (n) => Math.max(256, Math.min(4096, parseInt(n, 10)));
  return { w: clamp(m[1]), h: clamp(m[2]) };
}

// A format object for an arbitrary pixel size: generate at the nearest ratio per
// engine, then crop/scale to exactly w×h afterward (see brand.fitTo).
export function customFormat({ w, h }) {
  const ratio = w / h;
  return {
    label: `${w}×${h}`, ar: nearestGeminiAR(ratio), oaiSize: nearestOpenAISize(ratio),
    px: `${w}x${h}`, w, h, custom: true,
  };
}

// Wrap a recipe's creative direction with the locked style + format guidance,
// and (for person-featuring recipes) the identity + per-post outfit clause.
export function composePrompt({ direction, format, withText, person, outfit, hasRefs, keepOutfit, note, brandCorner, reserveBottom }) {
  const f = resolveFormat(format);
  const textRule = withText
    ? "Render the on-image text EXACTLY as written, spelled perfectly, in the " +
      "bold display style described, with the gold highlight bar under the key word. "
    : "Keep the frame clean; no paragraphs of text. ";
  const cornerRule = brandCorner
    ? "Keep the TOP-RIGHT corner clear (empty margin) for small platform logos — " +
      "place the headline on the left. "
    : "";
  const footerRule = reserveBottom
    ? "Keep ALL text, the subject, and key graphics within the top 86% of the frame; " +
      "leave the bottom ~14% as clean EMPTY margin for the brand logo. "
    : "";
  const blocks = [direction.trim()];
  if (note) blocks.push(`ART DIRECTION (follow this closely): ${note.trim()}`);
  if (person) blocks.push(identityClause({ outfit, hasRefs, keepOutfit }));
  blocks.push(textRule + footerRule + cornerRule + `Composition framed for a ${f.label} (${f.ar}) social post with safe margins.`);
  blocks.push(STYLE);
  return blocks.join("\n\n");
}
