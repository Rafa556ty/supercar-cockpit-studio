import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { poseWheelCorners, wheelAxle } from "./wheel-corners";

/** A loader-style wheel part: geometry centred on its own box, mesh placed at that centre. */
function part(geo: THREE.BufferGeometry, name: string) {
  geo.computeBoundingBox();
  const c = geo.boundingBox!.getCenter(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z);
  const m = new THREE.Mesh(geo);
  m.name = name;
  m.position.copy(c);
  m.userData["wheel"] = true;
  m.userData["front"] = true;
  m.userData["radius"] = 0.2;
  return m;
}
/** Tyre at (0.85, 0.33, -1.25), axle on X, yawed by `steer` radians (as the SVJ file ships its fronts). */
function tyre(steer: number) {
  const g = new THREE.CylinderGeometry(0.33, 0.33, 0.3, 48, 1, true);
  g.rotateZ(Math.PI / 2);
  g.rotateY(steer);
  g.translate(0.85, 0.33, -1.25);
  return g;
}

describe("wheel axle", () => {
  it("finds the axle of a straight wheel", () => {
    const g = tyre(0);
    expect(wheelAxle(g.getAttribute("position").array).angleTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(0.01);
  });
  it("finds a 20° pre-steered axle", () => {
    const g = tyre(THREE.MathUtils.degToRad(20));
    const yaw = THREE.MathUtils.radToDeg(new THREE.Vector3(1, 0, 0).angleTo(wheelAxle(g.getAttribute("position").array)));
    expect(yaw).toBeCloseTo(20, 0);
  });
});

describe("SVJ pre-steered front wheels", () => {
  it("are turned straight so the car drives with its wheels pointing forward", () => {
    const car = new THREE.Group();
    const t = part(tyre(THREE.MathUtils.degToRad(20)), "Object_47_RF");
    car.add(t);
    poseWheelCorners(car, { straighten: true });
    const axle = wheelAxle(t.geometry.getAttribute("position").array);
    expect(THREE.MathUtils.radToDeg(axle.angleTo(new THREE.Vector3(1, 0, 0)))).toBeLessThan(1.5);
  });
});

describe("multi-part wheels", () => {
  it("spin every part around the one hub at the tyre's rate", () => {
    const car = new THREE.Group();
    const t = part(tyre(0), "tyre_LF");
    // An off-centre wheel bolt 0.1 m above the hub.
    const bolt = part(new THREE.BoxGeometry(0.02, 0.02, 0.02).translate(0.95, 0.43, -1.25), "bolt_LF");
    car.add(t, bolt);
    poseWheelCorners(car);
    expect(bolt.position.distanceTo(t.position)).toBeLessThan(1e-6);
    expect(t.position.y).toBeCloseTo(0.33, 3);
    expect(t.position.z).toBeCloseTo(-1.25, 3);
    expect(bolt.userData["radius"]).toBe(t.userData["radius"]);
    expect(t.userData["radius"]).toBeCloseTo(0.33, 2);
    // Spinning half a turn moves the bolt to below the hub, not around its own centre.
    bolt.rotation.x = Math.PI;
    bolt.updateMatrixWorld(true);
    bolt.geometry.computeBoundingBox();
    const c = bolt.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(bolt.matrixWorld);
    expect(c.y).toBeCloseTo(0.23, 3);
  });
});
