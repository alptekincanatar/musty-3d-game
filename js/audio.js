// audio.js — AudioManager for Musty Playground · Çarşı.
// Voices (ElevenLabs "Musty") play through preloaded HTMLAudioElements; small
// SFX are synthesized with the Web Audio API. Everything is muted by default
// until the first user gesture calls unlock().

const LINES = [
  { id: 'start',  group: 'start', text: 'Hadi bakalım, indirimleri toplayalım!', short: 'Hadi bakalım!' },
  { id: 'good1',  group: 'good',  text: 'Oley beee!',                          short: 'Oley be!' },
  { id: 'good2',  group: 'good',  text: 'Hah şöyle! Yaşasın indirim!',          short: 'Yaşasın indirim!' },
  { id: 'good3',  group: 'good',  text: 'Çarşıya indirim yağıyor, oley!',        short: 'İndirim yağıyor!' },
  { id: 'bad1',   group: 'bad',   text: 'Amanınnn!',                            short: 'Amanınnn!' },
  { id: 'bad2',   group: 'bad',   text: 'Aman Allahım, yok yaaa!',              short: 'Yok yaaa!' },
  { id: 'bad3',   group: 'bad',   text: 'Ayyy, o kırmızı olan neydi şimdi?',     short: 'O kırmızı neydi?' },
  { id: 'speed1', group: 'speed', text: 'Ayyy, nereye gidiyoruz?',               short: 'Nereye gidiyoruz?' },
  { id: 'speed2', group: 'speed', text: 'Yavaş ol be, nereye böyle gidiyoruz?',  short: 'Yavaş ol be!' },
  { id: 'speed3', group: 'speed', text: 'Ay hızlanıyoruz, ben korkuyorum!',      short: 'Korkuyorum!' },
  { id: 'over1',  group: 'over',  text: 'Ayyyy, öldük kız!',                    short: 'Öldük kız!' },
  { id: 'over2',  group: 'over',  text: 'Ayyy öldük kız, bittik biz!',          short: 'Bittik biz!' },
];

const SRC = (id) => `assets/audio/${id}.mp3`;

const MUTE_KEY = 'musty-muted';

let ctx = null;
let unlocked = false;

let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch (e) { /* storage unavailable — keep default */ }

const muteListeners = new Set();

// ---- Voice playback state --------------------------------------------------
const voiceEls = new Map();   // id -> HTMLAudioElement
const durations = new Map();  // id -> seconds (filled once metadata loads)
let currentVoice = null;      // id of the currently playing voice
let lastGoodAt = -Infinity;   // timestamp of last 'good' voice (rate limit)
let speedQueue = [];          // 'speed' lines still unplayed this run

const GROUPS = {
  start: ['start'],
  good: ['good1', 'good2', 'good3'],
  bad: ['bad1', 'bad2', 'bad3'],
  speed: ['speed1', 'speed2', 'speed3'],
  over: ['over1', 'over2'],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Rough fallbacks so the speech bubble can show before metadata is loaded.
const FALLBACK_DURATION = { start: 1.6, good: 1.6, bad: 1.8, speed: 2.0, over: 2.2 };

// ---- Web Audio synth helpers ----------------------------------------------
function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.4, curve = 0.001 }) {
  const c = ensureCtx();
  if (!c || muted) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(curve, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst({ dur = 0.3, vol = 0.3, f0 = 400, f1 = 2000, q = 1 }) {
  const c = ensureCtx();
  if (!c || muted) return;
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function sfx(name) {
  switch (name) {
    case 'ping': // coin-like catch
      tone({ type: 'sine', f0: 880, f1: 1760, dur: 0.12, vol: 0.35 });
      tone({ type: 'sine', f0: 1320, f1: 2200, dur: 0.14, vol: 0.22 });
      break;
    case 'thud': // low buzz on hit
      tone({ type: 'square', f0: 110, f1: 55, dur: 0.22, vol: 0.32 });
      tone({ type: 'sawtooth', f0: 90, f1: 45, dur: 0.28, vol: 0.22 });
      break;
    case 'whoosh': // level-up sweep
      noiseBurst({ dur: 0.35, vol: 0.28, f0: 300, f1: 3200, q: 1.2 });
      tone({ type: 'sine', f0: 300, f1: 900, dur: 0.3, vol: 0.2 });
      break;
    case 'sad': // sad trombone-ish slide on game over
      tone({ type: 'sawtooth', f0: 392, f1: 130, dur: 0.9, vol: 0.3 });
      tone({ type: 'sawtooth', f0: 196, f1: 65, dur: 0.9, vol: 0.2 });
      break;
    default:
      break;
  }
}

// ---- Voice playback --------------------------------------------------------
function loadAll() {
  for (const line of LINES) {
    if (voiceEls.has(line.id)) continue;
    const el = new Audio();
    el.preload = 'auto';
    el.src = SRC(line.id);
    el.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(el.duration) && el.duration > 0) durations.set(line.id, el.duration);
    });
    el.addEventListener('ended', () => { if (currentVoice === line.id) currentVoice = null; });
    el.load();
    voiceEls.set(line.id, el);
  }
}

function playEl(id, interrupt) {
  const el = voiceEls.get(id);
  if (!el) return 0;
  if (interrupt && currentVoice) {
    const cur = voiceEls.get(currentVoice);
    if (cur) { cur.pause(); cur.currentTime = 0; }
  }
  el.currentTime = 0;
  el.volume = 1.0;
  const p = el.play();
  if (p && p.catch) p.catch(() => {});
  currentVoice = id;
  return durations.get(id) || FALLBACK_DURATION[LINES.find((l) => l.id === id).group] || 1.5;
}

// Explicit play of a single line (soundboard). Ignores rate limits; respects
// mute unless opts.force is set (explicit button click always plays).
function playLine(id, opts = {}) {
  if (!unlocked && opts.force) unlock();
  if (muted && !opts.force) return null;
  if (!opts.force && !unlocked) return null;
  const line = LINES.find((l) => l.id === id);
  if (!line) return null;
  const dur = playEl(id, true);
  return { id, ...line, duration: dur };
}

// Grouped, game-aware voice. See the brief for per-group rules.
function playVoice(group, opts = {}) {
  if (!unlocked || muted) return null;
  const ids = GROUPS[group];
  if (!ids) return null;

  if (group === 'good') {
    const now = performance.now();
    const cooled = now - lastGoodAt >= 2500;
    if (!opts.force && (currentVoice || !cooled)) return null; // rate-limited → caller pings
    lastGoodAt = now;
  }

  let id;
  if (group === 'speed') {
    // cycle: each speed line at most once per run, then refill
    if (speedQueue.length === 0) speedQueue = shuffle([...ids]);
    id = speedQueue.shift();
  } else {
    id = pick(ids);
  }

  const interrupt = group === 'bad' || group === 'over';
  const line = LINES.find((l) => l.id === id);
  const dur = playEl(id, interrupt);
  return { id, ...line, duration: dur };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function unlock() {
  ensureCtx();
  if (!unlocked) {
    unlocked = true;
    loadAll();
  }
  speedQueue = []; // a new run gets a fresh speed-line cycle
}

function lineText(id) {
  const line = LINES.find((l) => l.id === id);
  return line ? line.text : '';
}

function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
  if (muted && currentVoice) {
    const cur = voiceEls.get(currentVoice);
    if (cur) { cur.pause(); cur.currentTime = 0; }
    currentVoice = null;
  }
  for (const cb of muteListeners) { try { cb(muted); } catch (e) {} }
}

function toggleMute() { setMuted(!muted); }

function onMuteChange(cb) {
  muteListeners.add(cb);
  return () => muteListeners.delete(cb);
}

export const audio = {
  LINES,
  unlock,
  lineText,
  playSfx: sfx,
  playVoice,
  playLine,
  setMuted,
  toggleMute,
  onMuteChange,
  get muted() { return muted; },
};
