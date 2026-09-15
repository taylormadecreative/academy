// scripts/gen-ht-presets.mjs — write the two HT preset bodies from the OPIL ones.
// Run: node scripts/gen-ht-presets.mjs   (re-runnable; the test pins the result)
import fs from 'node:fs';
const DIR = new URL('./rtk-presets/', import.meta.url);
const read = (n) => JSON.parse(fs.readFileSync(new URL(n + '.json', DIR), 'utf8'));
const write = (n, o) => fs.writeFileSync(new URL(n + '.json', DIR), JSON.stringify(o, null, 2) + '\n');

/* preset JSON ramps run 300 light → 700 dark (the opposite of the client call in js/rtk-room-v2.js) */
const HT_UI = {
  theme: 'darkest', font_family: 'Inter', border_radius: 'rounded', border_width: 'thin',
  colors: {
    brand: { 300: '#FFE580', 400: '#FFD940', 500: '#FFCC00', 600: '#D9AD00', 700: '#B38F00' },
    background: { 600: '#8F0000', 700: '#660100', 800: '#4D0000', 900: '#3B0000', 1000: '#291C14' },
    text: '#FFFFFF', text_on_brand: '#3B0000', video_bg: '#3B0000',
    danger: '#FA2626', success: '#94CCAB', warning: '#F2B00D',
  },
  logo: 'https://taylormadeacademy.com/ht/img/ht-monogram-gold.png', spacing_base: 4,
};

const host = read('opil-host');
host.name = 'ht-class-host'; host.ui = { design_tokens: HT_UI };
write('ht-class-host', host);

const guest = read('opil-student');
guest.name = 'ht-class-guest'; guest.ui = { design_tokens: HT_UI };
/* strangers under HT's name must not push files to each other; text chat stays */
guest.permissions.chat.public.files = false;
guest.permissions.chat.private.files = false;
write('ht-class-guest', guest);
console.log('wrote ht-class-host.json, ht-class-guest.json');
