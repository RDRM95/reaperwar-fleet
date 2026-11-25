# Checkpoint

Newest state only. Older entries move to docs/history/. Limit 150 lines (CI enforces it).

## State (2026-11-25)

**M0, scale probe: built, tested in the container, awaiting the first run on the RTX 5090.**

- Play: https://rdrm95.github.io/reaperwar-fleet/ (Chrome or Edge)
- Benchmark: add `?bench=5000` (or 1000, 2000), optional `&res=3840x2160&quality=ultra&secs=20&seed=1`,
  or use the buttons in the menu. It prints a text block to paste back.
- What is in M0: deterministic simulation kernel in a worker (formations, steering, spacing,
  target scan), custom WebGPU renderer (instanced hulls with two levels of detail, far-range
  glints, engine flares, star field, HDR, bloom), fleet overview and ship-follow cameras,
  benchmark, CI and deployment. Two Alliance hulls (frigate, cruiser) built from the mesh kit.
- Not in M0: weapons, damage, selection and orders, Reapers, Earth, sound. That is M1.

## Measured

| Measure | Result | Rests on |
|---|---|---|
| Sim cost per tick, 1,000 / 2,000 / 5,000 ships | 0.44 / 1.06 / 2.09 ms mean (p99 3.2 ms at 5,000) | container CPU, headless, seed 1 |
| Determinism, two headless runs | identical on every tick | unit test |
| Determinism, in-game worker vs headless | identical for 120 ticks, 600 ships, seed 11 | browser test |
| Real input (right-drag, wheel, middle-drag, keys, menu) | reaches the battle through the interface layer | browser test, real pointer events |
| Drawn output | not blank, both fleet colours present, framed, no console errors | software rendering |
| Hull lengths | frigate 170 m, cruiser 520 m, match their definitions | unit test |
| Frame rate, 4K, Ultra | **not measured** | needs the 5090 |
| Engagement share, Reaper-killer discipline | not applicable until weapons exist (M1) | |

## Waiting on me

Each item lists the default already in use; nothing is blocked on an answer.

1. **Run the benchmark on the RTX 5090** and paste the text back: open the link, menu,
   "Run with 5,000 ships" (and 2,000). For 4K Ultra use
   `?bench=5000&res=3840x2160&quality=ultra`. Default: I keep building M1 on this engine.
   No computer of yours is attached to this session, so I cannot run it myself.
2. **Wiki access for lore checking.** The Mass Effect wiki is blocked by this environment's
   network policy, so the first lore bible rests on search snippets. Default: figures stay
   tagged as snippet-sourced until the pages can be read; allowing `masseffect.fandom.com`
   in the environment settings would let me verify them.
3. **NOVA Array yield:** using 200 Gt and eight rounds from the brief, not the old
   reference's 107 kt.
4. **Chrome or Edge only** (WebGPU, no fallback). Default: yes.

## Next

M1 in this order: design bible and combat model; catalogue with sourced figures; weapons,
damage, fire control and battlegroup roles in the simulation; eight hulls with reference
sheets; Earth-orbit battle space; selection and orders; effects; the engagement measures;
independent review into docs/qa/.
