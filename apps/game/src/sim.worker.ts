/// <reference lib="webworker" />
/**
 * The simulation thread. It owns the World, steps it at a fixed rate and
 * posts one snapshot per tick. Nothing here draws, and the drawing thread
 * never touches simulation state: it only ever sees snapshots.
 */
import { DT, World, hashWorld, probeScenario, snapshotBytes, viewSnapshot, writeSnapshot } from '@rw/sim';
import type { ToMain, ToWorker } from './simProtocol';

let world: World | null = null;
let rate = 1;
let nextAt = 0;
let pool: ArrayBuffer[] = [];
let timer: ReturnType<typeof setInterval> | undefined;

const post = (m: ToMain, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

function stepAndPost(): void {
  const w = world!;
  const t0 = performance.now();
  w.step();
  const stepMs = performance.now() - t0;
  const hash = hashWorld(w);
  const buffer = pool.pop() ?? new ArrayBuffer(snapshotBytes(w.capacity));
  writeSnapshot(w, viewSnapshot(buffer, w.capacity));
  post({ t: 'snap', tick: w.tick, hash, stepMs, n: w.n, buffer }, [buffer]);
}

function pump(): void {
  if (!world || rate <= 0) return;
  const now = performance.now();
  const interval = (DT * 1000) / rate;
  if (now - nextAt > interval * 6) nextAt = now; // fell far behind: hold rather than race to catch up
  let steps = 0;
  while (now >= nextAt && steps < 4) {
    stepAndPost();
    nextAt += interval;
    steps++;
  }
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  switch (m.t) {
    case 'init': {
      world = new World(probeScenario(m.ships, m.seed));
      pool = [];
      rate = m.rate;
      nextAt = performance.now();
      post({
        t: 'ready',
        seed: world.seed,
        n: world.n,
        capacity: world.capacity,
        cls: world.cls.slice(0, world.n),
        team: world.team.slice(0, world.n),
        classes: world.classes.map((c) => ({ id: c.id, lengthM: c.lengthM, radius: c.radius, maxSpeed: c.maxSpeed })),
      });
      clearInterval(timer);
      timer = setInterval(pump, 4);
      break;
    }
    case 'rate':
      rate = m.rate;
      nextAt = performance.now();
      break;
    case 'recycle':
      if (world && m.buffer.byteLength === snapshotBytes(world.capacity) && pool.length < 8) pool.push(m.buffer);
      break;
  }
};
