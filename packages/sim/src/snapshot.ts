import type { World } from './world';

/**
 * A snapshot is what the renderer is allowed to see of a tick: one flat
 * buffer that can be handed between threads without copying.
 */
export interface SnapshotViews {
  buffer: ArrayBuffer;
  capacity: number;
  pos: Float64Array; // 3 per ship, metres
  fwd: Float32Array; // 3 per ship
  up: Float32Array; // 3 per ship
  speed: Float32Array; // 1 per ship, m/s
  alive: Uint8Array; // 1 per ship
}

export function snapshotBytes(capacity: number): number {
  return capacity * (24 + 12 + 12 + 4) + ((capacity + 7) & ~7);
}

export function viewSnapshot(buffer: ArrayBuffer, capacity: number): SnapshotViews {
  let o = 0;
  const pos = new Float64Array(buffer, o, capacity * 3);
  o += capacity * 24;
  const fwd = new Float32Array(buffer, o, capacity * 3);
  o += capacity * 12;
  const up = new Float32Array(buffer, o, capacity * 3);
  o += capacity * 12;
  const speed = new Float32Array(buffer, o, capacity);
  o += capacity * 4;
  const alive = new Uint8Array(buffer, o, capacity);
  return { buffer, capacity, pos, fwd, up, speed, alive };
}

export function writeSnapshot(w: World, s: SnapshotViews): void {
  const n = w.n;
  for (let i = 0, k = 0; i < n; i++, k += 3) {
    s.pos[k] = w.px[i]; s.pos[k + 1] = w.py[i]; s.pos[k + 2] = w.pz[i];
    s.fwd[k] = w.fx[i]; s.fwd[k + 1] = w.fy[i]; s.fwd[k + 2] = w.fz[i];
    s.up[k] = w.ux[i]; s.up[k + 1] = w.uy[i]; s.up[k + 2] = w.uz[i];
    s.speed[i] = w.speed[i];
    s.alive[i] = w.alive[i];
  }
}
