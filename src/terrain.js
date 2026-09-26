// Terrain surfaces provide a ground route and optional raised routes.
const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
export function terrainHeight(level, x, z) {
  let height = 0;
  for (const feature of level.terrain || []) {
    if (feature.type === 'hill') {
      const radius = Math.hypot(x - feature.x, z - feature.z) / feature.radius;
      height += feature.height * (1 - smooth(radius));
    } else {
      const rampX = 1 - smooth((Math.abs(x - feature.x) - feature.halfX) / feature.ramp);
      const rampZ = 1 - smooth((Math.abs(z - feature.z) - feature.halfZ) / feature.ramp);
      height += feature.height * rampX * rampZ;
    }
  }
  // Meet the arena border at ground level, without an abrupt edge.
  return height * smooth((level.halfSize - Math.abs(x)) / 2) * smooth((level.halfSize - Math.abs(z)) / 2);
}
function bridge(level, surface) {
  const index = Number(String(surface).split(':')[1]);
  return Number.isInteger(index) ? (level.structures || [])[index] : null;
}
export function surfaceHeight(level, x, z, surface = 'ground') {
  const base = terrainHeight(level, x, z);
  const structure = bridge(level, surface);
  if (!structure) return base;
  const along = Math.abs(z - structure.z);
  const halfLength = structure.length / 2;
  const distanceToDeck = Math.max(0, along - halfLength);
  const ramp = Math.max(0, Math.min(1, 1 - distanceToDeck / structure.ramp));
  return base + structure.height * smooth(ramp);
}
export function onTerrain(level, point, surface = 'ground') {
  return { x: point.x, y: surfaceHeight(level, point.x, point.z, point.surface || surface), z: point.z, surface: point.surface || surface };
}
export const distance3D = (a, b) => Math.hypot(a.x - b.x, (a.y || 0) - (b.y || 0), a.z - b.z);
export function terrainSlope(level, x, z, yaw) {
  const dx = Math.sin(yaw) * .1, dz = -Math.cos(yaw) * .1;
  return (terrainHeight(level, x + dx, z + dz) - terrainHeight(level, x - dx, z - dz)) / .2;
}
export function surfaceStep(level, from, yaw, metres, surface = from.surface || 'ground') {
  const slope = (surfaceHeight(level, from.x + Math.sin(yaw) * .1, from.z - Math.cos(yaw) * .1, surface)
    - surfaceHeight(level, from.x - Math.sin(yaw) * .1, from.z + Math.cos(yaw) * .1, surface)) / .2;
  let horizontal = metres / Math.sqrt(1 + slope * slope);
  let next = from;
  // Correct the local tangent estimate so speed measures distance on the slope.
  for (let i = 0; i < 3; i++) {
    next = onTerrain(level, { x: from.x + Math.sin(yaw) * horizontal, z: from.z - Math.cos(yaw) * horizontal }, surface);
    const actual = distance3D(from, next);
    if (actual <= 1e-10) break;
    horizontal *= metres / actual;
  }
  return next;
}
export function surfaceTransition(level, from, next) {
  const current = from.surface || 'ground';
  const structure = bridge(level, current);
  if (structure) {
    const along = Math.abs(next.z - structure.z);
    const inside = Math.abs(next.x - structure.x) <= structure.width / 2 + .15;
    const inRamp = Math.abs(next.z - structure.z) <= structure.length / 2 + structure.ramp;
    if (!inside) return 'fall';
    if (!inRamp) return 'fall';
    if (along <= structure.length / 2) return current;
    if (along < Math.abs(from.z - structure.z)) return current;
    return 'ground';
  }
  for (let i = 0; i < (level.structures || []).length; i++) {
    const candidate = level.structures[i];
    if (candidate.type !== 'bridge') continue;
    const inside = Math.abs(next.x - candidate.x) <= candidate.width / 2;
    const along = Math.abs(next.z - candidate.z);
    const atRampFoot = along >= candidate.length / 2 + candidate.ramp - .2;
    const inRamp = along <= candidate.length / 2 + candidate.ramp;
    if (inside && inRamp && atRampFoot) return `bridge:${i}`;
  }
  return 'ground';
}
