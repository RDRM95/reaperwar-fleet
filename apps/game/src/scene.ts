/**
 * Turns two snapshots and a camera into what the renderer draws this frame:
 * hull instances (culled, with a level of detail each), engine flares, and a
 * glint for every ship too small on screen to show as a hull.
 */
import type { HullDef } from '@rw/hulls';
import type { OrbitRig } from './camera';
import type { Renderer } from './render/renderer';
import type { SimStatic, Snap } from './simClient';

const TEAM_TINT: [number, number, number][] = [
  [1, 1, 1],
  [1.0, 0.62, 0.5],
];
const TEAM_GLINT: [number, number, number][] = [
  [0.3, 0.72, 1.6],
  [1.3, 0.5, 0.22],
];
const TEAM_ENGINE: ([number, number, number] | null)[] = [null, [1.0, 0.42, 0.18]];

export class SceneBuilder {
  hullOf = new Uint16Array(0);
  lodOf = new Uint8Array(0);
  sorted = new Float32Array(0);
  shipCount = 0;
  spriteCount = 0;
  glints = 0;
  /** Interpolated centre of all live ships, metres. */
  readonly centroid = new Float64Array(3);

  constructor(private hulls: HullDef[], private classToHull: number[]) {}

  /** Interpolated world position of one ship. */
  shipPos(a: Snap, b: Snap, alpha: number, i: number, out: Float64Array): void {
    const pa = a.views.pos, pb = b.views.pos, k = i * 3;
    out[0] = pa[k] + (pb[k] - pa[k]) * alpha;
    out[1] = pa[k + 1] + (pb[k + 1] - pa[k + 1]) * alpha;
    out[2] = pa[k + 2] + (pb[k + 2] - pa[k + 2]) * alpha;
  }

  computeCentroid(a: Snap, b: Snap, alpha: number, n: number): void {
    const pa = a.views.pos, pb = b.views.pos, alive = b.views.alive;
    let x = 0, y = 0, z = 0, c = 0;
    for (let i = 0, k = 0; i < n; i++, k += 3) {
      if (!alive[i]) continue;
      x += pa[k] + (pb[k] - pa[k]) * alpha;
      y += pa[k + 1] + (pb[k + 1] - pa[k + 1]) * alpha;
      z += pa[k + 2] + (pb[k + 2] - pa[k + 2]) * alpha;
      c++;
    }
    if (c > 0) {
      this.centroid[0] = x / c; this.centroid[1] = y / c; this.centroid[2] = z / c;
    }
  }

  build(r: Renderer, st: SimStatic, a: Snap, b: Snap, alpha: number, cam: OrbitRig): void {
    const n = st.n;
    r.ensureCapacity(n, n * 6);
    if (this.hullOf.length < n) {
      this.hullOf = new Uint16Array(n);
      this.lodOf = new Uint8Array(n);
    }
    if (this.sorted.length < r.instances.length) this.sorted = new Float32Array(r.instances.length);
    const inst = r.instances, spr = r.sprites;
    const pa = a.views.pos, pb = b.views.pos;
    const fa = a.views.fwd, fb = b.views.fwd, ua = a.views.up, ub = b.views.up;
    const sa = a.views.speed, sb = b.views.speed, alive = b.views.alive;
    const cx = cam.pos[0], cy = cam.pos[1], cz = cam.pos[2];
    const fx = cam.fwd[0], fy = cam.fwd[1], fz = cam.fwd[2];
    const rx = cam.right[0], ry = cam.right[1], rz = cam.right[2];
    const ux = cam.up[0], uy = cam.up[1], uz = cam.up[2];
    const tanY = Math.tan(cam.fovY / 2);
    const tanX = tanY * (r.width / r.height);
    const pxPerRad = r.height / (2 * tanY);
    const q = r.quality;
    let ships = 0, sprites = 0, glints = 0;
    const spriteCap = spr.length / 8;

    for (let i = 0, k = 0; i < n; i++, k += 3) {
      if (!alive[i]) continue;
      const cls = st.cls[i];
      const info = st.classes[cls];
      const x = pa[k] + (pb[k] - pa[k]) * alpha - cx;
      const y = pa[k + 1] + (pb[k + 1] - pa[k + 1]) * alpha - cy;
      const z = pa[k + 2] + (pb[k + 2] - pa[k + 2]) * alpha - cz;
      const depth = x * fx + y * fy + z * fz;
      const rad = info.radius * 1.6;
      if (depth < -rad) continue;
      const side = x * rx + y * ry + z * rz;
      if (side > depth * tanX + rad * 2 || side < -depth * tanX - rad * 2) continue;
      const vert = x * ux + y * uy + z * uz;
      if (vert > depth * tanY + rad * 2 || vert < -depth * tanY - rad * 2) continue;
      const dist = Math.sqrt(x * x + y * y + z * z);
      const px = (info.lengthM / Math.max(dist, 1)) * pxPerRad;
      const team = st.team[i];
      const throttle = Math.min(1, (sa[i] + (sb[i] - sa[i]) * alpha) / info.maxSpeed);
      const hull = this.classToHull[cls];

      if (px < q.minHullPx * 3 && sprites < spriteCap) {
        // Too small to read as a hull: a point of light in the fleet's colour.
        const fade = px <= q.minHullPx ? 1 : 1 - (px - q.minHullPx) / (q.minHullPx * 2);
        const g = TEAM_GLINT[team] ?? TEAM_GLINT[0];
        const bright = (1.6 + Math.min(2.4, info.lengthM / 200)) * fade * (0.7 + 0.5 * throttle);
        const o = sprites++ * 8;
        spr[o] = x; spr[o + 1] = y; spr[o + 2] = z; spr[o + 3] = 0;
        spr[o + 4] = g[0] * bright; spr[o + 5] = g[1] * bright; spr[o + 6] = g[2] * bright;
        spr[o + 7] = 2.4 + Math.min(2.2, info.lengthM / 400);
        glints++;
      }
      if (px < q.minHullPx) continue;

      // Blend the orientation and write the instance.
      let dx = fa[k] + (fb[k] - fa[k]) * alpha, dy = fa[k + 1] + (fb[k + 1] - fa[k + 1]) * alpha, dz = fa[k + 2] + (fb[k + 2] - fa[k + 2]) * alpha;
      let l = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx *= l; dy *= l; dz *= l;
      let vx = ua[k] + (ub[k] - ua[k]) * alpha, vy = ua[k + 1] + (ub[k + 1] - ua[k + 1]) * alpha, vz = ua[k + 2] + (ub[k + 2] - ua[k + 2]) * alpha;
      const d = vx * dx + vy * dy + vz * dz;
      vx -= dx * d; vy -= dy * d; vz -= dz * d;
      l = 1 / Math.sqrt(vx * vx + vy * vy + vz * vz);
      vx *= l; vy *= l; vz *= l;
      const tint = TEAM_TINT[team] ?? TEAM_TINT[0];
      const o = ships * 16;
      inst[o] = x; inst[o + 1] = y; inst[o + 2] = z; inst[o + 3] = 1;
      inst[o + 4] = dx; inst[o + 5] = dy; inst[o + 6] = dz; inst[o + 7] = throttle;
      inst[o + 8] = vx; inst[o + 9] = vy; inst[o + 10] = vz; inst[o + 11] = (i * 0.618034) % 1;
      inst[o + 12] = tint[0]; inst[o + 13] = tint[1]; inst[o + 14] = tint[2]; inst[o + 15] = 0;
      this.hullOf[ships] = hull;
      this.lodOf[ships] = px > q.fullDetailPx ? 0 : 1;
      ships++;

      // Engine flares at each nozzle.
      const def = this.hulls[hull];
      const ec = TEAM_ENGINE[team] ?? def.engineColor;
      const sx = vy * dz - vz * dy, sy = vz * dx - vx * dz, sz = vx * dy - vy * dx; // right = up x fwd
      const power = 0.25 + 1.6 * throttle;
      for (const e of def.engines) {
        if (sprites >= spriteCap) break;
        const s = sprites++ * 8;
        spr[s] = x + sx * e.pos[0] + vx * e.pos[1] + dx * (e.pos[2] - e.radius);
        spr[s + 1] = y + sy * e.pos[0] + vy * e.pos[1] + dy * (e.pos[2] - e.radius);
        spr[s + 2] = z + sz * e.pos[0] + vz * e.pos[1] + dz * (e.pos[2] - e.radius);
        spr[s + 3] = e.radius * (5 + 5 * throttle);
        spr[s + 4] = ec[0] * power; spr[s + 5] = ec[1] * power; spr[s + 6] = ec[2] * power;
        spr[s + 7] = 0;
      }
    }
    this.shipCount = ships;
    this.spriteCount = sprites;
    this.glints = glints;
  }
}
