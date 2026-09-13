import { onTerrain, distance3D, surfaceStep } from './terrain.js';
import { LEVELS } from './levels.js';
export { LEVELS };
export const HALF_SIZE = 18;
export const COMBO_WINDOW = 6;
export const GOLD_INTERVAL = 15;
export const GOLD_LIFETIME = 10;
export const START_LIVES = 3;
export const CLEAN_LEVEL_BONUS = 100;
export const OBSTACLES = LEVELS[0].obstacles;
export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// The simulation has no rendering or browser dependencies. Distances are metres.
export class SnakeSimulation {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    this.score = 0; this.eaten = 0; this.lives = START_LIVES;
    this.loadLevel(0);
  }
  get level() { return LEVELS[this.levelIndex]; }
  get obstacles() { return this.level.obstacles; }
  get portal() { return onTerrain(this.level, this.level.portal); }
  get portalOpen() { return this.levelEaten >= this.level.target; }
  loadLevel(index, retry = false) {
    this.levelIndex = index;
    this.head = onTerrain(this.level, this.level.start); this.yaw = 0; this.travel = 0;
    this.length = this.level.startLength; this.alive = true; this.won = false;
    this.levelComplete = false; this.levelEaten = 0; this.levelBestCombo = 0;
    this.levelStartScore = this.score;
    this.levelStartEaten = this.eaten;
    this.levelDeaths = retry ? this.levelDeaths : 0;
    this.levelBonus = 0; this.lostPoints = 0;
    this.reason = ''; this.foods = this.level.foods.map(p => onTerrain(this.level, p));
    this.combo = 0; this.comboRemaining = 0;
    this.gold = null; this.goldRemaining = 0; this.goldCountdown = GOLD_INTERVAL;
    this.lastPickup = null;
    this.path = [];
    let previous = this.head, d = 0;
    this.path.push({ ...previous, d });
    while (d > -this.length - 1) {
      const point = onTerrain(this.level, { x: previous.x, z: previous.z + .1 });
      d -= distance3D(previous, point); this.path.push({ ...point, d }); previous = point;
    }
  }
  nextLevel() {
    if (!this.levelComplete || this.won || this.levelIndex >= LEVELS.length - 1) return false;
    this.loadLevel(this.levelIndex + 1);
    return true;
  }
  retryLevel() {
    if (this.alive || this.lives <= 0 || this.won || this.levelComplete) return false;
    this.loadLevel(this.levelIndex, true);
    return true;
  }
  bodyPoints(spacing = .6) {
    const points = []; let index = 0;
    for (let offset = 0; offset <= this.length; offset += spacing) {
      const target = this.travel - offset;
      while (index < this.path.length - 2 && this.path[index + 1].d > target) index++;
      const a = this.path[index], b = this.path[index + 1] || a;
      const t = a.d === b.d ? 0 : Math.max(0, Math.min(1, (a.d - target) / (a.d - b.d)));
      points.push({ x: a.x + (b.x - a.x) * t, y: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * t, z: a.z + (b.z - a.z) * t });
    }
    return points;
  }
  get food() { return this.foods[0]; }
  set food(point) { this.foods[0] = point; }
  spawnFood(index = 0) {
    const point = this.freePosition(this.foods.filter((_, i) => i !== index));
    if (point) this.foods[index] = point;
    else this.foods.splice(index, 1);

  }
  freePosition(occupied = this.foods) {
    const body = this.bodyPoints(.7);
    const free = [];
    for (let x = -this.level.halfSize + 2; x <= this.level.halfSize - 2; x += 2) for (let z = -this.level.halfSize + 2; z <= this.level.halfSize - 2; z += 2) {
      const point = onTerrain(this.level, { x, z });
      if (distance(point, this.head) > 4 && !this.obstacles.some(o => distance(point, o) < o.radius + 1.7)
        && !body.some(p => distance(point, p) < 1.5)
        && distance(point, this.level.portal) >= 3
        && !occupied.some(p => distance(point, p) < 3)
        && (!this.gold || distance(point, this.gold) >= 3)) free.push(point);
    }
    return free.length ? free[Math.min(free.length - 1, Math.floor(this.random() * free.length))] : null;
  }
  update(dt, targetYaw, speed) {
    if (!this.alive || this.levelComplete) return null;
    // A bounded timestep prevents tunnelling through walls or the body.
    dt = Math.max(0, Math.min(dt, 1 / 60));
    this.comboRemaining = Math.max(0, this.comboRemaining - dt);
    if (!this.comboRemaining) this.combo = 0;
    if (!this.portalOpen && this.gold) {
      this.goldRemaining = Math.max(0, this.goldRemaining - dt);
      if (!this.goldRemaining) { this.gold = null; this.goldCountdown = GOLD_INTERVAL; }
    } else if (!this.portalOpen) {
      this.goldCountdown = Math.max(0, this.goldCountdown - dt);
      if (!this.goldCountdown) {
        this.gold = this.freePosition();
        this.goldRemaining = this.gold ? GOLD_LIFETIME : 0;
        this.goldCountdown = GOLD_INTERVAL;
      }
    }
    this.yaw += Math.max(-2.7 * dt, Math.min(2.7 * dt, wrapAngle(targetYaw - this.yaw)));
    this.head = onTerrain(this.level, this.head);
    const next = surfaceStep(this.level, this.head, this.yaw, speed * dt);
    let reason = '';
    if (Math.abs(next.x) > this.level.halfSize - .5 || Math.abs(next.z) > this.level.halfSize - .5) reason = 'Die Arenawand war schneller.';
    else if (this.obstacles.some(o => distance(next, o) < o.radius + .43)) reason = 'Eine Säule hat deinen Run gestoppt.';
    else if (this.path.some(p => this.travel - p.d > 2.5 && this.travel - p.d < this.length && distance3D(next, p) < .78)) reason = 'Dein eigener Körper hat den Weg gekreuzt.';
    if (reason) {
      this.alive = false; this.reason = reason; this.lives--; this.levelDeaths++;
      this.lostPoints = this.score - this.levelStartScore;
      this.score = this.levelStartScore; this.eaten = this.levelStartEaten;
      return 'collision';
    }
    this.travel += distance3D(this.head, next); this.head = next;
    this.path.unshift({ ...next, d: this.travel });
    while (this.path.length > 2 && this.path.at(-2).d < this.travel - this.length - .3) this.path.pop();
    if (this.portalOpen && distance3D(this.head, this.portal) < 1.5) {
      this.levelComplete = true;
      this.levelBonus = this.levelDeaths === 0 ? CLEAN_LEVEL_BONUS : 0;
      this.score += this.levelBonus;
      if (this.levelIndex === LEVELS.length - 1) { this.won = true; this.alive = false; }
      return this.won ? 'victory' : 'level-complete';
    }
    // Retry temporarily unavailable spawn slots as the body moves out of the way.
    if (!this.portalOpen && this.foods.length < 3) this.spawnFood(this.foods.length);
    const index = this.foods.findIndex(p => distance3D(this.head, p) < 1);
    const golden = this.gold && distance3D(this.head, this.gold) < 1;
    if (index >= 0 || golden) {
      this.combo = Math.min(5, this.combo + 1); this.comboRemaining = COMBO_WINDOW;
      const points = (golden ? 30 : 10) * this.combo;
      this.score += points; this.length += 2; this.eaten++; this.levelEaten++;
      this.levelBestCombo = Math.max(this.levelBestCombo, this.combo);
      this.lastPickup = { points, golden: Boolean(golden), combo: this.combo };
      if (golden) { this.gold = null; this.goldRemaining = 0; this.goldCountdown = GOLD_INTERVAL; }
      if (this.portalOpen) { this.foods = []; this.gold = null; this.goldRemaining = 0; }
      else if (!golden) this.spawnFood(index);
      return 'food';
    }
    return null;
  }
}
