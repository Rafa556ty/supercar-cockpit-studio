import { describe, expect, it } from "vitest";
import { COCKPIT_SEATS, hasCockpit, isSteeringPart, steeringWheelAngle, WHEEL_LOCK } from "./cockpit";

describe("cockpit view", () => {
  it("is only offered for cars with a modelled interior", () => {
    expect(hasCockpit("revuelto")).toBe(true);
    expect(hasCockpit("m4-competition")).toBe(true);
    expect(hasCockpit("svj")).toBe(false);
    expect(hasCockpit("demon")).toBe(false);
  });

  it("seats the driver on the left, inside the cabin", () => {
    for (const seat of Object.values(COCKPIT_SEATS)) {
      expect(seat!.eye[0]).toBeLessThan(0);
      expect(seat!.eye[1]).toBeGreaterThan(0.7);
      expect(seat!.eye[1]).toBeLessThan(1.4);
    }
  });

  it("turns the steering wheel with the steer input up to its lock", () => {
    expect(steeringWheelAngle(0)).toBe(0);
    expect(steeringWheelAngle(1)).toBeCloseTo(WHEEL_LOCK);
    expect(steeringWheelAngle(-3)).toBeCloseTo(-WHEEL_LOCK);
  });

  it("finds the separate steering wheel parts per car", () => {
    expect(isSteeringPart("revuelto", "Interior_middle", "Steering_wheel")).toBe(true);
    expect(isSteeringPart("chiron-ss300", "SteeringWheel_Badge_26", "CSR2_Interior")).toBe(true);
    expect(isSteeringPart("jesko", "x", "alca_steer")).toBe(true);
    expect(isSteeringPart("svj", "x", "Steering_wheel")).toBe(false);
  });
});
