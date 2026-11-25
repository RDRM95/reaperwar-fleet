# Checkpoint

Newest state only. Older entries move to docs/history/. Limit 150 lines (CI enforces it).

## State (2026-11-25)

**M0, scale probe: done and deployed. Awaiting the first run on the RTX 5090.**
**M1: documents and hull work under way; the combat simulation is not written yet.**

- Play: https://rdrm95.github.io/reaperwar-fleet/ (Chrome or Edge). The deploy job
  succeeded; the same build was checked from a sub-path locally because this container
  cannot reach github.io.
- Benchmark: add `?bench=5000` (or 1000, 2000), optional `&res=3840x2160&quality=ultra&secs=20&seed=1`,
  or use the buttons in the menu. It prints a text block to paste back.
- In M0: deterministic simulation kernel in a worker (formations, steering, spacing, target
  scan), custom WebGPU renderer (instanced hulls with two levels of detail, far-range glints,
  engine flares, star field, HDR, bloom), fleet overview and ship-follow cameras, benchmark,
  hull viewer and reference-sheet renderer, CI and deployment.
- M1 so far: lore bible (Alliance, Reapers; from search snippets), design bible, combat model
  document (docs/COMBAT_MODEL.md), simulation table types (packages/sim/src/tables.ts), and
  **all eight M1 hulls**, built in code with reference sheets in docs/design/sheets/:
  Alliance fighter 15 m, frigate 170 m, cruiser 707 m, dreadnought 888 m, carrier 900 m;
  Reaper Oculus 16 m, destroyer 160 m, Sovereign-class 2,000 m. View any of them at
  `?hull=<id>&view=quarter` (ids as the sheet file names). They are not yet used in a battle.
- Hull shortcomings I can see on the sheets: Sovereign-class arms are thin for a 2 km ship;
  the Oculus sphere is faceted; the cruiser's outriggers are long needles; the carrier's
  hangar tunnel is see-through at its centre.
- **Where it stopped:** while writing the M1 simulation (damage layers, mounts, fire control,
  battlegroup roles, orders, events) the session's safety filter interrupted the response
  twice. The half-written file was discarded; `packages/sim/src/world.ts` is the M0 kernel.
  Nothing of M1's simulation, catalogue, scenario, selection, effects or measures exists yet.

## Measured

| Measure | Result | Rests on |
|---|---|---|
| Sim cost per tick, 1,000 / 2,000 / 5,000 ships | 0.44 / 1.06 / 2.09 ms mean (p99 3.2 ms at 5,000) | container CPU, headless, seed 1 |
| Determinism, two headless runs | identical on every tick | unit test |
| Determinism, in-game worker vs headless | identical for 120 ticks, 600 ships, seed 11 | browser test |
| Real input (right-drag, wheel, middle-drag, keys, menu) | reaches the battle through the interface layer | browser test, real pointer events |
| Drawn output | not blank, both fleet colours present, framed, no console errors | software rendering |
| Hull lengths | all eight hulls build to their catalogue length; none fills over 45 % of its box | unit tests |
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
5. **The interrupted simulation work.** Default: the next session resumes it from
   docs/COMBAT_MODEL.md; say so if you want it approached differently.

## Next

M1, in this order: catalogue with sourced figures
(lengths and gap proposals are in the lore bible, section 5); the simulation described in
docs/COMBAT_MODEL.md; Earth-orbit battle space; selection and orders; effects; the
engagement measures; independent review into docs/qa/.
