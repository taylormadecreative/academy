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
  "Graphic language: soft organic blue blob shapes behind the subject, small",
  "4-point sparkle stars in gold and blue as light accents, rounded pill buttons",
  "and rounded cards with soft realistic drop shadows, generous negative space,",
  "balanced editorial composition.",
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
export function identityClause({ outfit, hasRefs }) {
  const teeRule =
    " Any tee or shirt visible under the outfit must be WHITE or cream — never black, " +
    "never dark gray. Keep the look bright and on-brand.";
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
  return FORMATS[name] || FORMATS.post;
}

// Wrap a recipe's creative direction with the locked style + format guidance,
// and (for person-featuring recipes) the identity + per-post outfit clause.
export function composePrompt({ direction, format, withText, person, outfit, hasRefs, note, brandCorner }) {
  const f = resolveFormat(format);
  const textRule = withText
    ? "Render the on-image text EXACTLY as written, spelled perfectly, in the " +
      "bold display style described, with the gold highlight bar under the key word. "
    : "Keep the frame clean; no paragraphs of text. ";
  const cornerRule = brandCorner
    ? "Also keep the TOP-RIGHT corner clear (empty margin) for small platform logos — " +
      "place the headline on the left. "
    : "";
  const footerRule =
    "Keep ALL text, the subject, and key graphics within the top 86% of the frame. " +
    "Leave the bottom ~14% as clean EMPTY margin (no text, no subject, no graphics) " +
    "reserved for the brand logo. " + cornerRule;
  const blocks = [direction.trim()];
  if (note) blocks.push(`ART DIRECTION (follow this closely): ${note.trim()}`);
  if (person) blocks.push(identityClause({ outfit, hasRefs }));
  blocks.push(textRule + footerRule + `Composition framed for a ${f.label} (${f.ar}) social post with safe margins.`);
  blocks.push(STYLE);
  return blocks.join("\n\n");
}
