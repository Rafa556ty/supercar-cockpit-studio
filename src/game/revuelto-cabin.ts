// Real 3D cockpit for the Lamborghini Revuelto (browser only; built at load).
// The source GLB's cabin is a few low-poly blocks (a flat cluster picture, a
// steering badge baked into a wheel mesh), so the whole cabin is rebuilt here
// from the real car's layout ("Feel like a pilot"): a Y-shaped dashboard and
// centre tunnel, hexagonal vents, a hooded 12.3" driver cluster, a vertical
// 8.4" centre screen framed by a carbon Y, a 9.1" passenger display, a
// red flip guard over the start button, Y-shaped door inserts, hex-quilted
// buckets and the SCV12-derived wheel with four rotary dials.
// Car-local metres after normalizeCar: nose toward -z, driver on the left (-x).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { REDLINE, rpmIn } from "./gearbox";

/** Driver centreline and the wheel hub, matching the rebuilt seat and dash. */
export const REVUELTO_DRIVER_X = -0.37;
export const REVUELTO_WHEEL = { x: REVUELTO_DRIVER_X, y: 0.665, z: -0.38, tilt: 0.42 } as const;
export const REVUELTO_EYE: [number, number, number] = [REVUELTO_DRIVER_X, 0.975, 0.1];

/**
 * The cabin volume whose original GLB interior is cut away (min/max corners).
 * Front box stops under the windscreen and A-pillars; rear box covers the
 * seats up to the headlining.
 */
export const REVUELTO_CABIN_BOXES: { min: [number, number, number]; max: [number, number, number] }[] = [
  { min: [-0.86, 0.15, -1.28], max: [0.86, 0.95, 0] },
  { min: [-0.86, 0.15, 0], max: [0.86, 1.12, 0.78] },
];
export function insideRevueltoCabin(x: number, y: number, z: number): boolean {
  return REVUELTO_CABIN_BOXES.some(
    (b) => x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1] && z > b.min[2] && z < b.max[2],
  );
}
/** Exterior parts never cut, even where they reach into the cabin box. */
const KEEP_MATERIAL = /body|glass|window|plastic|light|tire|tyre|^material$|caliper|rotor|mirror/i;
/** Old interior parts dropped whole (replaced by the rebuilt cabin). */
const DROP_MATERIAL = /^(Interior_color|Steering_wheel|Cluster|Start_button_lol)$/;

/**
 * Cut the GLB's interior out of the cabin volume (before batching), so the
 * rebuilt cabin is not fighting old blocks. Also removes the steering badge
 * that the source file baked into the front-left wheel-logo mesh.
 * Returns the seat-colour material so the new cabin keeps the garage paint.
 */
export function stripRevueltoInterior(root: THREE.Object3D): THREE.Material | undefined {
  root.updateMatrixWorld(true);
  let accent: THREE.Material | undefined;
  const drop: THREE.Object3D[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const name = m.material.name || "";
    if (DROP_MATERIAL.test(name)) {
      if (name === "Interior_color") accent = m.material;
      drop.push(m);
      return;
    }
    if (KEEP_MATERIAL.test(name)) return;
    const geo = m.geometry;
    const pos = geo.getAttribute("position");
    if (!pos) return;
    const index = geo.getIndex();
    const count = index ? index.count : pos.count;
    const kept: number[] = [];
    let cut = 0;
    for (let t = 0; t < count; t += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) {
        const i = index ? index.getX(t + k) : t + k;
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        cx += v.x; cy += v.y; cz += v.z;
      }
      if (insideRevueltoCabin(cx / 3, cy / 3, cz / 3)) { cut++; continue; }
      for (let k = 0; k < 3; k++) kept.push(index ? index.getX(t + k) : t + k);
    }
    if (!cut) return;
    if (!kept.length) { drop.push(m); return; }
    const g = geo.clone();
    g.setIndex(kept);
    m.geometry = g;
  });
  for (const o of drop) o.removeFromParent();
  return accent;
}

const CLUSTER_W = 768, CLUSTER_H = 288;

type Mats = ReturnType<typeof makeMaterials>;

function makeMaterials(accent: THREE.Material | undefined) {
  const std = (p: THREE.MeshStandardMaterialParameters, name: string) => {
    const m = new THREE.MeshStandardMaterial(p);
    m.name = name;
    return m;
  };
  const accentMat =
    (accent as THREE.MeshStandardMaterial | undefined) ??
    std({ color: 0xd65510, roughness: 0.55, metalness: 0.1 }, "Interior_color");
  return {
    alcantara: std({ color: 0x1d1e21, map: suedeTexture(), roughness: 0.97, metalness: 0 }, "rev_alcantara"),
    leather: std({ color: 0x141517, roughness: 0.55, metalness: 0.02 }, "rev_leather"),
    quilt: std({ color: 0x222326, map: hexTexture(), roughness: 0.75, metalness: 0.02 }, "rev_quilt"),
    carbon: std({ color: 0x2c2e32, map: carbonTexture(), roughness: 0.26, metalness: 0.4, side: THREE.DoubleSide }, "rev_carbon"),
    gloss: std({ color: 0x050506, roughness: 0.1, metalness: 0.3 }, "rev_gloss"),
    satin: std({ color: 0x737980, roughness: 0.35, metalness: 0.9 }, "rev_satin"),
    red: std({ color: 0xc4101f, roughness: 0.32, metalness: 0.15 }, "rev_red"),
    carpet: std({ color: 0x0e0f10, roughness: 1, metalness: 0 }, "rev_carpet"),
    mirror: std({ color: 0xb8c2cc, roughness: 0.04, metalness: 1 }, "rev_mirror"),
    accent: accentMat,
    badge: new THREE.MeshBasicMaterial({ map: badgeTexture(), transparent: true, toneMapped: false }),
  };
}

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let carbonTex: THREE.CanvasTexture | null = null;
function carbonTexture() {
  return (carbonTex ??= canvasTex(64, (g) => {
    const cell = 8;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const along = ((x + y) >> 1) % 2 === 0;
        const grad = along ? g.createLinearGradient(x * cell, 0, (x + 1) * cell, 0) : g.createLinearGradient(0, y * cell, 0, (y + 1) * cell);
        grad.addColorStop(0, "#2e2e2e");
        grad.addColorStop(0.5, "#8c8c8c");
        grad.addColorStop(1, "#2e2e2e");
        g.fillStyle = grad;
        g.fillRect(x * cell, y * cell, cell, cell);
      }
  }, 14));
}

let suedeTex: THREE.CanvasTexture | null = null;
/** Fine speckle so large Alcantara panels don't read as flat plastic. */
function suedeTexture() {
  return (suedeTex ??= canvasTex(128, (g, s) => {
    g.fillStyle = "#bdbdbd";
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const l = 150 + Math.floor(Math.random() * 90);
      g.fillStyle = `rgb(${l},${l},${l})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
    }
  }, 6));
}

let hexTex: THREE.CanvasTexture | null = null;
/** Hexagonal quilting, Lamborghini's signature stitch on seats and inserts. */
function hexTexture() {
  return (hexTex ??= canvasTex(128, (g, s) => {
    g.fillStyle = "#c8c8c8";
    g.fillRect(0, 0, s, s);
    const r = s / 8;
    const h = Math.sqrt(3) * r;
    for (let row = -1; row < 6; row++)
      for (let col = -1; col < 6; col++) {
        const cx = col * r * 3 + (row % 2 ? r * 1.5 : 0);
        const cy = row * h * 0.5 * 2;
        for (const [ox, oy] of [[0, 0], [s, 0], [0, s], [s, s]] as [number, number][]) {
          g.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            g.lineTo(cx + ox + Math.cos(a) * r * 0.86, cy + oy + Math.sin(a) * r * 0.86);
          }
          g.closePath();
          g.fillStyle = "#e2e2e2";
          g.fill();
          g.strokeStyle = "#5a5a5a";
          g.lineWidth = 2;
          g.stroke();
        }
      }
  }, 5));
}

/** Gold Lamborghini-style shield for the hub (drawn, no trademark artwork). */
function badgeTexture() {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 112;
  const g = c.getContext("2d")!;
  const shield = (inset: number) => {
    g.beginPath();
    g.moveTo(8 + inset, 8 + inset);
    g.lineTo(88 - inset, 8 + inset);
    g.lineTo(88 - inset, 58);
    g.quadraticCurveTo(86 - inset, 92 - inset, 48, 106 - inset);
    g.quadraticCurveTo(10 + inset, 92 - inset, 8 + inset, 58);
    g.closePath();
  };
  shield(0);
  g.fillStyle = "#c9a227";
  g.fill();
  shield(6);
  g.fillStyle = "#0b0b0b";
  g.fill();
  g.fillStyle = "#d9b23a";
  g.font = "bold 11px sans-serif";
  g.textAlign = "center";
  g.fillText("LAMBORGHINI", 48, 26);
  g.beginPath();
  g.ellipse(50, 62, 20, 12, -0.2, 0, Math.PI * 2);
  g.moveTo(30, 54);
  g.quadraticCurveTo(22, 44, 26, 38);
  g.quadraticCurveTo(30, 48, 36, 52);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- geometry helpers ----------

const E = (x = 0, y = 0, z = 0) => new THREE.Euler(x, y, z);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Placement matrix: position + rotation (+ optional scale). */
function place(p: THREE.Vector3, r: THREE.Euler = E(), s: THREE.Vector3 = V(1, 1, 1)) {
  return new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(r), s);
}
/** Child placement inside a parent frame. */
const inFrame = (frame: THREE.Matrix4, p: THREE.Vector3, r: THREE.Euler = E()) => frame.clone().multiply(place(p, r));

/** Collects static parts and merges them into one draw per material. */
class Kit {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    g.applyMatrix4(m);
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g);
  }
  build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [mat, geos] of this.parts) {
      const merged = mergeGeometries(geos);
      const pieces = merged ? [merged] : geos;
      for (const g of pieces) {
        const mesh = new THREE.Mesh(g, mat);
        mesh.name = `${name}-${mat.name}`;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        group.add(mesh);
      }
      if (merged) for (const g of geos) g.dispose();
    }
    return group;
  }
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.003, curve = 10) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: curve,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}
function poly(points: [number, number][]) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}
/**
 * A side profile drawn in (z, y) and extruded across x0..x1: the way
 * dashboards, tunnels and door cards are shaped.
 */
function sideProfile(points: [number, number][], x0: number, x1: number, bevel = 0.004) {
  const geo = extrude(poly(points.map(([z, y]) => [-z, y])), x1 - x0, bevel);
  geo.rotateY(Math.PI / 2); // shape-x (= -z) -> world z, extrusion -> world x
  geo.translate((x0 + x1) / 2, 0, 0);
  return geo;
}
/** Flat bar between two points (w wide, t thick), its width lying along `side`. */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, t: number, side = V(1, 0, 0)) {
  const len = a.distanceTo(b);
  const geo = new THREE.BoxGeometry(w, len, t);
  const dir = b.clone().sub(a).normalize();
  const x = side.clone().sub(dir.clone().multiplyScalar(side.dot(dir))).normalize();
  const z = new THREE.Vector3().crossVectors(x, dir).normalize();
  const m = new THREE.Matrix4().makeBasis(x, dir, z).setPosition(a.clone().add(b).multiplyScalar(0.5));
  return { geo, m };
}

// ---------- steering wheel (turns) and column (fixed) ----------

/** SCV12-derived rim: almost round, thin, flattened at the bottom. */
function rimPoint(a: number): THREE.Vector3 {
  const n = 2.3;
  const c = Math.cos(a), s = Math.sin(a);
  const x = 0.172 * Math.sign(c) * Math.abs(c) ** (2 / n);
  let y = 0.168 * Math.sign(s) * Math.abs(s) ** (2 / n);
  y = Math.max(-0.132, y);
  return new THREE.Vector3(x, y, 0);
}
function rimArc(from: number, to: number, radius: number, steps: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) pts.push(rimPoint(from + ((to - from) * i) / steps));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, radius, 10, false);
}

/** The turning part: rim, spokes, hub, badge and the four rotary dials. */
function buildWheel(m: Mats): THREE.Group {
  const kit = new Kit();
  const at = (x: number, y: number, z: number, r: THREE.Euler = E()) => place(V(x, y, z), r);
  const top0 = THREE.MathUtils.degToRad(50), top1 = THREE.MathUtils.degToRad(130);
  kit.add(rimArc(top0, top1, 0.0165, 18), m.carbon, at(0, 0, 0));
  kit.add(rimArc(top1, top0 + Math.PI * 2, 0.0165, 60), m.alcantara, at(0, 0, 0));
  // Orange 12 o'clock stripe.
  kit.add(new THREE.BoxGeometry(0.012, 0.012, 0.036), m.accent, at(0, 0.165, 0));
  // Two horizontal carbon spokes that carry the upper dials, and a lower V spoke.
  const spoke = poly([[0.035, -0.04], [0.166, -0.03], [0.166, 0.025], [0.05, 0.034]]);
  kit.add(extrude(spoke, 0.018), m.carbon, at(0, 0, -0.004));
  kit.add(extrude(spoke, 0.018), m.carbon, place(V(0, 0, -0.004), E(), V(-1, 1, 1)));
  kit.add(extrude(poly([[-0.055, -0.04], [0.055, -0.04], [0.03, -0.13], [-0.03, -0.13]]), 0.016), m.carbon, at(0, 0, -0.006));
  // Hexagonal hub with the shield badge.
  kit.add(extrude(poly([[-0.056, 0.036], [0.056, 0.036], [0.066, -0.008], [0.034, -0.058], [-0.034, -0.058], [-0.066, -0.008]]), 0.03, 0.006), m.gloss, at(0, 0, 0.004));
  // Upper rotary dials: ANIMA drive modes (left, red) and hybrid modes (right, black).
  for (const side of [-1, 1]) {
    const x = side * 0.112;
    kit.add(new THREE.CylinderGeometry(0.019, 0.021, 0.016, 22), side < 0 ? m.red : m.gloss, at(x, -0.006, 0.016, E(Math.PI / 2)));
    kit.add(new THREE.TorusGeometry(0.021, 0.0025, 6, 26), m.satin, at(x, -0.006, 0.025));
    kit.add(new THREE.BoxGeometry(0.004, 0.012, 0.004), side < 0 ? m.satin : m.accent, at(x, 0.004, 0.026));
    // Thumb buttons above the dial (indicators / lights / wipers).
    for (const dx of [-0.02, 0.02]) kit.add(new THREE.BoxGeometry(0.017, 0.011, 0.008), m.gloss, at(x + dx, 0.026, 0.012));
    // Smaller lower dials either side of the V spoke (lift system / performance).
    kit.add(new THREE.CylinderGeometry(0.012, 0.013, 0.012, 18), m.gloss, at(side * 0.045, -0.085, 0.012, E(Math.PI / 2)));
    kit.add(new THREE.TorusGeometry(0.013, 0.002, 6, 20), m.satin, at(side * 0.045, -0.085, 0.019));
  }
  const parts = kit.build("steering-part");
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.04), m.badge);
  badge.position.set(0, -0.008, 0.0265);
  parts.add(badge);
  const tilt = new THREE.Group();
  tilt.rotation.x = -REVUELTO_WHEEL.tilt; // local +z points up the column at the driver
  tilt.add(parts);
  const wheel = new THREE.Group();
  wheel.name = "steering-wheel";
  wheel.position.set(REVUELTO_WHEEL.x, REVUELTO_WHEEL.y, REVUELTO_WHEEL.z);
  wheel.userData["axis"] = new THREE.Vector3(0, Math.sin(REVUELTO_WHEEL.tilt), Math.cos(REVUELTO_WHEEL.tilt));
  wheel.add(tilt);
  return wheel;
}

/** Fixed parts on the column: shroud and the long column-mounted carbon paddles. */
function addColumn(kit: Kit, m: Mats) {
  const col = place(V(REVUELTO_WHEEL.x, REVUELTO_WHEEL.y, REVUELTO_WHEEL.z), E(-REVUELTO_WHEEL.tilt));
  kit.add(new THREE.CylinderGeometry(0.04, 0.055, 0.22, 16), m.alcantara, inFrame(col, V(0, 0, -0.13), E(Math.PI / 2)));
  const paddle = poly([[0.02, 0.045], [0.168, 0.078], [0.18, 0.054], [0.06, -0.012], [0.02, -0.012]]);
  for (const side of [-1, 1]) {
    kit.add(extrude(paddle, 0.006, 0.002), m.gloss, col.clone().multiply(place(V(0, 0, -0.045), E(), V(side, 1, 1))));
  }
}

/** Hexagonal air vent: satin hex ring, dark core, horizontal slats. */
function addHexVent(kit: Kit, m: Mats, frame: THREE.Matrix4, r: number) {
  const outer = new THREE.Shape();
  const hole = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const [x, y] = [Math.cos(a) * r, Math.sin(a) * r * 0.82];
    const [hx, hy] = [x * 0.78, y * 0.78];
    if (i) { outer.lineTo(x, y); hole.lineTo(hx, hy); } else { outer.moveTo(x, y); hole.moveTo(hx, hy); }
  }
  outer.closePath();
  hole.closePath();
  outer.holes.push(hole);
  kit.add(extrude(outer, 0.012, 0.002), m.satin, frame);
  kit.add(new THREE.CircleGeometry(r * 0.8, 6), m.gloss, frame.clone().multiply(place(V(0, 0, -0.006), E(0, 0, Math.PI / 6), V(1, 0.82, 1))));
  for (let i = -2; i <= 2; i++) kit.add(new THREE.BoxGeometry(r * 1.3, 0.003, 0.012), m.alcantara, inFrame(frame, V(0, i * r * 0.22, -0.002)));
}

function screen(w: number, h: number, tex: THREE.Texture, name: string) {
  // Screens are small on screen: no mip chain, so text never blurs into a flat grey.
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  mat.name = name;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function staticScreen(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Driver cluster face: the canvas the race redraws with live speed/rpm/gear. */
export function drawRevueltoCluster(g: CanvasRenderingContext2D, speed: number, gear: number, rpm: number) {
  const W = CLUSTER_W, H = CLUSTER_H;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#07080b");
  bg.addColorStop(1, "#0e1015");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Hexagon texture in the background.
  g.strokeStyle = "rgba(255,255,255,0.035)";
  g.lineWidth = 1;
  for (let y = 0; y < H + 20; y += 26)
    for (let x = (y / 26) % 2 ? 15 : 0; x < W; x += 30) {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      }
      g.closePath();
      g.stroke();
    }
  const cx = W / 2, cy = H * 0.6, R = H * 0.46;
  const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  const k = Math.max(0, Math.min(1, rpm / 10000));
  // Tach track, redline band, live arc.
  g.lineCap = "butt";
  g.lineWidth = 16;
  g.strokeStyle = "#23262d";
  g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
  g.strokeStyle = "#7a1010";
  g.beginPath(); g.arc(cx, cy, R, a0 + (a1 - a0) * (REDLINE / 10000), a1); g.stroke();
  const live = g.createLinearGradient(cx - R, 0, cx + R, 0);
  live.addColorStop(0, "#ffffff");
  live.addColorStop(0.75, "#ffb347");
  live.addColorStop(1, "#ff3b1f");
  g.strokeStyle = live;
  g.beginPath(); g.arc(cx, cy, R, a0, a0 + (a1 - a0) * k); g.stroke();
  // Ticks 0..10 (x1000 rpm).
  g.fillStyle = "#c9ccd3";
  g.font = "600 18px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i <= 10; i++) {
    const a = a0 + ((a1 - a0) * i) / 10;
    g.fillText(String(i), cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30));
  }
  // Speed and gear.
  g.fillStyle = "#ffffff";
  g.font = "700 76px sans-serif";
  g.fillText(String(Math.round(speed)), cx, cy - 18);
  g.font = "600 18px sans-serif";
  g.fillStyle = "#8b9099";
  g.fillText("km/h", cx, cy + 26);
  g.font = "700 40px sans-serif";
  g.fillStyle = rpm > REDLINE * 0.95 ? "#ff3b1f" : "#ffb347";
  g.fillText(String(gear + 1), cx, cy + 68);
  // Side panels: drive mode and hybrid battery.
  g.textAlign = "left";
  g.font = "700 22px sans-serif";
  g.fillStyle = "#ffb347";
  g.fillText("STRADA", 34, 54);
  g.font = "500 15px sans-serif";
  g.fillStyle = "#8b9099";
  g.fillText("HYBRID", 34, 84);
  g.fillStyle = "#23262d";
  g.fillRect(34, 104, 150, 10);
  g.fillStyle = "#3fd0ff";
  g.fillRect(34, 104, 112, 10);
  g.textAlign = "right";
  g.font = "700 22px sans-serif";
  g.fillStyle = "#ffffff";
  g.fillText("V12", W - 34, 54);
  g.font = "500 15px sans-serif";
  g.fillStyle = "#8b9099";
  g.fillText("1015 CV", W - 34, 84);
  g.fillText("ESC ON", W - 34, H - 34);
  g.textAlign = "left";
  g.fillText("TRIP 0012.4", 34, H - 34);
}

function drawCentreScreen(g: CanvasRenderingContext2D, w: number, h: number) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0b0d12");
  bg.addColorStop(1, "#14171f");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#ffb347";
  g.font = "700 22px sans-serif";
  g.textAlign = "center";
  g.fillText("ANIMA", w / 2, 40);
  const items = ["CITTÀ", "STRADA", "SPORT", "CORSA"];
  items.forEach((t, i) => {
    const y = 84 + i * 62;
    g.fillStyle = i === 1 ? "rgba(255,179,71,0.18)" : "rgba(255,255,255,0.05)";
    g.fillRect(18, y, w - 36, 48);
    g.fillStyle = i === 1 ? "#ffb347" : "#c9ccd3";
    g.font = "600 20px sans-serif";
    g.fillText(t, w / 2, y + 31);
  });
  g.fillStyle = "#8b9099";
  g.font = "500 15px sans-serif";
  g.fillText("21°C   AUTO   ❄", w / 2, h - 30);
}

function drawPassengerScreen(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = "#090b10";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "#ffb347";
  g.lineWidth = 6;
  g.beginPath();
  g.arc(70, h / 2, 42, Math.PI * 0.75, Math.PI * 2.0);
  g.stroke();
  g.fillStyle = "#ffffff";
  g.font = "700 26px sans-serif";
  g.textAlign = "center";
  g.fillText("G", 70, h / 2 + 9);
  g.textAlign = "left";
  g.font = "600 22px sans-serif";
  g.fillText("REVUELTO", 140, h / 2 - 8);
  g.font = "500 15px sans-serif";
  g.fillStyle = "#8b9099";
  g.fillText("PASSENGER DISPLAY", 140, h / 2 + 18);
}

/**
 * Replace the GLB's interior with the rebuilt 3D cabin. Call after
 * `stripRevueltoInterior` + batching. Adds a "steering-wheel" group the cockpit
 * camera turns and a cluster screen whose canvas is redrawn live
 * (`updateRevueltoCluster`).
 */
export function buildRevueltoCabin(car: THREE.Group, accent?: THREE.Material) {
  for (const old of [car.getObjectByName("steering-wheel"), car.getObjectByName("Cluster"), car.getObjectByName("revuelto-cabin")]) old?.removeFromParent();
  const m = makeMaterials(accent);
  const kit = new Kit();
  const D = REVUELTO_DRIVER_X;

  // --- tub: carpet floor, toe board, pedals, rear bulkhead
  kit.add(new THREE.BoxGeometry(1.7, 0.02, 1.95), m.carpet, place(V(0, 0.24, -0.2)));
  kit.add(new THREE.BoxGeometry(1.66, 0.02, 0.42), m.carpet, place(V(0, 0.34, -1.06), E(0.55)));
  kit.add(new THREE.BoxGeometry(0.05, 0.11, 0.008), m.satin, place(V(D + 0.09, 0.37, -0.96), E(-0.5)));
  kit.add(new THREE.BoxGeometry(0.1, 0.07, 0.008), m.satin, place(V(D - 0.04, 0.38, -0.94), E(-0.5)));
  kit.add(new THREE.BoxGeometry(1.66, 0.76, 0.03), m.alcantara, place(V(0, 0.6, 0.785)));

  // --- dashboard: one sculpted shell across the car, low in front of the driver
  kit.add(
    sideProfile([[-1.27, 0.78], [-1.0, 0.795], [-0.72, 0.8], [-0.635, 0.787], [-0.6, 0.755], [-0.6, 0.69], [-0.66, 0.57], [-0.78, 0.46], [-0.95, 0.4], [-1.2, 0.38]], -0.84, 0.84),
    m.alcantara,
    place(V()),
  );
  // Stitched accent line along the dash edge.
  kit.add(new THREE.BoxGeometry(1.64, 0.005, 0.006), m.accent, place(V(0, 0.778, -0.618), E(-0.75)));
  // Carbon band across the dash face, forking into a "Y" at both outer ends.
  kit.add(new THREE.BoxGeometry(1.0, 0.04, 0.012), m.carbon, place(V(0.05, 0.725, -0.597)));
  for (const s of [-1, 1]) {
    const fork = s < 0 ? -0.45 : 0.55;
    const end = s * 0.8;
    for (const [a, b] of [[[fork, 0.725], [end, 0.725]], [[fork, 0.725], [end, 0.765]], [[fork, 0.725], [end, 0.69]]] as [[number, number], [number, number]][]) {
      const { geo, m: bm } = beam(V(a[0], a[1], -0.597), V(b[0], b[1], -0.597), 0.028, 0.012, V(0, 1, 0));
      kit.add(geo, m.carbon, bm);
    }
  }

  // --- driver cluster: 12.3" screen in a carbon-hooded binnacle
  const clusterFrame = place(V(D, 0.845, -0.67), E(-0.28));
  kit.add(new THREE.BoxGeometry(0.296, 0.12, 0.016), m.gloss, inFrame(clusterFrame, V(0, 0, -0.009)));
  kit.add(new THREE.BoxGeometry(0.33, 0.07, 0.13), m.alcantara, inFrame(clusterFrame, V(0, -0.085, -0.05)));
  // Hood shell over the screen (side profile in the cluster's local z/y).
  kit.add(
    sideProfile([[0.045, 0.062], [-0.02, 0.07], [-0.09, 0.064], [-0.12, 0.05], [-0.12, 0.04], [-0.09, 0.054], [-0.02, 0.06], [0.04, 0.054]], -0.172, 0.172, 0.002),
    m.carbon,
    clusterFrame,
  );
  for (const s of [-1, 1]) {
    kit.add(
      sideProfile([[0.045, 0.062], [0.045, -0.06], [-0.12, -0.07], [-0.12, 0.05]], s * 0.172 - 0.006, s * 0.172 + 0.006, 0.002),
      m.alcantara,
      clusterFrame,
    );
  }

  // --- centre stack: vertical 8.4" screen framed by the carbon Y of the console
  const stack = place(V(0, 0.655, -0.635), new THREE.Euler(-0.42, -0.14, 0, "YXZ"));
  kit.add(new THREE.BoxGeometry(0.126, 0.2, 0.012), m.gloss, inFrame(stack, V(0, 0, -0.008)));
  kit.add(extrude(poly([[-0.085, 0.118], [0.085, 0.118], [0.085, -0.118], [0.03, -0.165], [-0.03, -0.165], [-0.085, -0.118]]), 0.016, 0.003), m.carbon, inFrame(stack, V(0, 0, -0.022)));
  const worldOf = (x: number, y: number, z: number) => V(x, y, z).applyMatrix4(stack);
  for (const s of [-1, 1]) {
    const { geo, m: bm } = beam(worldOf(s * 0.075, 0.11, -0.022), V(s * 0.24, 0.775, -0.605), 0.03, 0.016, V(s, 0, 0));
    kit.add(geo, m.carbon, bm);
  }
  {
    const { geo, m: bm } = beam(worldOf(0, -0.16, -0.022), V(0, 0.475, -0.5), 0.05, 0.016, V(1, 0, 0));
    kit.add(geo, m.carbon, bm);
  }
  // Stippled phone tray under the screen.
  kit.add(new THREE.BoxGeometry(0.17, 0.015, 0.11), m.gloss, place(V(0, 0.485, -0.6)));
  // Centre vents either side of the Y, outer vents at the door ends.
  for (const s of [-1, 1]) addHexVent(kit, m, place(V(s * 0.155, 0.762, -0.593), E(-0.08, s * -0.12)), 0.034);
  for (const s of [-1, 1]) addHexVent(kit, m, place(V(s * 0.73, 0.745, -0.585), E(-0.1, s * -0.35)), 0.04);

  // --- passenger 9.1" display on the dash
  const pass = place(V(0.36, 0.83, -0.665), E(-0.28));
  kit.add(new THREE.BoxGeometry(0.226, 0.092, 0.012), m.gloss, inFrame(pass, V(0, 0, -0.007)));

  // --- centre tunnel: rises from the console to the armrest between the seats
  kit.add(sideProfile([[-0.62, 0.46], [-0.45, 0.472], [0.1, 0.49], [0.3, 0.55], [0.6, 0.56], [0.6, 0.24], [-0.62, 0.24]], -0.12, 0.12), m.alcantara, place(V()));
  {
    const { geo, m: bm } = beam(V(0, 0.477, -0.47), V(0, 0.497, 0.1), 0.2, 0.008, V(1, 0, 0));
    kit.add(geo, m.carbon, bm);
  }
  kit.add(new THREE.BoxGeometry(0.2, 0.04, 0.3), m.leather, place(V(0, 0.575, 0.44)));
  for (const s of [-1, 1]) kit.add(new THREE.BoxGeometry(0.004, 0.006, 0.3), m.accent, place(V(s * 0.101, 0.592, 0.44)));
  // Fighter-jet start: red flip guard (raised) over the start button.
  kit.add(new THREE.BoxGeometry(0.075, 0.018, 0.085), m.gloss, place(V(0, 0.49, -0.4)));
  kit.add(new THREE.CylinderGeometry(0.013, 0.013, 0.01, 20), m.satin, place(V(0, 0.502, -0.4)));
  kit.add(new THREE.BoxGeometry(0.05, 0.005, 0.065), m.red, place(V(0, 0.525, -0.425), E(-1.0)));
  // Aircraft-style toggle row, reverse lever and P button.
  for (const x of [-0.05, 0, 0.05]) {
    kit.add(new THREE.BoxGeometry(0.03, 0.012, 0.03), m.gloss, place(V(x, 0.488, -0.29)));
    kit.add(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 8), m.satin, place(V(x, 0.505, -0.285), E(0.4)));
  }
  kit.add(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 10), m.satin, place(V(-0.055, 0.51, -0.18), E(-0.3)));
  kit.add(new THREE.BoxGeometry(0.03, 0.018, 0.02), m.red, place(V(-0.055, 0.535, -0.188)));
  kit.add(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), m.gloss, place(V(0.05, 0.492, -0.18)));
  // Hex-quilted storage lid.
  kit.add(new THREE.BoxGeometry(0.18, 0.01, 0.2), m.quilt, place(V(0, 0.497, 0.0), E(0.035)));

  // --- doors: Alcantara cards with a carbon "Y" insert and orange armrest
  for (const s of [-1, 1]) {
    const x = s * 0.8;
    // Window line kept low (about 13 cm under the eyes) so the side view stays open.
    kit.add(sideProfile([[-0.7, 0.835], [0.55, 0.86], [0.62, 0.3], [-0.62, 0.3], [-0.7, 0.5]], x - 0.02, x + 0.02), m.alcantara, place(V()));
    const face = x - s * 0.022;
    kit.add(new THREE.BoxGeometry(0.06, 0.035, 0.55), m.accent, place(V(face - s * 0.02, 0.58, 0.02)));
    kit.add(new THREE.BoxGeometry(0.01, 0.17, 0.5), m.quilt, place(V(face, 0.42, 0.05)));
    for (const [a, b] of [[[0.38, 0.72], [0.0, 0.72]], [[0.0, 0.72], [-0.38, 0.79]], [[0.0, 0.72], [-0.38, 0.65]]] as [[number, number], [number, number]][]) {
      const { geo, m: bm } = beam(V(face, a[1], a[0]), V(face, b[1], b[0]), 0.03, 0.01, V(0, 1, 0));
      kit.add(geo, m.carbon, bm);
    }
    kit.add(new THREE.BoxGeometry(0.02, 0.025, 0.12), m.satin, place(V(face - s * 0.01, 0.68, -0.22)));
    kit.add(new THREE.BoxGeometry(0.05, 0.015, 1.25), m.carbon, place(V(x - s * 0.01, 0.85, -0.08), E(0.02)));
  }

  // --- hex-quilted bucket seats with orange bolster piping
  for (const s of [-1, 1]) {
    const x = s * 0.37;
    kit.add(new THREE.BoxGeometry(0.46, 0.09, 0.46), m.leather, place(V(x, 0.34, 0.33), E(0.12)));
    kit.add(new THREE.BoxGeometry(0.26, 0.095, 0.4), m.quilt, place(V(x, 0.345, 0.33), E(0.12)));
    for (const b of [-1, 1]) {
      kit.add(new THREE.BoxGeometry(0.07, 0.13, 0.46), m.leather, place(V(x + b * 0.2, 0.38, 0.33), E(0.12)));
      kit.add(new THREE.BoxGeometry(0.006, 0.006, 0.46), m.accent, place(V(x + b * 0.165, 0.446, 0.33), E(0.12)));
    }
    const back = place(V(x, 0.38, 0.56), E(0.3));
    kit.add(new THREE.BoxGeometry(0.5, 0.66, 0.1), m.leather, inFrame(back, V(0, 0.33, 0)));
    kit.add(new THREE.BoxGeometry(0.26, 0.42, 0.1), m.quilt, inFrame(back, V(0, 0.3, -0.006)));
    kit.add(new THREE.BoxGeometry(0.2, 0.1, 0.1), m.quilt, inFrame(back, V(0, 0.59, -0.006)));
    for (const b of [-1, 1]) {
      kit.add(new THREE.BoxGeometry(0.08, 0.52, 0.14), m.leather, inFrame(back, V(b * 0.22, 0.28, -0.025)));
      kit.add(new THREE.BoxGeometry(0.006, 0.52, 0.006), m.accent, inFrame(back, V(b * 0.18, 0.28, -0.096)));
    }
  }

  // --- rear-view mirror at the top of the windscreen
  kit.add(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), m.gloss, place(V(0, 1.12, -0.48)));
  kit.add(new THREE.BoxGeometry(0.21, 0.06, 0.025), m.gloss, place(V(0, 1.075, -0.47), E(-0.12)));
  kit.add(new THREE.BoxGeometry(0.195, 0.048, 0.004), m.mirror, place(V(0, 1.075, -0.456), E(-0.12)));

  addColumn(kit, m);

  const cabin = kit.build("revuelto-cabin");

  // Live/static screens keep their own textures (one draw each).
  const canvas = document.createElement("canvas");
  canvas.width = CLUSTER_W;
  canvas.height = CLUSTER_H;
  drawRevueltoCluster(canvas.getContext("2d")!, 0, 0, 1000);
  const clusterTex = new THREE.CanvasTexture(canvas);
  clusterTex.colorSpace = THREE.SRGBColorSpace;
  const face = screen(0.28, 0.105, clusterTex, "revuelto-cluster-screen");
  face.name = "revuelto-cluster-screen";
  face.applyMatrix4(clusterFrame);
  cabin.add(face);
  const centre = screen(0.11, 0.185, staticScreen(drawCentreScreen, 256, 430), "revuelto-centre-screen");
  centre.applyMatrix4(inFrame(stack, V(0, 0, 0.0)));
  cabin.add(centre);
  const passenger = screen(0.21, 0.08, staticScreen(drawPassengerScreen, 420, 160), "revuelto-passenger-screen");
  passenger.applyMatrix4(pass);
  cabin.add(passenger);

  // The roof and pillars shade the cabin (no shadow is cast by cabin parts).
  const wheel = buildWheel(m);
  for (const g of [cabin, wheel])
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = false;
        o.receiveShadow = !((o as THREE.Mesh).material instanceof THREE.MeshBasicMaterial);
      }
    });
  car.add(cabin);
  car.add(wheel);
}

/** Redraw the live cluster (throttled by the caller). */
export function updateRevueltoCluster(screenMesh: THREE.Mesh, speed: number, gear: number) {
  const mat = screenMesh.material as THREE.MeshBasicMaterial;
  const tex = mat.map as THREE.CanvasTexture | null;
  const canvas = tex?.image as HTMLCanvasElement | undefined;
  if (!tex || !canvas) return;
  const rpm = Math.max(1000, Math.min(10000, rpmIn(gear, speed)));
  drawRevueltoCluster(canvas.getContext("2d")!, speed, gear, rpm);
  tex.needsUpdate = true;
}
