import type { World } from './world';

/** Mix one 32-bit word into a running hash (multiply-xorshift). */
function mix(h: number, w: number): number {
  h = Math.imul(h ^ w, 0x9e3779b1);
  return (h ^ (h >>> 15)) >>> 0;
}

function mixArray(h: number, a: Float64Array | Int32Array | Uint32Array, count: number): number {
  const words =
    a instanceof Float64Array ? new Uint32Array(a.buffer, a.byteOffset, count * 2) : new Uint32Array(a.buffer, a.byteOffset, count);
  for (let i = 0; i < words.length; i++) h = mix(h, words[i]);
  return h;
}

/**
 * Hash of everything that decides the future of the battle. Two runs with the
 * same seed and build must produce the same value on every tick.
 */
export function hashWorld(w: World): number {
  let h = mix(0x811c9dc5, w.tick);
  h = mix(h, w.n);
  h = mixArray(h, w.rng.s, 4);
  const n = w.n;
  h = mixArray(h, w.px, n);
  h = mixArray(h, w.py, n);
  h = mixArray(h, w.pz, n);
  h = mixArray(h, w.fx, n);
  h = mixArray(h, w.fy, n);
  h = mixArray(h, w.fz, n);
  h = mixArray(h, w.ux, n);
  h = mixArray(h, w.uy, n);
  h = mixArray(h, w.uz, n);
  h = mixArray(h, w.speed, n);
  h = mixArray(h, w.target, n);
  for (let i = 0; i < n; i++) h = mix(h, w.alive[i]);
  h = mixArray(h, w.gpx, w.groupCount);
  h = mixArray(h, w.gpy, w.groupCount);
  h = mixArray(h, w.gpz, w.groupCount);
  return h >>> 0;
}

export function hashHex(h: number): string {
  return (h >>> 0).toString(16).padStart(8, '0');
}
