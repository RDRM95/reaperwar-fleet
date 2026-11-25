import { describe, expect, it } from 'vitest';
import { HULLS } from '../src/index';

describe.each(HULLS.map((h) => [h.id, h] as const))('%s', (_id, hull) => {
  const full = hull.build(0);
  const far = hull.build(1);

  it('is built to its design length, centred on the origin', () => {
    expect(full.max[2] - full.min[2]).toBeCloseTo(hull.lengthM, 0);
    expect(Math.abs(full.max[2] + full.min[2])).toBeLessThan(hull.lengthM * 0.01);
    expect(far.max[2] - far.min[2]).toBeCloseTo(hull.lengthM, 0);
  });

  it('is not a box: it fills well under half of its bounding volume and has real detail', () => {
    // Signed volume of the closed mesh against its bounding box.
    let vol = 0;
    const p = full.positions;
    for (let t = 0; t < full.indices.length; t += 3) {
      const a = full.indices[t] * 3, b = full.indices[t + 1] * 3, c = full.indices[t + 2] * 3;
      vol += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
    }
    const box = (full.max[0] - full.min[0]) * (full.max[1] - full.min[1]) * (full.max[2] - full.min[2]);
    expect(vol).toBeGreaterThan(0);
    expect(vol / box).toBeLessThan(0.45);
    expect(full.triangleCount).toBeGreaterThan(300);
  });

  it('has a cheaper distant version and unit normals', () => {
    expect(far.triangleCount).toBeLessThan(full.triangleCount * 0.8);
    for (let i = 0; i < full.normals.length; i += 3) {
      expect(Math.hypot(full.normals[i], full.normals[i + 1], full.normals[i + 2])).toBeCloseTo(1, 3);
    }
  });

  it('has engines at the stern', () => {
    expect(hull.engines.length).toBeGreaterThan(0);
    for (const e of hull.engines) expect(e.pos[2]).toBeLessThan(-hull.lengthM * 0.3);
  });
});
