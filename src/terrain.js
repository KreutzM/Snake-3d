// A continuous heightfield: every (x, z) has one traversable surface.
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
export function onTerrain(level, point) {
  return { x: point.x, y: terrainHeight(level, point.x, point.z), z: point.z };
}
export const distance3D = (a, b) => Math.hypot(a.x - b.x, (a.y || 0) - (b.y || 0), a.z - b.z);
export function terrainSlope(level, x, z, yaw) {
  const dx = Math.sin(yaw) * .1, dz = -Math.cos(yaw) * .1;
  return (terrainHeight(level, x + dx, z + dz) - terrainHeight(level, x - dx, z - dz)) / .2;
}
export function surfaceStep(level, from, yaw, metres) {
  const slope = terrainSlope(level, from.x, from.z, yaw);
  let horizontal = metres / Math.sqrt(1 + slope * slope);
  let next = from;
  // Correct the local tangent estimate so speed measures distance on the slope.
  for (let i = 0; i < 3; i++) {
    next = onTerrain(level, { x: from.x + Math.sin(yaw) * horizontal, z: from.z - Math.cos(yaw) * horizontal });
    const actual = distance3D(from, next);
    if (actual <= 1e-10) break;
    horizontal *= metres / actual;
  }
  return next;
}
