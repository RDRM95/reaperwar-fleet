# Decisions

One line each, newest at the bottom. "Owner" marks choices that are the owner's to overturn.

- 2026-11-25 Engine: custom WebGPU renderer in the browser, TypeScript simulation in a Web Worker. See ENGINE.md.
- 2026-11-25 The attached brief file (113 lines) is the authority; it is fuller than the pasted text. Saved byte for byte.
- 2026-11-25 Simulation language: TypeScript. Gate was 12 ms per tick at 5,000 ships; measured 2.1 to 2.9 ms (kernel only). Re-check when weapons land.
- 2026-11-25 Tick rate 20 Hz; renderer interpolates between the last two snapshots. (Owner)
- 2026-11-25 Snapshots cross threads as transferred buffers, not SharedArrayBuffer, so the game needs no special headers on GitHub Pages.
- 2026-11-25 Determinism: the simulation may use only + - * / sqrt and its own trig (dmath.ts); lint forbids Math.sin and friends, Date, performance, DOM.
- 2026-11-25 Units in the simulation: metres, seconds, radians, joules. Hulls are built at true size.
- 2026-11-25 Chrome or Edge required; no WebGL fallback. (Owner)
- 2026-11-25 Browser tests run headed Chromium under Xvfb, the only mode where software WebGPU both renders and screenshots.
- 2026-11-25 Left mouse is reserved for selection and orders; the camera uses right-drag, middle-drag and the wheel.
- 2026-11-25 Hulls are code-built from a small mesh kit; no model files, no textures from outside.
- 2026-11-25 NOVA Array is 200 Gt with eight rounds, as the brief says, not the old reference's 107 kt. (Owner)
- 2026-11-25 Not carried over from the old game: reference-image lists, QA screenshots, absolute paths, handles, franchise ship-name lists.
- 2026-11-25 M0 probe class figures (speed, turn rate, sensor range) are placeholders, replaced by the sourced catalogue in M1.
