// Real-world top speed and 0–100 km/h time per playable car (pure, unit-tested).
// The race engine turns the 0–100 time into its acceleration constant, so each
// car reaches 100 km/h in its real time and tops out at its real top speed.
import type { PlayerCar } from "./player-cars";

export type CarPerf = { /** km/h */ top: number; /** seconds */ zeroTo100: number };

export const CAR_PERF: Record<PlayerCar, CarPerf> = {
  "mustang-rtr": { top: 280, zeroTo100: 3.7 },
  m2: { top: 285, zeroTo100: 4.0 },
  "m8-competition": { top: 305, zeroTo100: 3.2 },
  "m4-competition": { top: 290, zeroTo100: 3.8 },
  demon: { top: 270, zeroTo100: 2.4 },
  "huracan-evo": { top: 325, zeroTo100: 2.9 },
  huayra: { top: 370, zeroTo100: 3.3 },
  laferrari: { top: 350, zeroTo100: 2.6 },
  "utopia-roadster": { top: 350, zeroTo100: 3.0 },
  svj: { top: 350, zeroTo100: 2.8 },
  revuelto: { top: 350, zeroTo100: 2.5 },
  chiron: { top: 420, zeroTo100: 2.4 },
  "voiture-noire": { top: 420, zeroTo100: 2.4 },
  tourbillon: { top: 445, zeroTo100: 2.0 },
  jesko: { top: 400, zeroTo100: 2.5 },
  "chiron-ss300": { top: 440, zeroTo100: 2.4 },
};

/** Constant push (km/h per s) added on top of the engine curve while on the gas. */
export const THROTTLE_EXTRA = 3.5;

/** Engine acceleration (km/h per s) at a speed: falls to zero at the top speed. */
export const accelAt = (accel: number, top: number, speed: number) =>
  accel * (1 - (speed / top) ** 2) + THROTTLE_EXTRA;

/** Seconds from 0 to `to` km/h with that acceleration curve. */
export function timeTo(accel: number, top: number, to = 100) {
  let v = 0, t = 0;
  const dt = 0.005;
  while (v < to && t < 120) { v += accelAt(accel, top, v) * dt; t += dt; }
  return t;
}

/** Acceleration constant that gives the car its real 0–100 time. */
export function accelFor(perf: CarPerf): number {
  let lo = 1, hi = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (timeTo(mid, perf.top) > perf.zeroTo100) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Police pursuit pace relative to the player's car, so every car can escape. */
export const POLICE_TOP_RATIO = 0.85;
export const POLICE_ACCEL_RATIO = 0.95;
