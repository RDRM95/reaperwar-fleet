import { describe, expect, it } from 'vitest';
import { Rng, World, dacos, datan2, dcos, dsin, hashWorld, probeScenario, SpatialGrid, viewSnapshot, snapshotBytes, writeSnapshot } from '../src/index';

describe('rng', () => {
  it('repeats for a seed and differs between seeds', () => {
    const a = new Rng(42), b = new Rng(42), c = new Rng(43);
    const xs = Array.from({ length: 50 }, () => a.u32());
    expect(Array.from({ length: 50 }, () => b.u32())).toEqual(xs);
    expect(Array.from({ length: 50 }, () => c.u32())).not.toEqual(xs);
  });
  it('is roughly uniform', () => {
    const r = new Rng(7);
    let sum = 0;
    for (let i = 0; i < 20000; i++) sum += r.float();
    expect(sum / 20000).toBeGreaterThan(0.49);
    expect(sum / 20000).toBeLessThan(0.51);
  });
});

describe('deterministic maths', () => {
  it('tracks the library functions closely', () => {
    for (let x = -20; x <= 20; x += 0.0137) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-8);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-8);
    }
    for (let a = -3.1; a <= 3.1; a += 0.0071) {
      const y = Math.sin(a) * 3.7, x = Math.cos(a) * 3.7;
      expect(Math.abs(datan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-6);
    }
    for (let c = -1; c <= 1; c += 0.01) expect(Math.abs(dacos(c) - Math.acos(c))).toBeLessThan(1e-5);
  });
});

describe('spatial grid', () => {
  it('lists every live ship once, buckets in ascending order', () => {
    const n = 500;
    const r = new Rng(3);
    const px = new Float64Array(n), py = new Float64Array(n), pz = new Float64Array(n);
    const alive = new Uint8Array(n).fill(1);
    for (let i = 0; i < n; i++) { px[i] = r.range(-5000, 5000); py[i] = r.range(-5000, 5000); pz[i] = r.range(-5000, 5000); }
    alive[17] = 0;
    const g = new SpatialGrid(n, 800);
    g.build(n, px, py, pz, alive);
    const seen = new Set<number>();
    for (let b = 0; b < g.start.length - 1; b++) {
      let prev = -1;
      for (let s = g.start[b]; s < g.start[b + 1]; s++) {
        expect(g.items[s]).toBeGreaterThan(prev);
        prev = g.items[s];
        seen.add(prev);
      }
    }
    expect(seen.size).toBe(n - 1);
    expect(seen.has(17)).toBe(false);
  });
});

describe('world', () => {
  const run = (ships: number, seed: number, ticks: number) => {
    const w = new World(probeScenario(ships, seed));
    const hashes: number[] = [];
    for (let t = 0; t < ticks; t++) { w.step(); hashes.push(hashWorld(w)); }
    return { w, hashes };
  };

  it('gives identical hashes on every tick for the same seed', () => {
    const a = run(600, 11, 200), b = run(600, 11, 200);
    expect(b.hashes).toEqual(a.hashes);
    expect(new Set(a.hashes).size).toBe(200);
  });

  it('gives different battles for different seeds', () => {
    expect(run(600, 12, 50).hashes[49]).not.toBe(run(600, 11, 50).hashes[49]);
  });

  it('keeps ships moving, upright and within their class limits', () => {
    const { w } = run(400, 5, 400);
    let moving = 0;
    for (let i = 0; i < w.n; i++) {
      const k = w.classes[w.cls[i]];
      expect(w.speed[i]).toBeLessThanOrEqual(k.maxSpeed + 1e-9);
      const f = Math.sqrt(w.fx[i] ** 2 + w.fy[i] ** 2 + w.fz[i] ** 2);
      const u = Math.sqrt(w.ux[i] ** 2 + w.uy[i] ** 2 + w.uz[i] ** 2);
      expect(Math.abs(f - 1)).toBeLessThan(1e-9);
      expect(Math.abs(u - 1)).toBeLessThan(1e-9);
      expect(Math.abs(w.fx[i] * w.ux[i] + w.fy[i] * w.uy[i] + w.fz[i] * w.uz[i])).toBeLessThan(1e-9);
      if (w.speed[i] > 50) moving++;
    }
    expect(moving).toBeGreaterThan(w.n * 0.9);
  });

  it('does not let ships sit inside each other', () => {
    const { w } = run(500, 9, 600);
    let overlaps = 0;
    for (let i = 0; i < w.n; i++) for (let j = i + 1; j < w.n; j++) {
      const d = Math.hypot(w.px[i] - w.px[j], w.py[i] - w.py[j], w.pz[i] - w.pz[j]);
      if (d < (w.classes[w.cls[i]].radius + w.classes[w.cls[j]].radius) * 0.6) overlaps++;
    }
    expect(overlaps).toBe(0);
  });

  it('round-trips a snapshot', () => {
    const { w } = run(100, 2, 10);
    const s = viewSnapshot(new ArrayBuffer(snapshotBytes(w.capacity)), w.capacity);
    writeSnapshot(w, s);
    expect(s.pos[3 * 7 + 2]).toBe(w.pz[7]);
    expect(s.fwd[3 * 7]).toBeCloseTo(w.fx[7], 6);
    expect(s.alive[7]).toBe(1);
  });
});
