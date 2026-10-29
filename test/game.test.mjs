// test/game.test.mjs — node tests for the DOM-free game rules in game-logic.js.
// Run with:  node --test test/game.test.mjs   (or `npm test`)

import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game-logic.js';

const SEED = 123456789;
function seeded() {
  // tiny deterministic PRNG so tests are stable
  let s = SEED;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

test('comboMultiplier climbs to x5 and never exceeds it', () => {
  assert.equal(G.comboMultiplier(0), 1);
  assert.equal(G.comboMultiplier(1), 1);
  assert.equal(G.comboMultiplier(2), 2);
  assert.equal(G.comboMultiplier(3), 3);
  assert.equal(G.comboMultiplier(5), 5);
  assert.equal(G.comboMultiplier(7), 5);
});

test('(a) catching a black tag adds score = percent x combo', () => {
  const s = G.createState({ width: 360, height: 640 });
  const tag = G.makeTag(s, 180, 30, 'good', seeded());
  const r = G.onCatch(s, tag);
  assert.equal(r.points, 30); // first catch: combo 1 -> x1
  assert.equal(s.score, 30);
  assert.equal(s.combo, 1);

  const tag2 = G.makeTag(s, 180, 50, 'good', seeded());
  const r2 = G.onCatch(s, tag2);
  assert.equal(r2.points, 100); // second catch: combo 2 -> x2
  assert.equal(s.score, 130);
});

test('(b) a red tag subtracts EXACTLY its percent from HP', () => {
  const s = G.createState({ width: 360, height: 640 });
  assert.equal(s.hp, 100);

  const t30 = G.makeTag(s, 180, 30, 'bad', seeded());
  const r1 = G.onHit(s, t30);
  assert.equal(r1.hp, 70);
  assert.equal(s.hp, 70);

  const t50 = G.makeTag(s, 180, 50, 'bad', seeded());
  const r2 = G.onHit(s, t50);
  assert.equal(r2.hp, 20);
  assert.equal(s.hp, 20);

  // a %20 hit lands exactly on 0
  const t20 = G.makeTag(s, 180, 20, 'bad', seeded());
  const r3 = G.onHit(s, t20);
  assert.equal(r3.hp, 0);
  assert.equal(r3.dead, true);
});

test('(c) HP <= 0 triggers game over exactly once and freezes the clock', () => {
  const s = G.createState({ width: 360, height: 640 });
  G.onHit(s, G.makeTag(s, 180, 50, 'bad', seeded()));
  G.onHit(s, G.makeTag(s, 180, 50, 'bad', seeded()));
  assert.equal(s.hp, 0);
  assert.equal(s.gameOver, true);

  // further hits cannot lower HP below 0 nor re-trigger anything
  const extra = G.onHit(s, G.makeTag(s, 180, 50, 'bad', seeded()));
  assert.equal(extra.hp, 0);
  assert.equal(s.gameOver, true);

  // difficulty clock is frozen after game over
  assert.equal(G.tick(s, 100), null);
  assert.equal(s.level, 1);
});

test('a red hit resets the combo', () => {
  const s = G.createState({ width: 360, height: 640 });
  G.onCatch(s, G.makeTag(s, 180, 10, 'good', seeded()));
  G.onCatch(s, G.makeTag(s, 180, 10, 'good', seeded()));
  assert.equal(s.combo, 2);
  G.onHit(s, G.makeTag(s, 180, 10, 'bad', seeded()));
  assert.equal(s.combo, 0);
});

test('(d) level and fall speed increase over time', () => {
  const s = G.createState({ width: 360, height: 640 });
  const f0 = s.fallSpeed;
  const spawn0 = s.spawnInterval;
  assert.equal(s.level, 1);

  assert.equal(G.tick(s, 11.9), null); // not yet
  const up = G.tick(s, 0.1);            // crosses the 12s threshold
  assert.equal(up.level, 2);
  assert.equal(s.level, 2);
  assert.ok(s.fallSpeed > f0, 'fall speed should rise');
  assert.ok(s.spawnInterval < spawn0, 'spawn interval should shrink');

  // keep ticking several levels — speed must keep climbing but stay capped
  for (let i = 0; i < 200; i++) G.tick(s, 12);
  assert.ok(s.level > 10);
  assert.ok(s.fallSpeed <= G.MAX_FALL_SPEED, 'fall speed must stay under the cap');
  assert.ok(s.fallSpeed > f0);
});

test('red (tuzak) chance drifts upward with level', () => {
  assert.equal(G.redChanceForLevel(1), G.START_RED_CHANCE);
  assert.ok(G.redChanceForLevel(20) > G.redChanceForLevel(1));
  assert.ok(G.redChanceForLevel(100) <= G.MAX_RED_CHANCE);
});

test('spawnTag produces valid tags with legal percents and kinds', () => {
  const s = G.createState({ width: 360, height: 640 });
  const rng = seeded();
  for (let i = 0; i < 100; i++) {
    const t = G.spawnTag(s, rng);
    assert.ok(['good', 'bad'].includes(t.kind));
    assert.ok(G.TAG_PERCENTS.includes(t.percent));
    assert.ok(t.x >= 0 && t.x <= s.width);
  }
  assert.equal(s.tags.length, 100);
});

test('collides() detects circle overlap', () => {
  const t = G.makeTag(G.createState(), 100, 40, 'good', seeded());
  t.x = 100; t.y = 100;
  assert.equal(G.collides(100, 100, 10, t), true);
  assert.equal(G.collides(100, 100, 10, { ...t, x: 300, y: 300 }), false);
});

test('reset() restores a fresh run and preserves best', () => {
  const s = G.createState({ width: 360, height: 640, best: 900 });
  G.onCatch(s, G.makeTag(s, 180, 50, 'good', seeded()));
  G.tick(s, 24);
  s.hp = 0;
  G.reset(s, 900);
  assert.equal(s.score, 0);
  assert.equal(s.hp, G.HP_MAX);
  assert.equal(s.level, 1);
  assert.equal(s.combo, 0);
  assert.equal(s.gameOver, false);
  assert.equal(s.best, 900);
  assert.equal(s.tags.length, 0);
});

test('new best is flagged and tracked when the score overtakes it', () => {
  const s = G.createState({ width: 360, height: 640, best: 40 });
  G.onCatch(s, G.makeTag(s, 180, 50, 'good', seeded())); // +50 -> beats 40
  assert.equal(s.newBest, true);
  assert.equal(s.best, 50);
});
