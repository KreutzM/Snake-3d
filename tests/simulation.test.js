import test from 'node:test';
import assert from 'node:assert/strict';
import { SnakeSimulation, CLEAN_LEVEL_BONUS, LEVELS, OBSTACLES, distance } from '../src/simulation.js';
import { terrainHeight, surfaceHeight, distance3D, surfaceStep } from '../src/terrain.js';

test('moves continuously and collects energy, growing by two metres', () => {
  const game = new SnakeSimulation(() => .5);
  for (let i = 0; i < 200; i++) game.update(1 / 120, 0, 4.8);
  assert.equal(game.alive, true); assert.equal(game.score, 10); assert.equal(game.length, 8);
  assert.ok(Math.abs(game.head.z - 1) < .001);
  assert.ok(game.bodyPoints().length > 10);
});
test('turn rate is bounded and movement is frame-rate independent', () => {
  const slow = new SnakeSimulation(), fast = new SnakeSimulation();
  for (let i = 0; i < 60; i++) slow.update(1 / 60, .8, 4);
  for (let i = 0; i < 120; i++) fast.update(1 / 120, .8, 4);
  assert.ok(distance(slow.head, fast.head) < .025);
  const game = new SnakeSimulation(); game.update(1 / 120, Math.PI, 4);
  assert.ok(Math.abs(game.yaw) <= 2.7 / 120 + 1e-9);
});
test('wall and column collisions end a run', () => {
  const wall = new SnakeSimulation(); wall.head = { x: 17.49, z: 0 }; wall.yaw = Math.PI / 2;
  assert.equal(wall.update(1 / 120, Math.PI / 2, 6), 'collision'); assert.match(wall.reason, /Arenawand/);
  const column = new SnakeSimulation(); column.head = { x: -7, z: -3.2 };
  assert.equal(column.update(1 / 120, 0, 6), 'collision'); assert.match(column.reason, /Säule/);
});
test('old body collides, adjacent neck does not', () => {
  const game = new SnakeSimulation();
  assert.equal(game.update(1 / 120, 0, 4), null);
  game.path.push({ x: game.head.x, z: game.head.z - .1, d: game.travel - 4 });
  assert.equal(game.update(1 / 120, 0, 4), 'collision'); assert.match(game.reason, /Körper/);
});
test('energy respawns inside arena away from body and obstacles', () => {
  for (let i = 0; i <= 100; i++) {
    const game = new SnakeSimulation(() => i / 101); game.spawnFood();
    assert.ok(Math.abs(game.food.x) <= 16 && Math.abs(game.food.z) <= 16);
    assert.ok(distance(game.food, game.head) > 4);
    assert.ok(OBSTACLES.every(o => distance(game.food, o) >= o.radius + 1.7));
    assert.ok(game.bodyPoints(.7).every(p => distance(game.food, p) >= 1.5));
  }
});
test('a ended run does not move and restart clears progress', () => {
  const game = new SnakeSimulation(); game.alive = false;
  const before = { ...game.head }; game.update(.01, 1, 5); assert.deepEqual(game.head, before);
  game.score = 90; game.reset(); assert.equal(game.score, 0); assert.equal(game.length, 6); assert.equal(game.alive, true);
});
test('large time gaps cannot tunnel across arena and body history stays bounded', () => {
  const game = new SnakeSimulation(); const initial = { ...game.head };
  game.update(10, 0, 6); assert.ok(distance(game.head, initial) <= .101);
  for (let i = 0; i < 2000 && game.alive; i++) game.update(1 / 120, game.yaw + .01, 4.8);
  assert.ok(game.path.length < 400);
});

function collect(game, golden = false) {
  const point = { ...game.head };
  if (golden) { game.gold = point; game.goldRemaining = 10; }
  else game.foods[0] = point;
  return game.update(1 / 120, game.yaw, 0);
}
function elapse(game, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 120); i++) game.update(1 / 120, game.yaw, 0);
}
test('three separated targets remain available after collection', () => {
  const game = new SnakeSimulation(() => .5);
  assert.equal(game.foods.length, 3);
  const untouched = game.foods.slice(1).map(p => ({ ...p }));
  collect(game);
  assert.equal(game.foods.length, 3);
  assert.deepEqual(game.foods.slice(1), untouched);
  for (const a of game.foods) for (const b of game.foods) if (a !== b) assert.ok(distance(a, b) >= 3);
});
test('combo increases score up to five and expires after six seconds', () => {
  const game = new SnakeSimulation(() => .5);
  for (let i = 0; i < 6; i++) collect(game);
  assert.equal(game.combo, 5); assert.equal(game.score, 200);
  assert.equal(game.eaten, 6); assert.equal(game.length, 18);
  elapse(game, 6.1);
  assert.equal(game.combo, 0);
  collect(game); assert.equal(game.score, 210); assert.equal(game.combo, 1);
});
test('gold appears on schedule in a free spot, expires and returns', () => {
  const game = new SnakeSimulation(() => .5);
  elapse(game, 15.1);
  assert.ok(game.gold); assert.ok(game.goldRemaining > 9);
  assert.ok(game.foods.every(p => distance(p, game.gold) >= 3));
  assert.ok(game.bodyPoints(.7).every(p => distance(p, game.gold) >= 1.5));
  assert.ok(OBSTACLES.every(o => distance(o, game.gold) >= o.radius + 1.7));
  elapse(game, 10); assert.equal(game.gold, null);
  elapse(game, 15); assert.ok(game.gold);
});
test('gold uses the combo multiplier and does not remove regular targets', () => {
  const game = new SnakeSimulation(() => .5);
  collect(game); collect(game, true);
  assert.equal(game.score, 70); assert.equal(game.eaten, 2);
  assert.equal(game.foods.length, 3); assert.equal(game.gold, null);
  assert.deepEqual(game.lastPickup, { points: 60, golden: true, combo: 2 });
  assert.equal(game.goldCountdown, 15);
});
test('ten pickups unlock the portal; points alone never complete a level', () => {
  const game = new SnakeSimulation(() => .5);
  game.score = 1000; collect(game); assert.equal(game.portalOpen, false);
  for (let i = 1; i < 10; i++) collect(game, i === 9);
  assert.equal(game.portalOpen, true); assert.equal(game.levelComplete, false);
  assert.equal(game.alive, true); assert.equal(game.won, false);
  assert.equal(game.gold, null); assert.equal(game.foods.length, 0);
  elapse(game, 16); assert.equal(game.gold, null); assert.equal(game.foods.length, 0);
});
test('locked portal does not advance and collisions still matter after unlocking', () => {
  const game = new SnakeSimulation(); game.head = { ...game.level.portal };
  assert.equal(game.update(.01, 0, 0), null); assert.equal(game.nextLevel(), false);
  game.levelEaten = 10; game.head = { x: 17.49, z: 0 }; game.yaw = Math.PI / 2;
  assert.equal(game.update(1 / 120, game.yaw, 6), 'collision');
  assert.equal(game.levelComplete, false); assert.equal(game.nextLevel(), false);
});
test('three portal exits preserve total points, reset level state and finish the campaign', () => {
  const game = new SnakeSimulation(() => .5);
  let score = 0;
  for (let level = 0; level < LEVELS.length; level++) {
    assert.equal(game.levelIndex, level); assert.equal(game.score, score);
    assert.equal(game.levelEaten, 0); assert.equal(game.length, LEVELS[level].startLength);
    assert.equal(game.combo, 0); assert.equal(game.levelBestCombo, 0);
    assert.equal(game.goldCountdown, 15); assert.equal(game.gold, null);
    assert.deepEqual({ x: game.head.x, z: game.head.z }, LEVELS[level].start);
    for (let i = 0; i < 10; i++) collect(game);
    assert.equal(game.levelBestCombo, 5); score = game.score;
    game.head = { ...game.level.portal };
    assert.equal(game.update(.01, 0, 0), level === 2 ? 'victory' : 'level-complete');
    assert.equal(game.score, score + CLEAN_LEVEL_BONUS); score = game.score;
    const snapshot = JSON.stringify(game);
    elapse(game, 1); assert.equal(JSON.stringify(game), snapshot);
    assert.equal(game.nextLevel(), level < 2);
  }
  assert.equal(game.eaten, 30); assert.equal(game.won, true); assert.equal(game.alive, false);
  game.reset(); assert.equal(game.levelIndex, 0); assert.equal(game.score, 0);
  assert.equal(game.eaten, 0); assert.equal(game.levelComplete, false); assert.equal(game.won, false);
});
test('all level starts, food and portals are clear of walls and columns', () => {
  const game = new SnakeSimulation();
  for (let level = 0; level < LEVELS.length; level++) {
    game.loadLevel(level);
    for (const p of [...game.bodyPoints(), ...game.foods, game.level.portal]) {
      assert.ok(Math.max(Math.abs(p.x), Math.abs(p.z)) < game.level.halfSize - .5);
      assert.ok(game.obstacles.every(o => distance(p, o) > o.radius + .8));
    }
    assert.ok(game.obstacles.every(o => distance(game.level.portal, o) > o.radius + 1.65));
    for (let i = 0; i < 20; i++) {
      game.spawnFood(i % 3);
      assert.equal(game.foods.length, 3);
      for (const p of game.foods) {
        assert.ok(game.obstacles.every(o => distance(p, o) >= o.radius + 1.7));
        assert.ok(distance(p, game.level.portal) >= 3);
      }
    }
  }
});
test('later arenas use their own columns for collision detection', () => {
  const game = new SnakeSimulation();
  for (let level = 1; level < LEVELS.length; level++) {
    game.loadLevel(level);
    const o = game.obstacles[0]; game.head = { x: o.x, z: o.z + o.radius + .44 };
    assert.equal(game.update(1 / 120, 0, 6), 'collision');
  }
});
test('ended runs freeze timers and resetting clears bonus progress', () => {
  const game = new SnakeSimulation(); collect(game); game.gold = { x: 10, z: 10 }; game.goldRemaining = 5;
  game.alive = false; const remaining = game.comboRemaining;
  elapse(game, 2); assert.equal(game.comboRemaining, remaining); assert.equal(game.goldRemaining, 5);
  game.reset(); assert.equal(game.combo, 0); assert.equal(game.eaten, 0);
  assert.equal(game.gold, null); assert.equal(game.goldCountdown, 15); assert.equal(game.foods.length, 3);
});

function crash(game) {
  game.head = { x: game.level.halfSize - .51, z: 0 }; game.yaw = Math.PI / 2;
  return game.update(1 / 120, game.yaw, 6);
}
function complete(game) {
  while (!game.portalOpen) collect(game);
  game.head = { ...game.level.portal }; return game.update(.01, game.yaw, 0);
}
test('a collision consumes exactly one life and freezes until retry', () => {
  const game = new SnakeSimulation(); assert.equal(game.lives, 3);
  assert.equal(game.retryLevel(), false); collect(game);
  assert.equal(crash(game), 'collision'); assert.equal(game.lives, 2);
  assert.equal(game.score, 0); assert.equal(game.eaten, 0); assert.equal(game.lostPoints, 10);
  elapse(game, 10); assert.equal(game.lives, 2); assert.equal(game.levelDeaths, 1);
  assert.equal(game.retryLevel(), true); assert.equal(game.lives, 2);
  assert.equal(game.retryLevel(), false); assert.equal(game.levelDeaths, 1);
});
test('later-level retries restore the checkpoint, including body, timers and portal', () => {
  const game = new SnakeSimulation(() => .5); complete(game); game.nextLevel();
  const checkpoint = game.score; assert.equal(checkpoint, 500);
  for (let i = 0; i < 10; i++) collect(game);
  assert.equal(game.portalOpen, true); crash(game);
  assert.equal(game.score, checkpoint); assert.equal(game.eaten, 10);
  assert.equal(game.retryLevel(), true); assert.equal(game.levelIndex, 1);
  assert.equal(game.levelEaten, 0); assert.equal(game.portalOpen, false);
  assert.equal(game.combo, 0); assert.equal(game.levelBestCombo, 0);
  assert.equal(game.goldRemaining, 0); assert.equal(game.goldCountdown, 15);
  assert.equal(game.length, game.level.startLength); assert.deepEqual({ x: game.head.x, z: game.head.z }, game.level.start);
  assert.equal(game.foods.length, 3); assert.equal(game.travel, 0);
});
test('retrying cannot farm points or restore the clean-level bonus', () => {
  const game = new SnakeSimulation(() => .5);
  complete(game); assert.equal(game.levelBonus, 100);
  const secured = game.score; game.nextLevel();
  collect(game, true); crash(game); game.retryLevel();
  assert.equal(game.score, secured);
  complete(game); assert.equal(game.levelBonus, 0); assert.equal(game.score, secured + 400);
  const done = game.score; assert.equal(game.update(.01, 0, 0), null); assert.equal(game.score, done);
  assert.equal(game.retryLevel(), false); game.nextLevel();
  assert.equal(game.levelDeaths, 0); assert.equal(game.lives, 2);
  complete(game); assert.equal(game.levelBonus, 100); assert.equal(game.score, done + 500);
  assert.equal(game.won, true); assert.equal(game.retryLevel(), false);
});
test('third collision ends the run and a new run restores three lives', () => {
  const game = new SnakeSimulation();
  for (let remaining = 2; remaining >= 0; remaining--) {
    collect(game); crash(game); assert.equal(game.lives, remaining);
    assert.equal(game.retryLevel(), remaining > 0);
  }
  assert.equal(game.alive, false); assert.equal(game.score, 0);
  assert.equal(game.nextLevel(), false); elapse(game, 1); assert.equal(game.lives, 0);
  game.reset(); assert.equal(game.lives, 3); assert.equal(game.levelIndex, 0);
  assert.equal(game.levelDeaths, 0); assert.equal(game.alive, true);
});
test('columns and self-collisions also consume a life', () => {
  const column = new SnakeSimulation(); column.head = { x: -7, z: -3.2 };
  column.update(1 / 120, 0, 6); assert.equal(column.lives, 2);
  const body = new SnakeSimulation(); body.path.push({ x: body.head.x, z: body.head.z - .1, d: -4 });
  body.update(1 / 120, 0, 6); assert.equal(body.lives, 2);
});

test('terrain produces real height differences and keeps movement on the surface', () => {
  const game = new SnakeSimulation();
  assert.equal(terrainHeight(LEVELS[0], 0, 9), game.head.y);
  assert.ok(terrainHeight(LEVELS[0], 8, -9) > 2.5);
  assert.ok(terrainHeight(LEVELS[1], -8, -6) > 3);
  assert.ok(surfaceHeight(LEVELS[2], 0, -4, 'bridge:0') > 4);
  const before = { x: -9, z: 5, y: terrainHeight(LEVELS[0], -9, 5) };
  const stepped = surfaceStep(LEVELS[0], before, 0, 8);
  assert.ok(stepped.y > before.y);
  assert.ok(Math.abs(stepped.y - terrainHeight(LEVELS[0], stepped.x, stepped.z)) < 1e-8);
  game.head = { ...before }; game.path = [{ ...before, d: 0 }];
  for (let i = 0; i < 120; i++) game.update(1 / 120, 0, 4.8);
  assert.ok(game.alive);
  assert.ok(Math.abs(game.head.y - terrainHeight(game.level, game.head.x, game.head.z)) < 1e-8);
  assert.ok(game.bodyPoints().some(p => (p.y || 0) > .5));
});

test('terrain is continuous at arena edges and targets receive surface heights', () => {
  for (const level of LEVELS) {
    assert.equal(terrainHeight(level, level.halfSize, 0), 0);
    assert.equal(terrainHeight(level, -level.halfSize, 0), 0);
    const game = new SnakeSimulation(); game.loadLevel(LEVELS.indexOf(level));
    for (const food of game.foods) assert.equal(food.y, surfaceHeight(level, food.x, food.z, food.surface || 'ground'));
    assert.equal(game.portal.y, surfaceHeight(level, level.portal.x, level.portal.z, level.portal.surface || 'ground'));
  }
});

test('level three offers an upper bridge and a lower underpass route', () => {
  const upper = new SnakeSimulation(); upper.loadLevel(2);
  upper.head = { x: 0, y: 0, z: 7, surface: 'ground' }; upper.path = [{ ...upper.head, d: 0 }];
  for (let i = 0; i < 100; i++) upper.update(1 / 120, 0, 4.8);
  assert.equal(upper.surface, 'bridge:0');
  assert.ok(upper.head.y > 2);
  assert.ok(upper.bodyPoints().some(p => p.surface === 'bridge:0'));
  upper.head = { x: 0, y: surfaceHeight(upper.level, 0, -5, 'bridge:0'), z: -5, surface: 'bridge:0' };
  upper.path = [{ ...upper.head, d: upper.travel }];
  assert.equal(upper.update(1 / 120, 0, 0), null); // the bridge passes above the central column

  const lower = new SnakeSimulation(); lower.loadLevel(2);
  lower.head = { x: 8, y: terrainHeight(lower.level, 8, 7), z: 7, surface: 'ground' };
  lower.path = [{ ...lower.head, d: 0 }];
  for (let i = 0; i < 180; i++) lower.update(1 / 120, 0, 4.8);
  assert.equal(lower.surface, 'ground');
  assert.ok(lower.head.z < 1);
  assert.ok(lower.head.y < 1);
});

test('level three descent stays on the bridge until the outer ramp foot', () => {
  const game = new SnakeSimulation(); game.loadLevel(2);
  game.surface = 'bridge:0';
  game.head = { x: 0, y: surfaceHeight(game.level, 0, -9, 'bridge:0'), z: -9, surface: 'bridge:0' };
  game.path = [{ ...game.head, d: game.travel }];

  for (let i = 0; i < 300 && game.surface !== 'ground'; i++) {
    assert.notEqual(game.update(1 / 120, 0, 4.8), 'collision');
    if (game.head.z < -10.5 && game.head.z > -14) assert.equal(game.surface, 'bridge:0');
  }

  assert.equal(game.surface, 'ground');
  assert.ok(game.head.z <= -14);
  assert.ok(game.head.y < .01);
  assert.ok(game.alive);
});

test('level three can be entered from either ramp foot', () => {
  for (const { z, yaw } of [{ z: 7, yaw: 0 }, { z: -15, yaw: Math.PI }]) {
    const game = new SnakeSimulation(); game.loadLevel(2);
    game.yaw = yaw;
    game.head = { x: 0, y: terrainHeight(game.level, 0, z), z, surface: 'ground' };
    game.path = [{ ...game.head, d: game.travel }];

    for (let i = 0; i < 100 && game.surface === 'ground'; i++) {
      assert.notEqual(game.update(1 / 120, yaw, 4.8), 'collision');
    }

    assert.equal(game.surface, 'bridge:0');
    game.update(1 / 120, yaw, 4.8);
    assert.ok(game.head.y > 0);
  }
});

test('leaving a bridge sideways costs a life instead of teleporting to ground', () => {
  const game = new SnakeSimulation(); game.loadLevel(2);
  game.surface = 'bridge:0';
  game.head = { x: 3.2, y: surfaceHeight(game.level, 3.2, -4, 'bridge:0'), z: -4, surface: 'bridge:0' };
  game.path = [{ ...game.head, d: 0 }];
  assert.equal(game.update(1 / 120, Math.PI / 2, 4.8), 'collision');
  assert.match(game.reason, /Brücke/); assert.equal(game.lives, 2);
});
