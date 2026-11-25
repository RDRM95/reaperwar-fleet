/**
 * Headless runner: the same simulation the game runs, with no drawing.
 *   npm run sim -- --ships 5000 --seed 1 --ticks 600 [--hashes]
 */
import { World, probeScenario, hashWorld, hashHex, TICK_HZ } from '@rw/sim';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

const ships = arg('ships', 5000);
const seed = arg('seed', 1);
const ticks = arg('ticks', 600);
const printHashes = process.argv.includes('--hashes');

const world = new World(probeScenario(ships, seed));
const times: number[] = [];
let hashCost = 0;
let last = 0;
for (let t = 0; t < ticks; t++) {
  const a = performance.now();
  world.step();
  const b = performance.now();
  last = hashWorld(world);
  hashCost += performance.now() - b;
  times.push(b - a);
  if (printHashes) console.log(`${world.tick} ${hashHex(last)}`);
}
times.sort((x, y) => x - y);
const mean = times.reduce((s, x) => s + x, 0) / times.length;
console.log(
  [
    `scenario=probe ships=${world.n} seed=${seed} ticks=${ticks} (${(ticks / TICK_HZ).toFixed(0)} s of battle)`,
    `tick mean=${mean.toFixed(3)} ms  median=${times[times.length >> 1].toFixed(3)} ms  p99=${times[Math.floor(times.length * 0.99)].toFixed(3)} ms  max=${times[times.length - 1].toFixed(3)} ms`,
    `hash cost mean=${(hashCost / ticks).toFixed(3)} ms`,
    `final hash=${hashHex(last)}`,
  ].join('\n'),
);
