// recipes.mjs — viral social templates in the Taylormade Academy aesthetic.
// Each recipe(ctx) returns either:
//   { withText, direction }                       — a single frame
//   { withText, slides: [direction, ...] }        — a carousel (cover + slides)
// ctx = { topic, format, slides, vars{} }. The STYLE block + identity/outfit are
// added later by style.composePrompt — recipes only describe the *creative direction*.
// Recipes that feature Nelson set `person: true`; the machine then locks his face
// from the refs and dresses him in the per-post outfit (never the ref's white tank).

const q = (s) => `“${String(s).trim()}”`;

export const recipes = {
  // Founder-as-hero motivational post. The scroll-stopper.
  "hero-post": ({ topic }) => ({
    withText: true,
    person: true,
    direction:
      `A motivational social post. The founder is positioned to one side as the hero, ` +
      `mid-shot, against a clean paper-white scene with a soft royal-blue blob and a few ` +
      `gold sparkle stars. Large bold display headline reading ${q(topic)} with the most ` +
      `important word sitting on a solid gold highlight bar. Confident, premium, aspirational.`,
  }),

  // Pure typographic quote card — best on ChatGPT image for crisp text.
  "quote-card": ({ topic }) => ({
    withText: true,
    direction:
      `A bold typographic quote card on a deep navy ink background. Large tight display ` +
      `lettering reading ${q(topic)}, perfectly kerned, with ONE key word underlined by a ` +
      `solid gold highlight bar. Small gold and blue 4-point sparkle accents in the corners. ` +
      `Leave the bottom-center clear for the brand logo. Lots of negative space.`,
  }),

  // A teach-a-thing card. Headline + value.
  "lesson-card": ({ topic }) => ({
    withText: true,
    direction:
      `An educational "creator tip" card. Paper-white panel with a rounded navy header bar ` +
      `reading ${q(topic)}, the action word on a gold highlight bar. Beneath it, a clean ` +
      `simple illustrative icon set (camera, spark, arrow) in navy and gold flat-vector style. ` +
      `Feels like a premium swipeable lesson from a creator academy.`,
  }),

  // Big number / proof flex.
  "stat-flex": ({ topic, vars }) => ({
    withText: true,
    direction:
      `A bold stat card. An oversized gold number "${vars?.stat || "10x"}" dominates the frame ` +
      `on a deep navy background, with supporting line ${q(topic)} in clean white display type. ` +
      `Blue blob and gold sparkles. Confident, punchy, screenshot-worthy.`,
  }),

  // Wide WEBSITE HERO banner (like the academy homepage). Founder + Claude/TikTok
  // app icons + pill chips + CTA buttons. Routes to ChatGPT (renders the text cleanly).
  "web-hero": ({ topic, vars }) => ({
    withText: true,
    person: true,
    keepOutfit: true,
    noLogo: true,
    format: "wide",
    engine: "openai",
    direction:
      `A polished WIDE website hero banner for an online creator academy (16:9), on a clean ` +
      `cream / off-white background with a faint concentric-circle motif. ` +
      `LEFT SIDE (text column): at the very top-left a clean "TAYLORMADE ACADEMY" wordmark (navy, ` +
      `with a small graduation-cap-over-open-book logo mark); under it a small ` +
      `eyebrow "A free community for creatives" with a tiny people icon; then a large bold display ` +
      `headline reading ${q(topic)} with a solid gold highlight bar under the key phrase; then a ` +
      `one-line subheading "${vars?.subhead || "Use Claude + TikTok to create content, build systems, and grow income."}" ` +
      `with "Claude" and "TikTok" emphasized; then a small line "Taught by Nelson Taylor"; then a row of ` +
      `four rounded outline pill chips labeled DESIGN, PHOTO, VIDEO, AI each with a tiny line icon; then ` +
      `two call-to-action buttons side by side — a solid gold pill "Join free →" and a white outline pill ` +
      `"Explore courses →". ` +
      `RIGHT SIDE: the founder (from the reference) smiling confidently in his letterman jacket, and to ` +
      `his right two rounded-square app-icon tiles stacked with a small "+" between them — the Claude app ` +
      `icon (terracotta sunburst on white) on top and the TikTok app icon (black tile with the music note) ` +
      `below, each labeled. Premium, modern, generous negative space, crisp perfectly-spelled typography.`,
  }),

  // Lifestyle scene featuring the founder (photoreal). Steer the setting/pose with --note.
  "lifestyle": ({ topic }) => ({
    withText: true,
    person: true,
    direction:
      `A premium lifestyle social photo featuring the founder in a real-world creator setting ` +
      `(modern coffee shop, sunlit studio desk, rooftop, or walking through downtown), candid and ` +
      `aspirational, shot on a cinema camera with shallow depth of field and a warm navy-and-gold ` +
      `color grade. Overlay a short bold headline ${q(topic)} with the key word on a gold highlight ` +
      `bar, placed cleanly in the negative space. Editorial, scroll-stopping, real — not stock.`,
  }),

  // Behind-the-build studio moment (photoreal). Uses the real ref photos of Nelson.
  "behind-the-build": ({ topic }) => ({
    withText: false,
    person: true,
    direction:
      `A cinematic behind-the-scenes studio photograph. The founder is working at a creative ` +
      `desk — laptop, camera gear, warm key light — caught mid-flow, authentic candid energy. ` +
      `Background softly blurred downtown studio. Subtle navy-and-gold color grade. The vibe ` +
      `says "${topic}". Editorial, premium, real — not stock.`,
  }),

  // Launch / announcement.
  "launch": ({ topic }) => ({
    withText: true,
    direction:
      `A launch announcement post. A glowing rounded card floating on a deep navy scene with ` +
      `gold sparkles and a blue blob, headline ${q(topic)} with key word on a gold highlight ` +
      `bar, and a rounded gold pill button reading "JOIN FREE". Premium, exciting, high-energy.`,
  }),

  // Vertical story frame.
  "story-frame": ({ topic }) => ({
    withText: true,
    direction:
      `A full-bleed 9:16 story frame. Deep navy-to-cobalt background, a single bold line ` +
      `${q(topic)} centered with the key word on a gold highlight bar, gold sparkle accents, ` +
      `and a small swipe-up gold pill at the bottom. Clean, motion-ready, scroll-stopping.`,
  }),

  // Multi-slide carousel: a cover plus N teaching slides built from comma- or
  // pipe-separated points in `topic` (e.g. "Title | point one | point two | ...").
  "carousel": ({ topic, slides = 4 }) => {
    const parts = topic.split("|").map((s) => s.trim()).filter(Boolean);
    const title = parts[0] || topic;
    const points = parts.slice(1);
    const cover = {
      direction:
        `Carousel COVER slide. Bold display headline ${q(title)} on a paper-white scene with a ` +
        `royal-blue blob, gold sparkles, the key word on a gold highlight bar, and a small ` +
        `"SWIPE →" gold pill. Premium creator-academy cover that demands the swipe.`,
    };
    const body = [];
    const n = points.length ? points.length : Math.max(1, slides - 1);
    for (let i = 0; i < n; i++) {
      const point = points[i] || `Key idea ${i + 1}`;
      body.push({
        direction:
          `Carousel slide ${i + 2}. Clean paper-white layout, big navy slide number "${i + 1}" in ` +
          `the corner, a short bold line ${q(point)} with one word on a gold highlight bar, and a ` +
          `simple navy/gold flat-vector icon. Consistent with the cover, part of the same set.`,
      });
    }
    return { withText: true, slides: [cover, ...body].map((s) => s.direction) };
  },
};

export const recipeNames = Object.keys(recipes);
