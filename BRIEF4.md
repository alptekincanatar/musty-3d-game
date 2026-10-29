# Musty Playground v2 — FULL REBUILD (static site + game). Read everything first.

Working dir: this folder. Static site, **vanilla HTML/CSS/JS only, ES modules, no build step, no npm, no frameworks**. Served with `python3 -m http.server 8780` (already running here). Language of all UI text: **Turkish**.
The old site is backed up at ../musty-3d-v1 — DELETE the old index.html, style.css, app.js, tools/, .venv, NOTES.md and write everything fresh. Do NOT touch assets/*. Old unused folders (assets/model, assets/masks, assets/rot, assets/outfits-src, assets/turn-src, assets/*.webp except face-*.webp) are ignorable.

## Assets that exist (use only these)
- Cut-out sprites (transparent PNG, 700px wide, character may have transparent padding → compute the tight alpha bounding box at load with a canvas and use that for drawing/collision):
  assets/sprites/front.png, left.png (walks LEFT), right.png (walks RIGHT), front-left.png, front-right.png
- 360° turntable frames, 8 angles each (0,45,…,315), JPG 1200px wide, 3:4: `assets/turn/a000.jpg … a315.jpg` (default blue outfit), `assets/turn/carsi_000.jpg…` (black shirt/white trousers), `kirmizi_*.jpg` (red shirt/black trousers), `sari_*.jpg` (yellow shirt/navy trousers). Angles in order are a smooth turntable (0 front → 45 → 90 profile → 135 → 180 back → 225 → 270 → 315).
- Face close-ups (webp): assets/face-wink.webp, face-cute.webp, face-surprised.webp. Full-body poses: assets/body-neutral.webp, body-talk.webp, body-lean.webp, body-cross.webp, body-present.webp.
- Voice lines by ElevenLabs "Musty" voice (mp3, ~1-3 s): assets/audio/good1.mp3 "Oley beee!", good2 "Hah şöyle! Yaşasın indirim!", good3 "Çarşıya indirim yağıyor, oley!", bad1 "Amanınnn!", bad2 "Aman Allahım, yok yaaa!", bad3 "Ayyy, o kırmızı olan neydi şimdi?", speed1 "Ayyy, nereye gidiyoruz?", speed2 "Yavaş ol be, nereye böyle gidiyoruz?", speed3 "Ay hızlanıyoruz, ben korkuyorum!", over1 "Ayyyy, öldük kız!", over2 "Ayyy öldük kız, bittik biz!", start "Hadi bakalım, indirimleri toplayalım!".
- No other sounds exist: synthesize small SFX with Web Audio (coin-like "ping" for catch, low "thud/buzz" for hit, whoosh on level up, sad trombone-ish slide on game over). Music optional: a simple generated looping bass/beat via Web Audio that speeds up with level is welcome but must be mutable and OFF until the first user gesture.

## The site (complete redesign — make it genuinely good, memorable, not a template)
Brand: "Musty Playground · Çarşı". Visual identity: Çarşı = black & white + hot red accent on warm off-white (#f4efe6-ish). Bold, playful, poster/sticker feel: chunky display type (load a distinctive display font from Google Fonts, e.g. "Bricolage Grotesque" 800 or "Archivo Black" + a clean body font), thick outlines, hard offset shadows, rotated stickers, subtle grain, marquee ticker strip ("İNDİRİM YAĞIYOR ★ ÇARŞI ★ …"), smooth scroll-reveal animations (IntersectionObserver), hover micro-interactions. Fully responsive (phone first), good contrast, `prefers-reduced-motion` respected, keyboard accessible. Sticky header with logo, nav anchors, and a global **mute/unmute sound toggle** (persisted in localStorage in try/catch).
Sections, in order:
1. **Hero** — giant headline, the cut-out front sprite large with a sticker "%50 İNDİRİM", primary CTA "Oyuna Gir" (scrolls to #oyun), secondary "360° Stüdyo".
2. **#oyun** — the game (spec below), inside a framed arcade cabinet-like container, with fullscreen button, controls hint, best score.
3. **#studyo** — 360° turntable viewer: drag horizontally (pointer events, inertia, snap to 8 frames; keep it smooth; preload frames), buttons Ön/Arka, auto-rotate toggle, outfit chips (Mavi, Çarşı, Kırmızı, Sarı) with colored dots, angle label, "PNG indir" (download current frame).
4. **#mimikler** — face gallery: 3 big expression cards (wink/cute/surprised) with fun captions; click = enlarge (lightbox) and Musty says a random voice line.
5. **Ses tahtası (soundboard)** — grid of big buttons, one per voice line, with the text of the line; clicking plays it (respect mute but explicit button click always plays).
6. **Footer** — Çarşı note, "Musty yaptı" credit, small print.
Page must load fast: lazy-load images below the fold, `decoding=async`.

## THE GAME — "İndirim Yağmuru" (canvas 2D, requestAnimationFrame, delta-time based)
- Portrait-friendly canvas (aspect ~ 9:14 on phones, wider box on desktop with the play field centered); scale with devicePixelRatio; resize-safe.
- Player: Musty at the bottom using sprites. Move LEFT/RIGHT with ←/→ or A/D (smooth acceleration), on touch/mouse: finger/pointer x position steers him (lerp to target). Sprite: use left.png while moving left, right.png while moving right, front.png idle; add a bouncy squash/step bob while moving; on being hit show front.png with a red flash and shake; on 0 HP he falls over (rotate) and fades.
- Falling items from the top: discount tags (rounded "price-tag" shape drawn in canvas, hole + string on top) showing **%10, %20, %30, %40 or %50** (random). Two kinds:
  - **GERÇEK (good) = BLACK tags** with white text. Catch = collect. Score += percent × combo multiplier. Unlimited collecting, no cap.
  - **TUZAK (bad) = RED tags** with white text and a small "!" mark. If a red tag touches Musty he loses HP equal to its percent value (%10 → −10 HP … %50 → −50 HP). If a red tag falls off-screen nothing happens. Black tags that fall off-screen just vanish (maybe small "kaçırdın" feedback, no penalty).
  - Mix: ~70% black / 30% red at the start, drifting up to ~45% red at high levels. Never spawn an unavoidable wall (always leave a gap Musty can reach).
- HP: starts at **100**, shown as a big bar + number. At 0 → game over ("ELENDİN"). No healing needed.
- Difficulty ramps endlessly: level increases every ~12 seconds (or every N points); each level raises fall speed (+8–12%), spawn rate and swirl/sway of tags, with a cap that keeps it playable but frantic. Show level number + "HIZLANDIK!" banner with screen-edge speed lines on level-up.
- Combo: consecutive black catches without a red hit build a combo (x2, x3 … up to x5), shown on screen; a red hit resets it.
- Scoring/HUD: score, best score (localStorage, try/catch), level, HP bar, combo, mute button, pause (P / Esc / button).
- Particles: sparkle burst + floating "+%30" text on catch; red burst + screen shake on hit; confetti on new best.
- States: start screen (title, legend "SİYAH = gerçek indirim, KIRMIZI = tuzak", big "BAŞLA" button — required so audio can start), playing, paused, game over (score, best, "Tekrar Oyna", "Paylaş" optional copy-text). Keyboard: Space/Enter to start/restart.
- **Voice (Musty) reactions — implement an AudioManager module (Web Audio + HTMLAudioElement or decoded AudioBuffers, preloaded after the first gesture):**
  - game start: `start.mp3`
  - catching a BLACK tag: play a random `good1-3.mp3` — but rate-limit: only when no voice is currently playing, and not more often than every ~2.5 s (otherwise just play the synth ping). Always play for the first catch of a run and for any catch of %50.
  - hit by RED tag: random `bad1-3.mp3` (interrupt any other voice, always play).
  - level-up / speed increase: random `speed1-3.mp3` (cycle through them, each at most once per run before repeating).
  - game over: random `over1-2.mp3` (interrupt others) plus the synth sad slide.
  - Global mute respected; browsers need a gesture — start audio on the BAŞLA click. Lower voice volume ~1.0, SFX ~0.4 so voices stay clear.
- Fun details: Musty speech bubble pops up with the line text (e.g. "Oley be!", "Amanın!") for the duration of the voice clip; background has parallax Çarşı stripes/clouds of floating "%"; ground with soft shadow under Musty.
- Performance: object pooling or simple arrays, no per-frame allocations in hot paths, pause when tab hidden (visibilitychange).
- Code structure (ES modules in /js): `main.js` (boot, nav, reveal, mute), `audio.js`, `game.js` (all game logic, exported `createGame(canvasEl, hooks)`), `studio.js` (turntable), `gallery.js` (faces + soundboard). CSS in /css/main.css (+ optional game.css). Clear, commented-where-non-obvious code, no dead code.

## Definition of done (verify yourself, do not just claim)
1. `node --check` on every js file passes; no console errors when the page loads (open it and check — use Playwright/Puppeteer if available via npx, otherwise write a tiny Node script with a DOM-less logic test for the game's collision/HP/level functions).
2. Game: simulate in a browser-run or script test that (a) black tag collision adds score, (b) red tag collision subtracts exactly its percent from HP, (c) HP ≤ 0 triggers game over once, (d) level/speed increases over time.
3. Responsive check at 375px and 1280px widths — no horizontal scroll, game fits viewport.
4. Write a short README.md (run instructions, file map, how voices are triggered).

---
# WORK SPLIT (two agents run IN PARALLEL in this same folder — only touch YOUR files)
## Contract between the two parts
- `js/audio.js` (agent GAME writes it). `export const audio = { unlock(), muted (getter), setMuted(bool), toggleMute(), onMuteChange(cb), playSfx(name /* 'ping'|'thud'|'whoosh'|'sad' */), playVoice(group /* 'start'|'good'|'bad'|'speed'|'over' */, opts?), playLine(id /* e.g. 'good2' */, opts?) /* explicit play, used by soundboard, ignores rate limits, plays even if globally muted only when opts.force */, lineText(id) /* Turkish text of line */, LINES /* array of {id, text, group} for all 12 */ }`. Mute persisted in localStorage (try/catch). `unlock()` creates/resumes the AudioContext + starts preloading mp3 (call from any user gesture).
- `js/game.js` (agent GAME writes it). `export function initGame(rootEl)`: rootEl is an empty `<div id="game-root">`; the game builds EVERYTHING inside it (canvas, overlays, buttons incl. fullscreen & pause, start/gameover screens, HUD) and is self-styled by `css/game.css`. The root element is sized by the page (width 100%, max 520px, aspect-ratio 9/14 on phones — the site gives it a box; the game must fill the box via ResizeObserver). Game owns its own keyboard handlers only while it is visible (IntersectionObserver: pause automatically when scrolled out of view).
- Agent SITE writes: `index.html`, `css/main.css`, `js/main.js`, `js/studio.js`, `js/gallery.js`, README.md. index.html must contain `<link rel="stylesheet" href="css/game.css">`, `<div id="game-root"></div>` inside the #oyun section, and `<script type="module" src="js/main.js">`. main.js imports `{ initGame } from './game.js'` and `{ audio } from './audio.js'`, calls initGame(document.getElementById('game-root')) and wires the header mute toggle to audio. SITE agent writes against the contract and must NOT create or overwrite js/audio.js, js/game.js, js/game-logic.js, css/game.css (wait/poll briefly for them to appear before final integration testing).
- Agent GAME writes: `js/audio.js`, `js/game.js`, `js/game-logic.js` (all game rules — spawn, collision, hp, level ramp, scoring, combo — with NO DOM so it is node-testable), `css/game.css`, `test/game.test.mjs` (run it with node and make it pass). GAME agent must NOT touch the SITE files.
