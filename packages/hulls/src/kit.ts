/**
 * Mesh kit: every hull in the game is built in code from these few tools.
 * No external models. Local axes: +Z bow, +Y up, +X = up x forward; metres.
 */
export type V3 = [number, number, number];
export type V2 = [number, number];

export interface Mat {
  /** Albedo, linear 0..1. */
  color: [number, number, number];
  /** Self-light strength 0..1 (windows, engines, weapon ports). */
  glow?: number;
  /** 0 = painted plate, 1 = bare dark metal, 2 = light source (no plating pattern). */
  kind?: number;
}

export interface MeshData {
  /** x, y, z per vertex. */
  positions: Float32Array;
  /** x, y, z per vertex, unit length. */
  normals: Float32Array;
  /** r, g, b, glow per vertex, 0..255. */
  colors: Uint8Array;
  /** kind per vertex (see Mat.kind) plus three spare bytes. */
  kinds: Uint8Array;
  indices: Uint32Array;
  triangleCount: number;
  /** Bounding box, metres. */
  min: V3;
  max: V3;
}

interface Tri {
  a: V3;
  b: V3;
  c: V3;
  m: Mat;
  /** Faces in the same smoothing group share normals across soft edges. */
  smooth: number;
}

type Xf = (p: V3) => V3;

export class MeshBuilder {
  private tris: Tri[] = [];
  private xf: Xf[] = [];
  private smoothId = 0;
  private currentSmooth = 0;

  /** Run `fn` with every point passed through `t` first. */
  with(t: Xf, fn: () => void): void {
    this.xf.push(t);
    fn();
    this.xf.pop();
  }

  /** Build `fn` twice: as given and mirrored across the X = 0 plane. */
  mirrorX(fn: () => void): void {
    fn();
    this.with((p) => [-p[0], p[1], p[2]], fn);
  }

  /** Faces added inside `fn` are shaded as one smooth surface. */
  smooth(fn: () => void): void {
    const prev = this.currentSmooth;
    this.currentSmooth = ++this.smoothId;
    fn();
    this.currentSmooth = prev;
  }

  private apply(p: V3): V3 {
    let q = p;
    for (let i = this.xf.length - 1; i >= 0; i--) q = this.xf[i](q);
    return q;
  }

  /** Add a triangle; `out` is a point the face must look away from. */
  private push(a: V3, b: V3, c: V3, m: Mat, inside: V3): void {
    const A = this.apply(a), B = this.apply(b), C = this.apply(c), I = this.apply(inside);
    const nx = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]);
    const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
    const nz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (nx * nx + ny * ny + nz * nz < 1e-10) return; // degenerate
    const mx = (A[0] + B[0] + C[0]) / 3 - I[0], my = (A[1] + B[1] + C[1]) / 3 - I[1], mz = (A[2] + B[2] + C[2]) / 3 - I[2];
    if (nx * mx + ny * my + nz * mz >= 0) this.tris.push({ a: A, b: B, c: C, m, smooth: this.currentSmooth });
    else this.tris.push({ a: A, b: C, c: B, m, smooth: this.currentSmooth });
  }

  /** Flat polygon (convex), facing away from `inside`. */
  poly(pts: V3[], m: Mat, inside: V3): void {
    for (let i = 1; i < pts.length - 1; i++) this.push(pts[0], pts[i], pts[i + 1], m, inside);
  }

  /**
   * Skin a series of rings (same point count each). `mat` may vary by ring
   * span and by side so one loft can carry belly paint, stripes and trim.
   */
  loft(rings: V3[][], mat: Mat | ((span: number, side: number) => Mat), opts: { capStart?: boolean; capEnd?: boolean } = {}): void {
    const pick = typeof mat === 'function' ? mat : () => mat;
    const centre = (r: V3[]): V3 => {
      const c: V3 = [0, 0, 0];
      for (const p of r) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
      return [c[0] / r.length, c[1] / r.length, c[2] / r.length];
    };
    const n = rings[0].length;
    for (let k = 0; k < rings.length - 1; k++) {
      const r0 = rings[k], r1 = rings[k + 1];
      const c0 = centre(r0), c1 = centre(r1);
      const inside: V3 = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2];
      for (let s = 0; s < n; s++) {
        const t = (s + 1) % n;
        const m = pick(k, s);
        this.push(r0[s], r0[t], r1[t], m, inside);
        this.push(r0[s], r1[t], r1[s], m, inside);
      }
    }
    const last = rings.length - 1;
    if (opts.capStart !== false) this.poly(rings[0], pick(0, -1), centre(rings[Math.min(1, last)]));
    if (opts.capEnd !== false) this.poly(rings[last], pick(last - 1, -2), centre(rings[Math.max(0, last - 1)]));
  }

  /** Six-sided block between two rectangles; a quick way to make fins and plates. */
  slab(z0: number, z1: number, a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, m: Mat): void {
    const ring = (z: number, r: { x: number; y: number; w: number; h: number }): V3[] => [
      [r.x - r.w / 2, r.y - r.h / 2, z],
      [r.x + r.w / 2, r.y - r.h / 2, z],
      [r.x + r.w / 2, r.y + r.h / 2, z],
      [r.x - r.w / 2, r.y + r.h / 2, z],
    ];
    this.loft([ring(z0, a), ring(z1, b)], m);
  }

  build(creaseDeg = 30): MeshData {
    const tris = this.tris;
    const count = tris.length;
    const fn = new Float64Array(count * 3);
    for (let i = 0; i < count; i++) {
      const { a, b, c } = tris[i];
      // Area-weighted face normal.
      fn[i * 3] = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      fn[i * 3 + 1] = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      fn[i * 3 + 2] = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }
    // Faces that meet at a point, for smoothing.
    const meet = new Map<string, number[]>();
    const key = (p: V3) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)},${Math.round(p[2] * 100)}`;
    for (let i = 0; i < count; i++) {
      if (tris[i].smooth === 0) continue;
      for (const p of [tris[i].a, tris[i].b, tris[i].c]) {
        const k = `${tris[i].smooth}:${key(p)}`;
        const list = meet.get(k);
        if (list) list.push(i);
        else meet.set(k, [i]);
      }
    }
    const cosCrease = Math.cos((creaseDeg * Math.PI) / 180);
    const positions = new Float32Array(count * 9);
    const normals = new Float32Array(count * 9);
    const colors = new Uint8Array(count * 12);
    const kinds = new Uint8Array(count * 12);
    const indices = new Uint32Array(count * 3);
    const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
    const to8 = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
    for (let i = 0; i < count; i++) {
      const t = tris[i];
      const fl = Math.hypot(fn[i * 3], fn[i * 3 + 1], fn[i * 3 + 2]) || 1;
      const ux = fn[i * 3] / fl, uy = fn[i * 3 + 1] / fl, uz = fn[i * 3 + 2] / fl;
      const corners = [t.a, t.b, t.c];
      for (let v = 0; v < 3; v++) {
        const p = corners[v];
        const o = (i * 3 + v) * 3;
        positions[o] = p[0]; positions[o + 1] = p[1]; positions[o + 2] = p[2];
        for (let d = 0; d < 3; d++) {
          if (p[d] < min[d]) min[d] = p[d];
          if (p[d] > max[d]) max[d] = p[d];
        }
        let nx = ux, ny = uy, nz = uz;
        if (t.smooth !== 0) {
          nx = ny = nz = 0;
          for (const j of meet.get(`${t.smooth}:${key(p)}`)!) {
            const jl = Math.hypot(fn[j * 3], fn[j * 3 + 1], fn[j * 3 + 2]) || 1;
            if ((fn[j * 3] * ux + fn[j * 3 + 1] * uy + fn[j * 3 + 2] * uz) / jl >= cosCrease) {
              nx += fn[j * 3]; ny += fn[j * 3 + 1]; nz += fn[j * 3 + 2];
            }
          }
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
        }
        normals[o] = nx; normals[o + 1] = ny; normals[o + 2] = nz;
        const c = (i * 3 + v) * 4;
        colors[c] = to8(t.m.color[0]); colors[c + 1] = to8(t.m.color[1]); colors[c + 2] = to8(t.m.color[2]);
        colors[c + 3] = to8(t.m.glow ?? 0);
        kinds[c] = t.m.kind ?? 0;
        indices[i * 3 + v] = i * 3 + v;
      }
    }
    return { positions, normals, colors, kinds, indices, triangleCount: count, min, max };
  }
}

/** Rectangle with cut corners, 8 points, counter-clockwise from bottom-left. Side k runs from point k to k+1. */
export function octRing(z: number, halfW: number, halfH: number, cut = 0.3, cx = 0, cy = 0): V3[] {
  const c = Math.min(halfW, halfH) * cut;
  return [
    [cx - halfW + c, cy - halfH, z], // 0: bottom
    [cx + halfW - c, cy - halfH, z], // 1: bottom-right bevel
    [cx + halfW, cy - halfH + c, z], // 2: right
    [cx + halfW, cy + halfH - c, z], // 3: top-right bevel
    [cx + halfW - c, cy + halfH, z], // 4: top
    [cx - halfW + c, cy + halfH, z], // 5: top-left bevel
    [cx - halfW, cy + halfH - c, z], // 6: left
    [cx - halfW, cy - halfH + c, z], // 7: bottom-left bevel
  ];
}

/** Ellipse ring of n points, counter-clockwise starting at the bottom. */
export function ovalRing(z: number, halfW: number, halfH: number, n = 12, cx = 0, cy = 0): V3[] {
  const r: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    r.push([cx + Math.cos(a) * halfW, cy + Math.sin(a) * halfH, z]);
  }
  return r;
}

export const translate = (x: number, y: number, z: number) => (p: V3): V3 => [p[0] + x, p[1] + y, p[2] + z];
export const scale = (x: number, y: number, z: number) => (p: V3): V3 => [p[0] * x, p[1] * y, p[2] * z];
/** Roll about the Z axis (degrees). */
export const rollZ = (deg: number) => {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  return (p: V3): V3 => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
};
/** Pitch about the X axis (degrees). */
export const pitchX = (deg: number) => {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  return (p: V3): V3 => [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
};
/** Yaw about the Y axis (degrees). */
export const yawY = (deg: number) => {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  return (p: V3): V3 => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
};
