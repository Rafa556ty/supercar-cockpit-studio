import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { insideRevueltoCabin, stripRevueltoInterior } from "./revuelto-cabin";
import { COCKPIT_SEATS } from "./cockpit";

const tri = (pts: number[][]) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
  return g;
};
const at = (x: number, y: number, z: number) => [[x, y, z], [x + 0.01, y, z], [x, y + 0.01, z]];

describe("Revuelto rebuilt cabin", () => {
  it("cuts the old interior from the cabin but never the windscreen pillars, roof or wheels", () => {
    expect(insideRevueltoCabin(-0.37, 0.75, -0.7)).toBe(true); // old dash in front of the driver
    expect(insideRevueltoCabin(-0.37, 0.6, 0.5)).toBe(true); // old seat
    expect(insideRevueltoCabin(-0.7, 1.05, -0.7)).toBe(false); // A-pillar
    expect(insideRevueltoCabin(0, 1.2, 0.2)).toBe(false); // roof
    expect(insideRevueltoCabin(-0.95, 0.4, -1.3)).toBe(false); // front wheel
  });

  it("keeps old parts outside the cabin, drops the ones inside, leaves the body alone", () => {
    const interior = new THREE.Mesh(tri([...at(-0.37, 0.75, -0.7), ...at(-0.37, 0.75, -1.8)]), new THREE.MeshStandardMaterial({ name: "Interior_black" }));
    const body = new THREE.Mesh(tri(at(-0.37, 0.75, -0.7)), new THREE.MeshStandardMaterial({ name: "Body" }));
    const seatColour = new THREE.MeshStandardMaterial({ name: "Interior_color" });
    const doors = new THREE.Mesh(tri(at(-0.8, 0.6, 0)), seatColour);
    const root = new THREE.Group().add(interior, body, doors);
    const accent = stripRevueltoInterior(root);
    expect(interior.geometry.getIndex()!.count).toBe(3);
    expect(body.geometry.getIndex()).toBeNull();
    expect(doors.parent).toBeNull();
    expect(accent).toBe(seatColour);
  });

  it("seats the cockpit camera behind the rebuilt wheel, on the driver's side", () => {
    const eye = COCKPIT_SEATS.revuelto!.eye;
    expect(eye[0]).toBeCloseTo(-0.37);
    expect(eye[2]).toBeGreaterThan(-0.38);
  });
});
