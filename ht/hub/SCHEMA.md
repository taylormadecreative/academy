# HT Hub content schema (for anyone adding a space)

Every space is ONE file: `ht/hub/data/<key>.js` that sets `HT.spaces.<key> = {...}`. Shells load `/ht/hub/data.js`
(core) then `/ht/hub/data/<key>.js` then `/ht/hub/ht.js`. The runtime renders `document.body[data-space]`.

```js
window.HT = window.HT || {}; HT.spaces = HT.spaces || {};
HT.spaces.alumni = {
  key: 'alumni', title: 'Alumni', office: 'Alumni Relations',           // title = tab label; office = eyebrow
  blurb: 'One line for the home grid (max ~90 chars).', icon: 'globe',   // icons: gift mic calendar play book chat star users briefcase globe door hands shield cap
  sub: 'Optional one-sentence subhead under the H1.', stamp: 'Preview · sample content',
  headCta: { label: 'Fund a cohort', href: '/ht/fund/', style: 'ht-gold' },   // optional
  blocks: [ /* ordered; add side:true to place a block in the right column */ ]
};
```

## Block types (all: optional `id`, `title`, `meta`, `side`)
- `intro`  {kicker,title,text,ctas:[{label,href,style:'ht'|'ht-gold'|'ht-line'}],image,imageAlt | video,poster, ada:{text,when}}
- `ada`    {label?,text,when}                                 a standalone "Ada says" note
- `stats`  {items:[{n,label}]}                                4 items reads best
- `cards`  {items:[{meta,title,text,href,img,alt,badge,badgeCls,foot}]}
- `agenda` {event:{name,dates,place,note}, days:[{label,date:'YYYY-MM-DD',items:[{time:'9:00 AM',end?,title,where,who,tag,tagCls}]}]}  (Add-to-calendar + print are automatic)
- `people` {dm:true|false, items:[{name,role,org,tag,tagCls,gold}]}
- `directory` {search:true, items:[{name,program,year,skills:[],tag,href}]}
- `announcements` {items:[{who,when,text}]}
- `materials` {items:[{kind:'PDF'|'REC'|'DOC'|'LINK'|'PLAY'|'FORM'|'DECK',title,sub,href,restricted}]}
- `tracks` {items:[{title,text,tag,sessions:[{no,title,date,done,status}],cert:{title,text,status,cls}}]}
- `feed`   {channels:['Class of 2027',...], posts:[{who,chan,when,text,likes}]}
- `chat`   {room:'unique-key', seed:[{who,text,when,me}]}
- `checkin`{session,sub,code:'RAMS26',hint}
- `replays`{items:[{title,date,len,poster,tag}]}
- `player` {cardTitle,title,live:false,stream,poster,now:{title,who,when}}   (stream defaults to the $0 rehearsal loop)
- `timeline` {items:[{when,title,text,done}]}
- `calendar` {items:[{date:'YYYY-MM-DD',title,where,tag,tagCls}]}
- `split`  {kicker,title,text,bullets:[],image,imageAlt,side:'left'|'right',cta:{label,href,style}}
- `steps`  {items:[{em,h,p}]}
- `faq`    {items:[{q,a}]}
- `notice` {text | html, tone:'gold'|'maroon'}
- `cta`    {title,text,primary:{label,href},secondary:{label,href}}
- `table`  {cols:[],rows:[[...]]}
- `install`{}                                                   phone install card (sand)
- `html`   {html}                                               trusted escape hatch

## Rules
- Everything is SAMPLE and labeled so (chips `badge:'Sample'`, `event.note:'Sample event'`, meta text). No real student names.
  Staff/people entries are role-based ("Gift officer (sample)") except Linda Y. Jackson and Dr. Melva K. Wallace, who are real.
- Never a real face beside a sample name: `img` values are campus photos and renderings from `/ht/img/` only.
- No prices, no dollar totals, no campaign figures, no vendor/tool names, no "avatar"/"AI-generated" (say "Ada, HT's student ambassador").
- No athletic marks or "Rams" branding. Academic identity only.
- Dates: fall 2026 to spring 2027. Homecoming is February 2027 (real). Don't invent HT event names beyond: Homecoming 2027,
  Founders' Day, Orientation Week, Donor Appreciation Weekend (sample), President's Fall Briefing (sample).
- Voice: warm, specific, second person where natural. Short sentences. No em dashes.
- Images available in /ht/img/: campus-hero.jpg, commencement.jpg, fall-convocation.jpg, students-library.jpg, wallace-students.jpg,
  cover-dais.jpg, r-arena-entry.jpg, r-student-center.jpg, r-academic.jpg, r-village-plaza.jpg, r-retail-street.jpg,
  r-admin-dusk.jpg, student-laptop.jpg, athletics.jpg (no marks visible? verify before use), hero-flyover-poster.jpg,
  ada-gate-4x5.jpg, ada-idle-poster.jpg. Replay posters: use campus photos.
