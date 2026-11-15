// Real 3D cockpit for the Lamborghini Revuelto (browser only; built at load).
// The source GLB only ships a flat picture of the cluster and a low-poly
// steering wheel, so the driver's view is rebuilt here from the real car's
// layout: flat-top/flat-bottom wheel with two rotary dials, 12.3" cluster in a
// hooded binnacle, vertical 8.4" centre screen, 9.1" passenger display and
// hexagonal vents. Car-local metres: nose toward -z, driver on the left (-x).
import * as THREE from "three";
import { REDLINE, rpmIn } from "./gearbox";

/** Driver centreline and the wheel hub, matching the GLB's seat and dash. */
export const REVUELTO_DRIVER_X = -0.4;
export const REVUELTO_WHEEL = { x: REVUELTO_DRIVER_X, y: 0.7, z: -0.4, tilt: 0.36 } as const;
export const REVUELTO_EYE: [number, number, number] = [REVUELTO_DRIVER_X, 0.985, 0.12];

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
    alcantara: std({ color: 0x18191c, roughness: 0.96, metalness: 0 }, "rev_alcantara"),
    carbon: std({ color: 0x2b2d31, map: carbonTexture(), roughness: 0.32, metalness: 0.35 }, "rev_carbon"),
    gloss: std({ color: 0x060607, roughness: 0.12, metalness: 0.25 }, "rev_gloss"),
    satin: std({ color: 0x8e949b, roughness: 0.35, metalness: 0.9 }, "rev_satin"),
    red: std({ color: 0xb30f1f, roughness: 0.3, metalness: 0.2 }, "rev_red"),
    accent: accentMat,
    badge: new THREE.MeshBasicMaterial({ map: badgeTexture(), transparent: true, toneMapped: false }),
  };
}

let carbonTex: THREE.CanvasTexture | null = null;
function carbonTexture() {
  if (carbonTex) return carbonTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const cell = 8;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const along = ((x + y) >> 1) % 2 === 0;
      const grad = along ? g.createLinearGradient(x * cell, 0, (x + 1) * cell, 0) : g.createLinearGradient(0, y * cell, 0, (y + 1) * cell);
      grad.addColorStop(0, "#4a4a4a");
      grad.addColorStop(0.5, "#d8d8d8");
      grad.addColorStop(1, "#4a4a4a");
      g.fillStyle = grad;
      g.fillRect(x * cell, y * cell, cell, cell);
    }
  carbonTex = new THREE.CanvasTexture(c);
  carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping;
  carbonTex.repeat.set(10, 10);
  carbonTex.colorSpace = THREE.SRGBColorSpace;
  return carbonTex;
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
  // Stylised charging bull silhouette.
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

/** Closed rim outline: rounded rectangle-ish with a flat top and a flatter bottom. */
function rimPoint(a: number): THREE.Vector3 {
  const n = 2.8;
  const c = Math.cos(a), s = Math.sin(a);
  const x = 0.178 * Math.sign(c) * Math.abs(c) ** (2 / n);
  let y = 0.165 * Math.sign(s) * Math.abs(s) ** (2 / n);
  y = Math.max(-0.128, Math.min(0.15, y));
  return new THREE.Vector3(x, y, 0);
}
function rimArc(from: number, to: number, radius: number, steps: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) pts.push(rimPoint(from + ((to - from) * i) / steps));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, radius, 10, false);
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.004) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
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

/** The turning part: rim, spokes, hub, badge and the two rotary dials. */
function buildWheel(m: Mats): THREE.Group {
  const tilt = new THREE.Group();
  tilt.rotation.x = -REVUELTO_WHEEL.tilt; // local +z points up the column at the driver
  const mesh = (g: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    const o = new THREE.Mesh(g, mat);
    o.name = name;
    o.userData["cabinPart"] = true;
    tilt.add(o);
    return o;
  };
  const top0 = THREE.MathUtils.degToRad(48), top1 = THREE.MathUtils.degToRad(132);
  mesh(rimArc(top0, top1, 0.0175, 18), m.carbon, "rim-carbon");
  mesh(rimArc(top1, top0 + Math.PI * 2, 0.0175, 54), m.alcantara, "rim-grip");
  // Orange 12 o'clock marker.
  const marker = mesh(new THREE.BoxGeometry(0.012, 0.012, 0.038), m.accent, "rim-marker");
  marker.position.set(0, 0.15, 0);
  // Horizontal spokes and the lower V spoke, carbon.
  const spoke = poly([[0.04, -0.035], [0.168, -0.022], [0.168, 0.02], [0.05, 0.03]]);
  mesh(extrude(spoke, 0.018), m.carbon, "spoke-r").position.z = -0.004;
  const left = mesh(extrude(spoke, 0.018), m.carbon, "spoke-l");
  left.scale.x = -1;
  left.position.z = -0.004;
  mesh(extrude(poly([[-0.05, -0.04], [0.05, -0.04], [0.032, -0.126], [-0.032, -0.126]]), 0.016), m.carbon, "spoke-v").position.z = -0.006;
  // Hub: hexagonal boss with the shield badge.
  const hub = mesh(
    extrude(poly([[-0.058, 0.035], [0.058, 0.035], [0.066, -0.01], [0.034, -0.058], [-0.034, -0.058], [-0.066, -0.01]]), 0.03, 0.006),
    m.gloss,
    "hub",
  );
  hub.position.z = 0.004;
  const badge = mesh(new THREE.PlaneGeometry(0.036, 0.042), m.badge, "badge");
  badge.position.set(0, -0.008, 0.026);
  // Rotary dials: drive mode (left, black + orange index), hybrid mode (right, red).
  for (const side of [-1, 1]) {
    const dial = mesh(new THREE.CylinderGeometry(0.019, 0.02, 0.014, 20), side < 0 ? m.gloss : m.red, side < 0 ? "dial-anima" : "dial-hybrid");
    dial.rotation.x = Math.PI / 2;
    dial.position.set(side * 0.108, -0.012, 0.016);
    const ring = mesh(new THREE.TorusGeometry(0.02, 0.0025, 6, 24), m.satin, "dial-ring");
    ring.position.set(side * 0.108, -0.012, 0.024);
    const index = mesh(new THREE.BoxGeometry(0.004, 0.012, 0.004), side < 0 ? m.accent : m.satin, "dial-index");
    index.position.set(side * 0.108, -0.002, 0.025);
    // Two small buttons above each dial.
    for (const dx of [-0.018, 0.018]) {
      const b = mesh(new THREE.BoxGeometry(0.016, 0.01, 0.008), m.gloss, "button");
      b.position.set(side * 0.108 + dx, 0.018, 0.012);
    }
  }
  const wheel = new THREE.Group();
  wheel.name = "steering-wheel";
  wheel.position.set(REVUELTO_WHEEL.x, REVUELTO_WHEEL.y, REVUELTO_WHEEL.z);
  wheel.userData["axis"] = new THREE.Vector3(0, Math.sin(REVUELTO_WHEEL.tilt), Math.cos(REVUELTO_WHEEL.tilt));
  wheel.add(tilt);
  return wheel;
}

/** Parts that stay put: column shroud, column-mounted shift paddles. */
function buildColumn(m: Mats): THREE.Group {
  const g = new THREE.Group();
  g.position.set(REVUELTO_WHEEL.x, REVUELTO_WHEEL.y, REVUELTO_WHEEL.z);
  g.rotation.x = -REVUELTO_WHEEL.tilt;
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.2, 14), m.alcantara);
  shroud.rotation.x = Math.PI / 2;
  shroud.position.z = -0.12;
  g.add(shroud);
  // Long carbon paddles behind the rim, Aventador/Revuelto style.
  const paddle = poly([[0.02, 0.05], [0.2, 0.09], [0.215, 0.06], [0.06, -0.01], [0.02, -0.01]]);
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(extrude(paddle, 0.006, 0.002), m.carbon);
    p.scale.x = side;
    p.position.z = -0.045;
    g.add(p);
  }
  return g;
}

/** Hexagonal air vent: satin hex ring, dark slatted core. */
function hexVent(m: Mats, r: number) {
  const g = new THREE.Group();
  const outer = new THREE.Shape();
  const hole = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const [x, y] = [Math.cos(a) * r, Math.sin(a) * r * 0.82];
    const [hx, hy] = [Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.82 * 0.78];
    if (i) { outer.lineTo(x, y); hole.lineTo(hx, hy); } else { outer.moveTo(x, y); hole.moveTo(hx, hy); }
  }
  outer.closePath();
  hole.closePath();
  outer.holes.push(hole);
  g.add(new THREE.Mesh(extrude(outer, 0.012, 0.002), m.satin));
  const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 6), m.gloss);
  core.rotation.z = Math.PI / 6;
  core.scale.y = 0.82;
  core.position.z = -0.006;
  g.add(core);
  for (let i = -2; i <= 2; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(r * 1.3, 0.003, 0.012), m.alcantara);
    slat.position.set(0, i * r * 0.22, -0.002);
    g.add(slat);
  }
  return g;
}

function screen(w: number, h: number, tex: THREE.Texture, name: string) {
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
 * Replace the GLB's flat cluster picture and low-poly wheel with the 3D cabin.
 * Adds a "steering-wheel" group the cockpit camera turns and a cluster screen
 * whose canvas is redrawn live (`updateRevueltoCluster`).
 */
export function buildRevueltoCabin(car: THREE.Group) {
  for (const old of [car.getObjectByName("steering-wheel"), car.getObjectByName("Cluster")]) old?.removeFromParent();
  let accent: THREE.Material | undefined;
  car.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material).name === "Interior_color") accent = m.material as THREE.Material;
  });
  const m = makeMaterials(accent);
  const cabin = new THREE.Group();
  cabin.name = "revuelto-cabin";

  cabin.add(buildColumn(m));

  // Cluster binnacle: a carbon visor over a 12.3" screen, with alcantara cheeks.
  const cluster = new THREE.Group();
  cluster.position.set(REVUELTO_DRIVER_X, 0.835, -0.68);
  cluster.rotation.x = -0.32;
  const canvas = document.createElement("canvas");
  canvas.width = CLUSTER_W;
  canvas.height = CLUSTER_H;
  drawRevueltoCluster(canvas.getContext("2d")!, 0, 0, 1000);
  const clusterTex = new THREE.CanvasTexture(canvas);
  clusterTex.colorSpace = THREE.SRGBColorSpace;
  const face = screen(0.3, 0.1125, clusterTex, "revuelto-cluster-screen");
  face.name = "revuelto-cluster-screen";
  cluster.add(face);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.318, 0.128, 0.012), m.gloss);
  bezel.position.z = -0.0075;
  cluster.add(bezel);
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.36, 24, 1, true, -Math.PI * 0.62, Math.PI * 0.62), m.carbon);
  visor.material = m.carbon;
  visor.rotation.z = Math.PI / 2;
  visor.position.set(0, -0.02, -0.075);
  (visor.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  cluster.add(visor);
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(extrude(poly([[0, -0.07], [0.15, -0.06], [0.12, 0.08], [0.0, 0.1]]), 0.012, 0.002), m.alcantara);
    cheek.rotation.y = Math.PI / 2;
    cheek.position.set(side * 0.178, -0.005, 0.03);
    cluster.add(cheek);
  }
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.004, 0.006), m.accent);
  lip.position.set(0, -0.066, 0.004);
  cluster.add(lip);
  cabin.add(cluster);

  // Centre stack: vertical screen angled to the driver, in a carbon Y frame.
  const centre = new THREE.Group();
  centre.position.set(-0.02, 0.69, -0.64);
  centre.rotation.set(-0.42, -0.2, 0);
  centre.add(screen(0.112, 0.18, staticScreen(drawCentreScreen, 256, 412), "revuelto-centre-screen"));
  const frame = new THREE.Mesh(extrude(poly([[-0.075, 0.11], [0.075, 0.11], [0.068, -0.1], [0.02, -0.14], [-0.02, -0.14], [-0.068, -0.1]]), 0.014, 0.003), m.carbon);
  frame.position.z = -0.012;
  centre.add(frame);
  cabin.add(centre);
  for (const dx of [-0.085, 0.045]) {
    const v = hexVent(m, 0.036);
    v.position.set(dx, 0.82, -0.7);
    v.rotation.x = -0.25;
    cabin.add(v);
  }
  // Outer hex vents by the doors.
  for (const x of [-0.78, 0.78]) {
    const v = hexVent(m, 0.045);
    v.position.set(x, 0.77, -0.52);
    v.rotation.set(-0.15, x < 0 ? 0.35 : -0.35, 0);
    cabin.add(v);
  }
  // Passenger 9.1" display on the dash.
  const pass = new THREE.Group();
  pass.position.set(0.36, 0.835, -0.72);
  pass.rotation.x = -0.35;
  pass.add(screen(0.2, 0.075, staticScreen(drawPassengerScreen, 420, 158), "revuelto-passenger-screen"));
  const pb = new THREE.Mesh(new THREE.BoxGeometry(0.214, 0.088, 0.01), m.gloss);
  pb.position.z = -0.006;
  pass.add(pb);
  cabin.add(pass);

  // Start-button flip guard on the tunnel (fighter-jet style).
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.07), m.red);
  guard.position.set(0, 0.455, -0.18);
  guard.rotation.x = -0.6;
  cabin.add(guard);

  cabin.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  car.add(cabin);
  const wheel = buildWheel(m);
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
