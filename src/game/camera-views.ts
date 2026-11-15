// Selectable camera views for the 3D race scene (pure, unit-tested).
// World metres, relative to the player car: the car drives toward -z, so
// negative z is the road ahead and positive z is the road behind.

export const CAMERA_VIEWS = ["chase", "hood", "cockpit", "left", "right", "reverse"] as const;
export type CameraView = (typeof CAMERA_VIEWS)[number];

export interface CameraPose {
  /** Camera position: dx from the smoothed player x, height y, z vs the car. */
  pos: { dx: number; y: number; z: number };
  /** Look-at target in the same frame. */
  look: { dx: number; y: number; z: number };
}

/**
 * Fixed poses for every view except the default chase cam, which keeps its
 * speed/pull-back dynamic framing in render3d, and the cockpit, which rides
 * with the car from the driver seat in cockpit.ts.
 */
export const CAMERA_POSES: Record<Exclude<CameraView, "chase" | "cockpit">, CameraPose> = {
  // Low over the front hood, looking far down the road.
  hood: { pos: { dx: 0, y: 1.06, z: -1.95 }, look: { dx: 0, y: 0.85, z: -32 } },
  // 3/4 side shots: beside the car, framed on its flank and the road ahead.
  left: { pos: { dx: -4.6, y: 1.35, z: 2.4 }, look: { dx: 0.9, y: 0.75, z: -7 } },
  right: { pos: { dx: 4.6, y: 1.35, z: 2.4 }, look: { dx: -0.9, y: 0.75, z: -7 } },
  // Ahead of the car looking back: shows the car's front and the road behind.
  reverse: { pos: { dx: 0, y: 1.75, z: -8.2 }, look: { dx: 0, y: 0.9, z: 26 } },
};

/** Next view; the cockpit is skipped for cars without a modelled interior. */
export function nextCameraView(view: CameraView, cockpit = true): CameraView {
  const views: readonly CameraView[] = cockpit ? CAMERA_VIEWS : CAMERA_VIEWS.filter((v) => v !== "cockpit");
  const i = views.indexOf(view);
  return views[(i + 1) % views.length] ?? "chase";
}
