// Finds a steering wheel baked into a car's interior mesh so it can be cut out
// and turned. Pure (arrays in, triangle lists out) and unit-tested.
// Car-local metres: nose toward -z, driver on the left (-x).
import { wheelAxle } from "./wheel-corners";

export type Vec3 = [number, number, number];

/** Where a steering wheel can sit relative to the driver's eyes. */
const ZONE = { x: 0.34, yLow: -0.7, yHigh: 0.05, zNear: -0.12, zFar: -1.0 };
/** Plausible rim: 28–46 cm across, centred near the driver's line. */
/** Outer radius of a rim cut out around its hub (m). */
const ANNULUS_OUTER = 0.205;
const RIM = { min: 0.27, max: 0.47, offCentre: 0.14, maxDepth: 0.24, slice: 0.2 };

type Tri = { mesh: number; tri: number };

/**
 * `meshes` holds non-indexed xyz triplets per mesh (3 vertices per triangle).
 * Returns the triangles of the wheel per mesh index, or null when no rim is found.
 */
/** Triangles per mesh, the column axis (towards the driver) and the rim's centre. */
export type WheelCut = { tris: Map<number, number[]>; axis: Vec3; center: Vec3 };

/** Column axis (towards the driver) used when the rim's own plane is unclear. */
export const DEFAULT_COLUMN_TILT = 0.36; // rad from horizontal

/** A column points at the driver, tilted 5–45° up; anything else is a bad fit. */
export function columnAxis(pca: Vec3): Vec3 {
  let [x, y, z] = pca;
  if (z < 0) [x, y, z] = [-x, -y, -z];
  const ok = Math.abs(x) < 0.25 && z > 0.7 && y > 0.05 && y < 0.72;
  if (ok) return [x, y, z];
  return [0, Math.sin(DEFAULT_COLUMN_TILT), Math.cos(DEFAULT_COLUMN_TILT)];
}

export function findSteeringWheel(
  meshes: ArrayLike<number>[],
  eye: Vec3,
  debug?: unknown[],
): WheelCut | null {
  const [ex, ey, ez] = eye;
  const inZone = (x: number, y: number, z: number) =>
    Math.abs(x - ex) < ZONE.x && y > ey + ZONE.yLow && y < ey + ZONE.yHigh && z < ez + ZONE.zNear && z > ez + ZONE.zFar;

  // 1. Triangles fully inside the zone.
  const tris: Tri[] = [];
  meshes.forEach((p, mesh) => {
    const n = Math.floor(p.length / 9);
    for (let t = 0; t < n; t++) {
      let ok = true;
      for (let k = 0; k < 3 && ok; k++) {
        const o = t * 9 + k * 3;
        ok = inZone(p[o]!, p[o + 1]!, p[o + 2]!);
      }
      if (ok) tris.push({ mesh, tri: t });
    }
  });
  if (tris.length < 40) return null;

  // 2. Connected pieces: weld vertices at 1.5 mm so UV/material seams stay joined.
  const parent = tris.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!;
    return i;
  };
  const seen = new Map<string, number>();
  tris.forEach(({ mesh, tri }, i) => {
    const p = meshes[mesh]!;
    for (let k = 0; k < 3; k++) {
      const o = tri * 9 + k * 3;
      const key = `${Math.round(p[o]! / 0.0015)},${Math.round(p[o + 1]! / 0.0015)},${Math.round(p[o + 2]! / 0.0015)}`;
      const j = seen.get(key);
      if (j === undefined) seen.set(key, i);
      else parent[find(i)] = find(j);
    }
  });
  const comps = new Map<number, number[]>();
  tris.forEach((_, i) => {
    const r = find(i);
    let c = comps.get(r);
    if (!c) comps.set(r, (c = []));
    c.push(i);
  });

  const vertsOf = (ids: number[]) => {
    const out = new Float32Array(ids.length * 9);
    ids.forEach((id, n) => {
      const { mesh, tri } = tris[id]!;
      const p = meshes[mesh]!;
      for (let k = 0; k < 9; k++) out[n * 9 + k] = p[tri * 9 + k]!;
    });
    return out;
  };
  const boxOf = (v: Float32Array) => {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < v.length; i += 3)
      for (let a = 0; a < 3; a++) {
        mn[a] = Math.min(mn[a]!, v[i + a]!);
        mx[a] = Math.max(mx[a]!, v[i + a]!);
      }
    return { mn, mx };
  };

  // 3. The rim: a piece about a wheel across (x) and tall (y), in front of the driver.
  let rim: { ids: number[]; v: Float32Array; score: number } | null = null;
  for (const whole of comps.values()) {
    if (whole.length < 24) continue;
    let ids = whole;
    let v = vertsOf(ids);
    let { mn, mx } = boxOf(v);
    if (mx[2]! - mn[2]! > RIM.maxDepth) {
      // Rim welded to its column: keep the driver-side slice where the rim sits.
      const cutZ = mx[2]! - RIM.slice;
      ids = ids.filter((id) => {
        const { mesh, tri } = tris[id]!;
        const p = meshes[mesh]!;
        return p[tri * 9 + 2]! > cutZ && p[tri * 9 + 5]! > cutZ && p[tri * 9 + 8]! > cutZ;
      });
      if (ids.length < 24) continue;
      v = vertsOf(ids);
      ({ mn, mx } = boxOf(v));
    }
    const w = mx[0]! - mn[0]!, h = mx[1]! - mn[1]!;
    debug?.push({ n: ids.length, mn: mn.map((x) => +x.toFixed(3)), mx: mx.map((x) => +x.toFixed(3)) });
    const cx = (mn[0]! + mx[0]!) / 2;
    if (w < RIM.min || w > RIM.max || h < RIM.min * 0.8 || h > RIM.max) continue;
    if (Math.abs(cx - ex) > RIM.offCentre) continue;
    // A rim tilted on its column is shallow front-to-back.
    if (mx[2]! - mn[2]! > RIM.maxDepth) continue;
    // Round and hollow: a rim's vertices sit near its outline, not its middle.
    const cy = (mn[1]! + mx[1]!) / 2;
    let ring = 0;
    for (let i = 0; i < v.length; i += 3) {
      const r = Math.hypot((v[i]! - cx) / (w / 2), (v[i + 1]! - cy) / (h / 2));
      if (r > 0.7) ring++;
    }
    const score = (ring / (v.length / 3)) * Math.log(ids.length);
    if (ring / (v.length / 3) > 0.45 && (!rim || score > rim.score)) rim = { ids, v, score };
  }
  if (!rim) return annulusCut(tris, meshes, comps, vertsOf, boxOf, eye);

  // 4. Pieces lying on the rim's plane inside its circle (spokes, hub, badge, buttons).
  const pca = wheelAxle(rim.v);
  const [ax, ay, az] = columnAxis([pca.x, pca.y, pca.z]);
  const axis = { x: ax, y: ay, z: az };
  const { mn, mx } = boxOf(rim.v);
  const c = [(mn[0]! + mx[0]!) / 2, (mn[1]! + mx[1]!) / 2, (mn[2]! + mx[2]!) / 2];
  const radius = Math.max(mx[0]! - mn[0]!, mx[1]! - mn[1]!) / 2 + 0.02;
  const fits = (v: Float32Array) => {
    for (let i = 0; i < v.length; i += 3) {
      const d = [v[i]! - c[0]!, v[i + 1]! - c[1]!, v[i + 2]! - c[2]!];
      const along = d[0]! * axis.x + d[1]! * axis.y + d[2]! * axis.z;
      const radial = Math.sqrt(Math.max(0, d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2 - along * along));
      if (Math.abs(along) > 0.075 || radial > radius) return false;
    }
    return true;
  };
  const chosen: number[] = [...rim.ids];
  const inRim = new Set(rim.ids);
  for (const ids of comps.values()) {
    if (inRim.has(ids[0]!) || ids.some((id) => inRim.has(id))) continue;
    if (fits(vertsOf(ids))) chosen.push(...ids);
  }
  const out = new Map<number, number[]>();
  for (const id of chosen) {
    const { mesh, tri } = tris[id]!;
    let list = out.get(mesh);
    if (!list) out.set(mesh, (list = []));
    list.push(tri);
  }
  return { tris: out, axis: [ax, ay, az], center: [c[0]!, c[1]!, c[2]!] };
}

/**
 * Fallback for a rim welded into the dashboard mesh (Tourbillon): find the
 * hub the rim turns around, then cut the ring of triangles around it on the
 * column's plane. The hub itself stays put, like a fixed-centre wheel.
 */
function annulusCut(
  tris: Tri[],
  meshes: ArrayLike<number>[],
  comps: Map<number, number[]>,
  vertsOf: (ids: number[]) => Float32Array,
  boxOf: (v: Float32Array) => { mn: number[]; mx: number[] },
  eye: Vec3,
): WheelCut | null {
  const [ex, ey, ez] = eye;
  let hub: { c: number[]; r: number; n: number } | null = null;
  for (const ids of comps.values()) {
    if (ids.length < 200) continue;
    const { mn, mx } = boxOf(vertsOf(ids));
    const w = mx[0]! - mn[0]!, h = mx[1]! - mn[1]!;
    const c = [(mn[0]! + mx[0]!) / 2, (mn[1]! + mx[1]!) / 2, (mn[2]! + mx[2]!) / 2];
    if (w < 0.1 || w > 0.26 || h < 0.1 || h > 0.26) continue;
    if (Math.abs(c[0]! - ex) > 0.1 || c[1]! > ey - 0.12 || c[1]! < ey - 0.45) continue;
    if (c[2]! > ez - 0.3 || c[2]! < ez - 0.8) continue;
    if (!hub || ids.length > hub.n) hub = { c, r: Math.max(w, h) / 2, n: ids.length };
  }
  if (!hub) return null;
  const axis: Vec3 = [0, Math.sin(DEFAULT_COLUMN_TILT), Math.cos(DEFAULT_COLUMN_TILT)];
  const inner = hub.r * 0.95, outer = ANNULUS_OUTER;
  const out = new Map<number, number[]>();
  let count = 0;
  for (const { mesh, tri } of tris) {
    const p = meshes[mesh]!;
    let ok = true;
    for (let k = 0; k < 3 && ok; k++) {
      const o = tri * 9 + k * 3;
      const d = [p[o]! - hub.c[0]!, p[o + 1]! - hub.c[1]!, p[o + 2]! - hub.c[2]!];
      const along = d[0]! * axis[0] + d[1]! * axis[1] + d[2]! * axis[2];
      const radial = Math.sqrt(Math.max(0, d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2 - along * along));
      ok = Math.abs(along) < 0.06 && radial > inner && radial < outer;
    }
    if (!ok) continue;
    let list = out.get(mesh);
    if (!list) out.set(mesh, (list = []));
    list.push(tri);
    count++;
  }
  if (count < 60) return null;
  return { tris: out, axis, center: [hub.c[0]!, hub.c[1]!, hub.c[2]!] };
}
