/**
 * Drawing-thread view of the simulation: receives snapshots from the worker,
 * keeps the last three, and gives the renderer a smooth clock to interpolate
 * between them.
 */
import { DT, viewSnapshot, type SnapshotViews } from '@rw/sim';
import type { ToMain, ToWorker } from './simProtocol';

export interface Snap {
  tick: number;
  views: SnapshotViews;
}

export interface SimStatic {
  seed: number;
  n: number;
  capacity: number;
  cls: Uint16Array;
  team: Uint8Array;
  classes: { id: string; lengthM: number; radius: number; maxSpeed: number }[];
}

export class SimClient {
  static?: SimStatic;
  /** Oldest first. */
  snaps: Snap[] = [];
  /** tick -> state hash, for the determinism check. */
  hashes = new Map<number, number>();
  lastHash = 0;
  /** Recent step costs in ms. */
  stepMs: number[] = [];
  rate = 1;
  /** Continuous simulation time in ticks that the renderer is showing. */
  renderTick = 0;
  private worker: Worker;
  private ready: Promise<SimStatic>;

  constructor(ships: number, seed: number) {
    this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    let resolve!: (s: SimStatic) => void;
    this.ready = new Promise((r) => (resolve = r));
    this.worker.onmessage = (e: MessageEvent<ToMain>) => {
      const m = e.data;
      if (m.t === 'ready') {
        this.static = m;
        resolve(m);
      } else if (m.t === 'snap') {
        this.snaps.push({ tick: m.tick, views: viewSnapshot(m.buffer, this.static!.capacity) });
        if (this.snaps.length > 3) this.send({ t: 'recycle', buffer: this.snaps.shift()!.views.buffer }, true);
        this.hashes.set(m.tick, m.hash);
        if (this.hashes.size > 4000) this.hashes.delete(m.tick - 4000);
        this.lastHash = m.hash;
        this.stepMs.push(m.stepMs);
        if (this.stepMs.length > 400) this.stepMs.shift();
      }
    };
    this.send({ t: 'init', ships, seed, rate: 1 });
  }

  private send(m: ToWorker, transfer = false): void {
    if (transfer && m.t === 'recycle') this.worker.postMessage(m, [m.buffer]);
    else this.worker.postMessage(m);
  }

  whenReady(): Promise<SimStatic> {
    return this.ready;
  }

  setRate(rate: number): void {
    this.rate = rate;
    this.send({ t: 'rate', rate });
  }

  get latestTick(): number {
    return this.snaps.length ? this.snaps[this.snaps.length - 1].tick : 0;
  }

  /**
   * Advance the render clock by one drawn frame and return the two snapshots
   * to blend with the blend factor. The clock runs one tick behind the newest
   * snapshot and is nudged gently towards it, so uneven snapshot arrival does
   * not show as stutter.
   */
  advance(frameSeconds: number): { a: Snap; b: Snap; alpha: number } | null {
    const s = this.snaps;
    if (s.length < 2) return null;
    const newest = s[s.length - 1].tick;
    const target = newest - 1;
    this.renderTick += (frameSeconds / DT) * this.rate;
    const err = target + 0.5 - this.renderTick;
    if (err > 2 || err < -1.5) this.renderTick = target;
    else this.renderTick += err * Math.min(1, frameSeconds * 2);
    const lo = s[0].tick;
    const t = Math.min(newest, Math.max(lo, this.renderTick));
    let k = s.length - 2;
    while (k > 0 && s[k].tick > t) k--;
    const a = s[k], b = s[k + 1];
    return { a, b, alpha: Math.min(1, Math.max(0, (t - a.tick) / (b.tick - a.tick))) };
  }

  dispose(): void {
    this.worker.terminate();
  }
}
