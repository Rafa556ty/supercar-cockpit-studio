// Pure first-person head motion for the cockpit camera (unit-tested).
// The driver's head is a damped spring hanging off the seat: g-forces push it
// around, the eyes look into the turn, and the road buzzes up through the seat.
// Car-local metres/radians: -z is forward, -x is the driver's left.

export type HeadMotion = {
  x: number; vx: number; // lateral sway (m)
  z: number; vz: number; // fore/aft sway (m)
  y: number; vy: number; // seat bounce (m)
  yaw: number; // look-into-turn (rad, + = left in three.js)
  roll: number; // head tilt (rad)
  pitch: number; // nod (rad, + = look up)
  lastRot: number;
  lastSpeed: number;
  t: number;
};

export const initialHeadMotion = (): HeadMotion => ({
  x: 0, vx: 0, z: 0, vz: 0, y: 0, vy: 0, yaw: 0, roll: 0, pitch: 0, lastRot: 0, lastSpeed: 0, t: 0,
});

/** Feel constants: tune here, not inside the stepper. */
export const HEAD = {
  STIFF: 55, // neck spring (1/s²)
  DAMP: 11, // neck damping (1/s)
  LAT_PER_G: 0.045, // m of sideways sway per g
  LONG_PER_G: 0.045, // m of fore/aft sway per g
  MAX_LAT: 0.07,
  MAX_LONG: 0.06, // forward lunge under braking
  MAX_BACK: 0.012, // the headrest stops the head going back under acceleration
  LOOK_INTO_TURN: 0.16, // rad of glance at full steer
  LOOK_RATE: 4.5, // how fast the eyes follow (1/s)
  TILT_PER_M: 0.9, // rad of head tilt per metre of sway
  NOD_PER_M: 0.55,
  BUZZ: 0.0028, // m of road vibration at top speed
  BUMP: 0.012, // m of extra jolt per unit of game shake
} as const;

export type HeadInput = {
  /** Heading of the car (rad, + = right), as in the engine. */
  rot: number;
  speedKmh: number;
  steer: number; // -1..1
  braking: boolean;
  shake: number; // 0..1 game shake (crashes, rumble strips)
  dt: number;
};

const G = 9.81;
const SUBSTEP = 1 / 240;

export function stepHeadMotion(h: HeadMotion, i: HeadInput): HeadMotion {
  const dt = Math.min(i.dt, 0.05);
  if (dt <= 0) return h;
  const v = i.speedKmh / 3.6;
  // Longitudinal g from the speed change; braking adds the brake bite the engine smooths out.
  const longG = clamp(((i.speedKmh - h.lastSpeed) / 3.6 / dt) / G + (i.braking ? -0.35 : 0), -1.6, 1.4);
  // Lateral g: yaw rate × speed, plus the heading itself (lane changes on a straight road).
  const yawRate = (i.rot - h.lastRot) / dt;
  const latG = clamp((v * yawRate) / G + i.rot * Math.min(1, i.speedKmh / 140) * 1.2, -1.5, 1.5);

  // Turning right throws the head left (-x); braking throws it forward (-z).
  const tx = clamp(-latG * HEAD.LAT_PER_G, -HEAD.MAX_LAT, HEAD.MAX_LAT);
  // longG < 0 (braking) → tz < 0 (forward); longG > 0 (accel) → tz > 0 (pressed back).
  const tz = clamp(longG * HEAD.LONG_PER_G, -HEAD.MAX_LONG, HEAD.MAX_BACK);
  // Fixed small substeps keep the springs stable on slow phones (dt up to 50 ms).
  const steps = Math.ceil(dt / SUBSTEP);
  const sdt = dt / steps;
  let { x, vx, z, vz, y, vy, t } = h;
  const speedK = Math.min(1, i.speedKmh / 320);
  for (let n = 0; n < steps; n++) {
    vx += (HEAD.STIFF * (tx - x) - HEAD.DAMP * vx) * sdt;
    vz += (HEAD.STIFF * (tz - z) - HEAD.DAMP * vz) * sdt;
    x += vx * sdt;
    // Hard stop at the headrest: the spring can't overshoot into the seat.
    z = Math.min(HEAD.MAX_BACK, z + vz * sdt);
    if (z >= HEAD.MAX_BACK && vz > 0) vz = 0;
    // Seat bounce: road buzz grows with speed, shake adds a sharper jolt.
    t += sdt;
    const buzz = HEAD.BUZZ * speedK * (Math.sin(t * 37.1) * 0.6 + Math.sin(t * 23.3 + 1.3) * 0.4);
    const jolt = HEAD.BUMP * i.shake * Math.sin(t * 61.7);
    vy += (420 * (buzz + jolt - y) - 30 * vy) * sdt;
    y += vy * sdt;
  }

  // Eyes glance into the turn (three.js +yaw = left, so right steer is negative).
  const lookTarget = -clamp(i.steer, -1, 1) * HEAD.LOOK_INTO_TURN * (0.35 + 0.65 * Math.min(1, i.speedKmh / 60));
  const yaw = h.yaw + (lookTarget - h.yaw) * (1 - Math.exp(-HEAD.LOOK_RATE * dt));
  // Head tilts with its sway (leaning outward) and nods under braking.
  const roll = -x * HEAD.TILT_PER_M;
  const pitch = z * HEAD.NOD_PER_M;

  return { x, vx, z, vz, y, vy, yaw, roll, pitch, lastRot: i.rot, lastSpeed: i.speedKmh, t };
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
