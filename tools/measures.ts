/**
 * Automated measures, run headless. M0 covers simulation cost and
 * determinism; the engagement and Reaper-killer measures join in M1.
 *   npm run measures [-- --seeds 3 --ticks 600]
 */
import { World, hashHex, hashWorld, probeScenario } from '@rw/sim';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}
const ticks = arg('ticks', 600);
const seed = arg('seed', 1);
/** Fail if 5,000 ships cost more than this per tick on the machine running the check. */
const budgetMs = arg('budget', 25);

function run(ships: number, s: number): { mean: number; p99: number; max: number; hash: string } {
  const w = new World(probeScenario(ships, s));
  const t: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const a = performance.now();
    w.step();
    t.push(performance.now() - a);
  }
  const hash = hashHex(hashWorld(w));
  t.sort((x, y) => x - y);
  return { mean: t.reduce((a, b) => a + b, 0) / t.length, p99: t[Math.floor(t.length * 0.99)], max: t[t.length - 1], hash };
}

let failed = false;
console.log(`MEASURES  scenario=probe  seed=${seed}  ticks=${ticks}`);
console.log('simulation cost per tick (headless, one thread)');
console.log('  ships   mean ms   p99 ms   max ms   final hash');
for (const ships of [1000, 2000, 5000]) {
  run(ships, seed); // warm-up so the figures are for optimised code
  const r = run(ships, seed);
  console.log(`  ${String(ships).padStart(5)}   ${r.mean.toFixed(3).padStart(7)}   ${r.p99.toFixed(3).padStart(6)}   ${r.max.toFixed(3).padStart(6)}   ${r.hash}`);
  if (ships === 5000 && r.mean > budgetMs) {
    console.error(`FAIL: 5,000 ships cost ${r.mean.toFixed(2)} ms per tick; budget is ${budgetMs} ms`);
    failed = true;
  }
}
const a = run(1000, seed).hash, b = run(1000, seed).hash;
console.log(`determinism (two headless runs, 1,000 ships): ${a === b ? 'identical' : 'DIFFERENT'} (${a})`);
if (a !== b) failed = true;
process.exit(failed ? 1 : 0);
