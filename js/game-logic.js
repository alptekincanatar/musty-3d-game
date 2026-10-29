// game-logic.js — Pure game rules for "İndirim Yağmuru".
// No DOM, no canvas, no audio: everything here is deterministic and node-testable.
// Coordinates are in CSS-pixel space; the renderer scales by devicePixelRatio.

export const TAG_PERCENTS = [10, 20, 30, 40, 50];
export const HP_MAX = 100;
export const MAX_COMBO = 5;        // multiplier caps at x5
export const LEVEL_SECONDS = 12;   // seconds between difficulty bumps
export const START_RED_CHANCE = 0.3;
export const MAX_RED_CHANCE = 0.45;

// Fall speed is expressed as a fraction of the field height per second so the
// game feels identical on every screen size.
export const BASE_FALL_SPEED = 0.3;  // h/s at level 1
export const MAX_FALL_SPEED = 1.15;  // frantic-but-playable hard cap
export const SPEED_PER_LEVEL = 0.1;  // +10% fall speed per level

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Combo starts at 1 (x1) after the first catch and climbs to x5.
export function comboMultiplier(combo) {
  return Math.min(Math.max(combo, 1), MAX_COMBO);
}

export function speedForLevel(level) {
  return clamp(
    BASE_FALL_SPEED * Math.pow(1 + SPEED_PER_LEVEL, level - 1),
    BASE_FALL_SPEED,
    MAX_FALL_SPEED
  );
}

// Red (tuzak) share drifts from 30% up to 45% as levels climb.
export function redChanceForLevel(level) {
  const t = clamp((level - 1) / 12, 0, 1);
  return START_RED_CHANCE + (MAX_RED_CHANCE - START_RED_CHANCE) * t;
}

export function spawnIntervalForLevel(level) {
  return clamp(0.9 * Math.pow(0.9, level - 1), 0.28, 0.9);
}

export function createState(opts = {}) {
  return {
    width: opts.width || 360,
    height: opts.height || 640,
    score: 0,
    best: opts.best || 0,
    hp: HP_MAX,
    level: 1,
    combo: 0,
    levelTimer: 0,
    time: 0,
    fallSpeed: BASE_FALL_SPEED,
    redChance: START_RED_CHANCE,
    spawnInterval: spawnIntervalForLevel(1),
    tags: [],
    gameOver: false,
    newBest: false,
  };
}

export function reset(state, best) {
  state.score = 0;
  state.hp = HP_MAX;
  state.level = 1;
  state.combo = 0;
  state.levelTimer = 0;
  state.time = 0;
  state.fallSpeed = BASE_FALL_SPEED;
  state.redChance = START_RED_CHANCE;
  state.spawnInterval = spawnIntervalForLevel(1);
  state.tags.length = 0;
  state.gameOver = false;
  state.newBest = false;
  state.best = best;
}

// A tag's on-screen size is a function of the field width so it scales cleanly.
export function tagSize(width) {
  const w = clamp(width * 0.17, 44, 96);
  return { w, h: w * 0.82, r: w * 0.42 };
}

export function makeTag(state, x, percent, kind, rng = Math.random) {
  const { w, h, r } = tagSize(state.width);
  return {
    kind, // 'good' (siyah / gerçek) | 'bad' (kırmızı / tuzak)
    percent,
    x,
    y: -h - 20, // start just above the visible field
    swayAmp: rng() * 22 + 8,    // horizontal sway amplitude (px)
    swayFreq: rng() * 2 + 1,    // radians / second
    swayPhase: rng() * Math.PI * 2,
    spin: (rng() * 2 - 1) * 0.8,
    angle: (rng() * 2 - 1) * 0.18,
    w,
    h,
    r,
    dead: false,
  };
}

// Guard against an unavoidable wall: don't stack tags in a near-vertical column
// right at the top where the player would have no time to dodge.
function tooClose(state, x) {
  for (const t of state.tags) {
    if (t.dead) continue;
    if (t.y < state.height * 0.35 && Math.abs(t.x - x) < t.r * 2.1) return true;
  }
  return false;
}

export function spawnTag(state, rng = Math.random) {
  const kind = rng() < state.redChance ? 'bad' : 'good';
  const percent = TAG_PERCENTS[Math.floor(rng() * TAG_PERCENTS.length)];
  let x = state.width * (0.08 + rng() * 0.84);
  for (let i = 0; i < 8 && tooClose(state, x); i++) {
    x = state.width * (0.08 + rng() * 0.84);
  }
  const tag = makeTag(state, x, percent, kind, rng);
  // higher levels make the tags swirl/sway harder (capped so it stays readable)
  const ampBoost = Math.min(1 + (state.level - 1) * 0.08, 2);
  const freqBoost = Math.min(1 + (state.level - 1) * 0.05, 1.5);
  tag.swayAmp *= ampBoost;
  tag.swayFreq *= freqBoost;
  state.tags.push(tag);
  return tag;
}

// Advance a single tag one frame. Returns true when it left the screen.
export function stepTag(tag, state, dt) {
  if (tag.dead) return true;
  const pxPerSec = state.fallSpeed * state.height;
  tag.y += pxPerSec * dt;
  tag.swayPhase += tag.swayFreq * dt;
  tag.x += Math.sin(tag.swayPhase) * tag.swayAmp * dt;
  tag.angle += tag.spin * dt;
  tag.x = clamp(tag.x, tag.r, state.width - tag.r);
  if (tag.y - tag.r > state.height + 24) {
    tag.dead = true;
    return true;
  }
  return false;
}

// Circle-circle collision between the player and a tag.
export function collides(px, py, pr, tag) {
  const dx = px - tag.x;
  const dy = py - tag.y;
  const rr = pr + tag.r;
  return dx * dx + dy * dy <= rr * rr;
}

// Catching a GOOD (black) tag. Returns the result, or null for a bad tag.
export function onCatch(state, tag) {
  if (tag.kind !== 'good') return null;
  state.combo += 1;
  const mult = comboMultiplier(state.combo);
  const points = tag.percent * mult;
  state.score += points;
  if (state.score > state.best) {
    state.best = state.score;
    state.newBest = true;
  }
  tag.dead = true;
  return { points, mult, combo: state.combo, percent: tag.percent };
}

// Being hit by a BAD (red) tag. Returns the result, or null for a good tag.
export function onHit(state, tag) {
  if (tag.kind !== 'bad') return null;
  state.hp = Math.max(0, state.hp - tag.percent);
  state.combo = 0;
  tag.dead = true;
  const dead = state.hp <= 0;
  if (dead && !state.gameOver) state.gameOver = true; // only fire once
  return { hp: state.hp, dead, percent: tag.percent };
}

// Advance the difficulty clock. Returns a level-up payload when a level turns.
export function tick(state, dt) {
  if (state.gameOver) return null;
  state.time += dt;
  state.levelTimer += dt;
  if (state.levelTimer >= LEVEL_SECONDS) {
    return levelUp(state);
  }
  return null;
}

export function levelUp(state) {
  state.level += 1;
  state.levelTimer = 0;
  state.fallSpeed = speedForLevel(state.level);
  state.redChance = redChanceForLevel(state.level);
  state.spawnInterval = spawnIntervalForLevel(state.level);
  return { level: state.level, fallSpeed: state.fallSpeed, redChance: state.redChance };
}
