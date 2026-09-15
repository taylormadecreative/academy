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
/* every tool for every person (Nelson, 9/15: "every single person should have access to ALL THE TOOLS on
   every platform"): the guest body is the student body — screen share, polls, chat with files, pin, small
   groups — with HT's name and tokens. Files used to be off for HT guests; that was a tool taken away. */
/* HT guests are captioned too (Nelson, 9/15: "show the transcriptions as she talks") — the room
   transcribes per preset, so a guest whose preset says false never appears in the captions */
guest.permissions.transcription_enabled = true;
write('ht-class-guest', guest);
console.log('wrote ht-class-host.json, ht-class-guest.json');
