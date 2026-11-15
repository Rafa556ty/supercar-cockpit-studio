import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CLEAR_GLASS, clearChironSsGlass } from "./glass";

describe("Chiron Super Sport glass", () => {
  it("turns the opaque white windows clear and see-through", () => {
    const outer = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ name: "Window", color: 0xffffff }));
    const shell = new THREE.Group();
    shell.name = "Glass_3";
    shell.add(outer);
    const root = new THREE.Group().add(shell);
    clearChironSsGlass(root);
    const mat = outer.material as THREE.MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThanOrEqual(0.25);
    expect(mat.metalness).toBe(0);
    expect(mat.color.getHex()).toBe(CLEAR_GLASS.color);
  });

  it("removes the second inner glass shell so the windscreen is not doubled", () => {
    const inner = new THREE.Group();
    inner.name = "GlassInside_4";
    inner.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ name: "Window" })));
    const root = new THREE.Group().add(inner);
    clearChironSsGlass(root);
    expect(root.getObjectByName("GlassInside_4")).toBeUndefined();
  });

  it("leaves the red tail-lamp glass alone", () => {
    const red = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ name: "GlassRed", color: 0xfc032e }));
    clearChironSsGlass(new THREE.Group().add(red));
    expect((red.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xfc032e);
  });
});
