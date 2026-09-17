/* Team room — class plugin (spec 2026-09-16-class-features-design.md §3). Lights up only when the
   class key is a team's ('team:<uuid>'): a welcome that says what this room is (yours, open all
   year, not recorded) — once per team per browser (localStorage), and never twice in one visit
   even after a drop and rejoin — and a "Team page" button in the bar so nobody hunts for the way
   back to the locker and chat. Everything else a team room needs — no host, no recording, no
   question line, Files filed under team:<id> — is the room host's own branch on target.kind
   (see the wiring notes in the feature report). Import-safe in Node; pure helpers exported. */
/* the words ride this module's own ?v= (sw.js is cache-first on every script: a bare relative import would go stale) */
const W = await import('./rtk-teamroom-words.js' + new URL(import.meta.url).search);
export const TEAM_WORDS = W.TEAM_WORDS, teamTitle = W.teamTitle, teamNowLine = W.teamNowLine, shouldWelcome = W.shouldWelcome, WELCOME_KEY = W.WELCOME_KEY;

export const TEAM_PAGE = '/opil/hub/team/';

/* the class key belongs to a team */
export const isTeamKey = (key) => typeof key === 'string' && key.startsWith('team:');

/* the welcome: plain words, what happens next */
export function welcomeCopy(words = TEAM_WORDS) {
  return 'This is ' + words.host + '’s own room. It stays open all year and is not recorded. Leave whenever you like — you can come back anytime.';
}

/* the stylesheet, once, on this module's own ?v= (the room's rule) */
let cssIn = false;
function ensureCss() {
  if (cssIn || typeof document === 'undefined') return;
  cssIn = true;
  try {
    const href = '/css/rtk-teamroom.css' + new URL(import.meta.url).search;
    if (document.querySelector('link[href^="/css/rtk-teamroom.css"]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  } catch (e) { console.warn('[teamroom] css', e); }
}

/* where "already welcomed" is remembered: localStorage in a browser (per team, survives reloads);
   ctx.store lets a test hand in its own; a missing or throwing store just welcomes them again */
function storeFor(ctx) {
  if (ctx && ctx.store !== undefined) return ctx.store;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
}

export function create(ctx) {
  let btn = null, welcomed = false;
  return {
    start() {
      try {
        if (!ctx || !isTeamKey(ctx.roomKey)) return;   /* an OPIL session or an Academy room: nothing to add */
        ensureCss();
        const words = ctx.words || TEAM_WORDS;
        btn = ctx.bar.addButton('<a class="r2-btn r2-teampage" href="' + TEAM_PAGE + '">Team page</a>');
        /* once per visit (a rejoin after a drop fires 'joined' again) AND once per team per browser */
        const once = () => {
          if (welcomed) return; welcomed = true;
          if (!shouldWelcome(storeFor(ctx), ctx.roomKey)) return;
          try { ctx.toast(welcomeCopy(words), 9000); } catch (e) {}
        };
        ctx.on('joined', once);
        once();
      } catch (e) { console.warn('[teamroom] start', e); }
    },
    stop() { try { if (btn) btn.remove(); } catch (e) {} btn = null; },
  };
}
