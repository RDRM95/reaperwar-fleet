# Reaper War: Fleet

A cinematic real-time fleet-battle simulator. Original fan work; every hull and effect is
built in code in this repository.

- **Play:** https://rdrm95.github.io/reaperwar-fleet/ (Chrome or Edge; WebGPU)
- **Benchmark:** https://rdrm95.github.io/reaperwar-fleet/?bench=5000
- Brief: [docs/BRIEF.md](docs/BRIEF.md). Current state: [docs/CHECKPOINT.md](docs/CHECKPOINT.md).
  Engine choice: [docs/ENGINE.md](docs/ENGINE.md). Decisions: [docs/DECISIONS.md](docs/DECISIONS.md).

## Layout

| Path | What |
|---|---|
| `packages/sim` | Deterministic simulation. No renderer, no DOM, no dependencies. |
| `packages/hulls` | Mesh kit and one file of code per faction's hulls. |
| `apps/game` | WebGPU renderer, simulation worker host, cameras, input, interface, benchmark. |
| `tools` | Headless runner, measures, capture helper. |
| `tests/browser` | Playwright tests with real input and checks of what is drawn. |

## Commands

```bash
npm ci
npm run dev            # local server with hot reload
npm test               # unit tests
npm run measures       # simulation cost and determinism, headless
npm run sim -- --ships 5000 --seed 1 --ticks 600
npm run test:browser   # needs xvfb-run; headed Chromium with software WebGPU
```
