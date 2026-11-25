# Engine decision

**Chosen:** a custom WebGPU renderer in the browser (TypeScript and WGSL), with the
simulation as a dependency-free TypeScript package that runs in a Web Worker.
Decided 2026-11-25, before any game code.

## The options against the four facts

| Option | 5090, thousands of ships | Build, test and see in this container | Almost no setup | Engine-free simulation |
|---|---|---|---|---|
| **WebGPU, custom renderer** | Instanced draws on D3D12; full control of batching | **Proven** (below) | A link | Yes, plain TypeScript |
| three.js WebGPU backend | Capable, but batching is hidden behind its scene graph, where the old game lost its frame time | Same as above | A link | Yes |
| Bevy (Rust, wgpu) | Excellent natively | Not proven: only the native Rust target is installed, no WASM tool-chain; software Vulkan untested | One download, or WASM link | Yes, as a crate |
| Godot 4 | Good with MultiMesh | Not installed; headless editor cannot show Forward+ output without a GPU | One download | Only by keeping the sim out of GDScript |
| Unreal 5 | Best image | Cannot build or run here at all | Multi-GB download | Hard |

Unreal and Godot fail the "see what you make in the container" test. Bevy could be
made to work but buys nothing over the browser for a link, and costs iteration speed.

## What it costs

- I write the renderer myself: mesh pass, HDR, bloom, sprites, sky, and later the
  weapon effects and planets. There is no engine editor.
- WebGPU only: Chrome or Edge is required. There is no WebGL fallback.
- Frames are paced by the browser to the display's refresh rate, so the benchmark
  reports CPU and GPU time per frame as well as fps, to show headroom.
- A native port later would need the TypeScript simulation ported or embedded.

## What I tested in the container (no graphics card)

1. Chromium 153 **headed under Xvfb** gets a SwiftShader (software) WebGPU adapter,
   creates a device, draws, and the page screenshot contains the drawn pixels.
2. The default headless shell finds the adapter but **cannot create a device**.
   New-headless with Vulkan flags renders offscreen but screenshots come back blank.
   So all browser tests run headed under `xvfb-run`.
3. The M0 build drawing 600 to 5,000 ships: captures are checked automatically for
   blank frames, both fleet colours, framing and console errors.
4. Simulation kernel cost, headless on this container's CPU: **2.1 to 2.9 ms per tick
   at 5,000 ships** (movement, formations, spacing, target scan; no weapons yet).
   The gate was 12 ms, so the simulation stays in TypeScript.

## What each kind of claim rests on

| Claim | Rests on |
|---|---|
| The game builds, the simulation is deterministic, worker and headless hashes match | Tests in this container and in CI |
| Pixels are drawn, colours and framing are right, input reaches the battle | Software rendering (SwiftShader), automated |
| How a hull or effect *looks* | My own reading of software-rendered captures at reduced speed |
| Frame rate, 4K, Ultra, smoothness, the 120 and 60 fps targets | **Nothing yet.** Software rendering runs at 3 to 20 fps and says nothing about the RTX 5090. Only the in-game benchmark run on that card can answer this. |
| GPU timing in the benchmark | Untested: SwiftShader's timestamp queries are not representative |

## Why the targets look realistic (reasoning, not measurement)

5,000 ships are drawn in a handful of instanced draw calls (one per hull and level
of detail), with ships too small to resolve drawn as single glints. The per-frame
main-thread work is one pass over the ships to blend, cull and pack 64 bytes each.
That is a light load for a 5090, but it remains a prediction until the benchmark
has been run on it.
