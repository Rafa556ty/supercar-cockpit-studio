// Wheel corners for playable cars whose GLB splits each wheel into many parts
// (tyre segments, rim, disc, bolts). The loader cuts every part into its own
// mesh centred on its own box; spinning those around their own centres makes
// the wheel wobble or fly apart. Here every part of a corner is re-pivoted on
// one shared hub so the whole wheel turns as one, and wheels the file ships
// already steered are turned straight first.
import * as THREE from "three";

/** Axle direction of a wheel: the axis its vertices spread least along. */
export function wheelAxle(positions: ArrayLike<number>): THREE.Vector3 {
  const n = Math.floor(positions.length / 3);
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += positions[i * 3]!; cy += positions[i * 3 + 1]!; cz += positions[i * 3 + 2]!; }
  cx /= Math.max(1, n); cy /= Math.max(1, n); cz /= Math.max(1, n);
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const d = [positions[i * 3]! - cx, positions[i * 3 + 1]! - cy, positions[i * 3 + 2]! - cz];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) c[r * 3 + k]! += d[r]! * d[k]!;
  }
  // The largest eigenvector of (trace·I − C) is the smallest one of C.
  const tr = c[0]! + c[4]! + c[8]!;
  const a = c.map((v, i) => (i % 4 === 0 ? tr - v : -v));
  let v = new THREE.Vector3(1, 0.13, 0.07).normalize();
  for (let it = 0; it < 80; it++) {
    v = new THREE.Vector3(
      a[0]! * v.x + a[1]! * v.y + a[2]! * v.z,
      a[3]! * v.x + a[4]! * v.y + a[5]! * v.z,
      a[6]! * v.x + a[7]! * v.y + a[8]! * v.z,
    ).normalize();
  }
  return v.x < 0 ? v.negate() : v;
}

/** Below this the file's wheel already points straight. */
const STRAIGHT_ENOUGH = THREE.MathUtils.degToRad(1.5);

export function poseWheelCorners(car: THREE.Object3D, opts: { straighten?: boolean } = {}) {
  const corners = new Map<string, THREE.Mesh[]>();
  car.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.userData["wheel"]) return;
    const corner = /_([LR][FR])$/.exec(m.name)?.[1];
    if (!corner) return;
    corners.set(corner, [...(corners.get(corner) ?? []), m]);
  });
  const X = new THREE.Vector3(1, 0, 0);
  const box = new THREE.Box3();
  const partBox = (p: THREE.Mesh) => {
    p.geometry.computeBoundingBox();
    return p.geometry.boundingBox!.clone().translate(p.position);
  };
  for (const parts of corners.values()) {
    // Tyre = the part with the biggest outline; its centre is the hub.
    const size = (p: THREE.Mesh) => partBox(p).getSize(new THREE.Vector3());
    const tyre = parts.reduce((best, p) => (size(p).y * size(p).z > size(best).y * size(best).z ? p : best));
    let hub = partBox(tyre).getCenter(new THREE.Vector3());
    if (opts.straighten) {
      const axle = wheelAxle(tyre.geometry.getAttribute("position").array as ArrayLike<number>);
      if (axle.angleTo(X) > STRAIGHT_ENOUGH) {
        const q = new THREE.Quaternion().setFromUnitVectors(axle, X);
        for (const part of parts) {
          const g = part.geometry;
          g.translate(part.position.x - hub.x, part.position.y - hub.y, part.position.z - hub.z);
          g.applyQuaternion(q);
          g.translate(hub.x, hub.y, hub.z);
          part.position.set(0, 0, 0);
        }
        hub = partBox(tyre).getCenter(new THREE.Vector3());
      }
    }
    box.makeEmpty();
    for (const part of parts) box.union(partBox(part));
    const radius = Math.max(0.2, Math.max(box.max.y - box.min.y, box.max.z - box.min.z) / 2);
    for (const part of parts) {
      const g = part.geometry;
      g.translate(part.position.x - hub.x, part.position.y - hub.y, part.position.z - hub.z);
      g.computeBoundingBox();
      g.computeBoundingSphere();
      part.position.copy(hub);
      // Every part turns at the tyre's rate, so rim, disc and bolts never drift apart.
      part.userData["radius"] = radius;
    }
  }
}
