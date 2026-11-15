# Game rules

- Multi-part wheels are re-pivoted on one hub per corner by `poseWheelCorners` (cars in `SHARED_HUB_KEYS`), which also straightens the SVJ's pre-steered fronts; parts spinning on their own centres wobble.
- Owner-supplied playable GLBs are optimised offline (meshopt, 1024 px WebP, no palette/instancing so material names survive) before upload as CDN pointers.
- Revuelto cabin: `stripRevueltoInterior` cuts the GLB interior inside `REVUELTO_CABIN_BOXES` before batching; `buildRevueltoCabin` adds per-material merged parts, the turning wheel and the live cluster (source cabin was low-poly with parts baked into wheel meshes).
- Cockpit glass is made clear at load by `glass.ts` (dielectric, faint tint, low opacity, duplicate inner shells removed); metallic/opaque glass mirrors the sky and hides the road.
