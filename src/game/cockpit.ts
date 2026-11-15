// First-person cockpit view (pure, unit-tested). Only cars whose GLB ships a
// real interior get a seat here; every other car skips the cockpit camera.
// Car-local metres after normalizeCar: nose toward -z, driver on the left (-x).
import type { PlayerCar } from "./player-cars";

export type CockpitSeat = {
  /** Driver eye position in the car's own frame. */
  eye: [number, number, number];
  /** How far below eye height the driver looks 30 m ahead (m). */
  drop?: number;
};

// Tuned from in-cabin renders. Left out: SVJ and Demon (no usable cabin in
// the file).
export const COCKPIT_SEATS: Partial<Record<PlayerCar, CockpitSeat>> = {
  revuelto: { eye: [-0.26, 0.98, 0.12] },
  "huracan-evo": { eye: [-0.36, 0.98, 0.1] },
  laferrari: { eye: [-0.33, 0.96, 0.1] },
  chiron: { eye: [-0.38, 1.02, 0.1] },
  tourbillon: { eye: [-0.38, 1.0, 0.1] },
  "voiture-noire": { eye: [-0.36, 1.0, 0.2] },
  "chiron-ss300": { eye: [-0.38, 0.97, 0.03] },
  jesko: { eye: [-0.31, 0.93, 0.08] },
  "utopia-roadster": { eye: [-0.33, 1.0, 0.15] },
  huayra: { eye: [-0.4, 1.0, 0.15] },
  "m4-competition": { eye: [-0.38, 1.12, 0.3] },
};

export const hasCockpit = (car: PlayerCar) => COCKPIT_SEATS[car] !== undefined;

/** Steering wheel parts each GLB ships as their own nodes/materials. */
const STEERING_PARTS: Partial<Record<PlayerCar, { node?: RegExp; material?: RegExp }>> = {
  revuelto: { material: /^Steering_wheel$/ },
  "chiron-ss300": { node: /(^|\|)SteeringWheel_/ },
};

export function isSteeringPart(car: string, nodeName: string, materialName: string): boolean {
  const p = STEERING_PARTS[car as PlayerCar];
  if (!p) return false;
  return (p.node?.test(nodeName) ?? false) || (p.material?.test(materialName) ?? false);
}

/** Steering wheel turn (rad) for steer input -1 (left) .. 1 (right): about 100° lock. */
export const WHEEL_LOCK = 1.75;
export function steeringWheelAngle(steer: number): number {
  return Math.max(-1, Math.min(1, steer)) * WHEEL_LOCK;
}

/** FOV used inside the cabin: a little wider so the dash and road both fit. */
export const COCKPIT_FOV = 70;
