// Clear windscreen glass for cockpit cars (pure material tweak, unit-tested).
// Heavy tint or metallic glass turns into a grey/white wall from the driver's
// seat because it mirrors the bright sky; real windscreens pass ~80% of light.
import * as THREE from "three";

/** See-through glass: dark faint tint, dielectric (non-metal), nearly mirror-smooth. */
export const CLEAR_GLASS = { color: 0x0b1014, opacity: 0.2, metalness: 0, roughness: 0.03 } as const;

export function makeGlassClear(mat: THREE.Material) {
  const std = mat as THREE.MeshStandardMaterial;
  std.color?.setHex(CLEAR_GLASS.color);
  if ("metalness" in std) std.metalness = CLEAR_GLASS.metalness;
  if ("roughness" in std) std.roughness = CLEAR_GLASS.roughness;
  std.map = null;
  std.transparent = true;
  std.opacity = CLEAR_GLASS.opacity;
  std.depthWrite = false;
  std.side = THREE.DoubleSide;
  const phys = std as THREE.MeshPhysicalMaterial;
  if ("transmission" in phys) phys.transmission = 0;
  std.needsUpdate = true;
}

/**
 * Bugatti Chiron Super Sport 300+: its windows ship as an opaque white "Window"
 * material on two stacked shells (outer + "GlassInside"). Drop the inner shell
 * and make the outer one clear so the driver can see the road.
 */
export function clearChironSsGlass(root: THREE.Object3D) {
  const inner: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (/GlassInside/i.test(o.name)) inner.push(o);
  });
  for (const o of inner) o.removeFromParent();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (mat?.name === "Window") makeGlassClear(mat);
    }
  });
}

/**
 * Mustang RTR / BMW M2 files: windows are two stacked shells (outer "Window" and
 * "WindowInside") sharing one tinted material. Drop the inner window shell
 * (lamp lenses on the same node stay) and make the outer glass clear.
 */
export const TNR_WINDOW = /Window_Material1$/;
export function clearTnrGlass(root: THREE.Object3D) {
  const inner: THREE.Object3D[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    if (/WindowInside/i.test(`${o.name}|${o.parent?.name ?? ""}`) && TNR_WINDOW.test(m.material.name)) inner.push(o);
  });
  for (const o of inner) o.removeFromParent();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (mat && TNR_WINDOW.test(mat.name)) makeGlassClear(mat);
    }
  });
}
