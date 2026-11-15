# Game rules

- Multi-part wheels are re-pivoted on one hub per corner by `poseWheelCorners` (cars in `SHARED_HUB_KEYS`), which also straightens the SVJ's pre-steered fronts; parts spinning on their own centres wobble.
- Owner-supplied playable GLBs are optimised offline (meshopt, 1024 px WebP, no palette/instancing so material names survive) before upload as CDN pointers.
