// Brand fonts: Space Grotesk (display) + Inter (body), matching the live site.
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const sg = loadSpaceGrotesk("normal", { weights: ["500", "600", "700"] });
const inter = loadInter("normal", { weights: ["400", "500", "600", "700"] });

export const SG = sg.fontFamily;
export const INTER = inter.fontFamily;

// Resolves once every brand weight is ready — gate rendering on this so the
// first frames never flash a fallback font.
export const fontsReady = (): Promise<unknown> =>
  Promise.all([sg.waitUntilDone(), inter.waitUntilDone()]);
