/**
 * Reaper hulls. Original designs in the Reaper idiom of the design bible:
 * machines that look grown rather than built. One sweeping carapace of
 * overlapping plates, limbs gathered at the head that curl like a closing
 * hand, red-orange light in the joints and the firing chambers, no engines.
 */
import { MeshBuilder, curvePoint, sweepRings, type Mat, type MeshData, type V3 } from './kit';
import type { HullDef } from './types';

type Ring = V3[];

const INNER_LIGHT: [number, number, number] = [1.0, 0.16, 0.06];
/** Light in the seams between plates and in limb joints. */
const SEAM: Mat = { color: INNER_LIGHT, glow: 0.55, kind: 2 };
/** Firing chambers. Kept under 0.9 so the renderer does not treat them as engines. */
const EYE: Mat = { color: INNER_LIGHT, glow: 0.85, kind: 2 };
/** Carapace gunmetal with a violet-blue tint; `v` is the red/green level. */
const metal = (v: number): Mat => ({ color: [v, v, v * 1.33], kind: 1 });
const DEEP = metal(0.035);
const DARK = metal(0.045);
const MID = metal(0.056);
const PALE = metal(0.068);
const EDGE = metal(0.082);

const centreOf = (r: Ring): V3 => {
  const c: V3 = [0, 0, 0];
  for (const p of r) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  return [c[0] / r.length, c[1] / r.length, c[2] / r.length];
};
const scaleRing = (r: Ring, m: number): Ring => {
  const c = centreOf(r);
  return r.map((p) => [c[0] + (p[0] - c[0]) * m, c[1] + (p[1] - c[1]) * m, c[2] + (p[2] - c[2]) * m]);
};
const moveRing = (r: Ring, d: V3): Ring => r.map((p) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]]);

/**
 * Body section: an oval with separate top and bottom heights (flatter belly),
 * optionally pinched out into a keel line along each flank. Starts at the
 * bottom like `ovalRing`. `z` may vary round the ring to tilt or scallop it.
 */
function bodyRing(z: number | ((a: number) => number), w: number, top: number, bot: number, n: number, cy = 0, flange = 0): Ring {
  const r: Ring = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const c = Math.cos(a), s = Math.sin(a);
    r.push([w * c * (1 + flange * c ** 8), cy + (s >= 0 ? top : bot) * s, typeof z === 'number' ? z : z(a)]);
  }
  return r;
}

/** Like `loft` without caps, but facing inward: the walls of a socket, cowl or firing chamber. */
function innerLoft(b: MeshBuilder, rings: Ring[], m: Mat): void {
  const n = rings[0].length;
  for (let k = 0; k < rings.length - 1; k++) {
    const r0 = rings[k], r1 = rings[k + 1];
    const c0 = centreOf(r0), c1 = centreOf(r1);
    for (let s = 0; s < n; s++) {
      const t = (s + 1) % n;
      const quad: Ring = [r0[s], r0[t], r1[t], r1[s]];
      const q = centreOf(quad);
      // A point beyond the wall, so the faces look back at the axis.
      b.poly(quad, m, [2 * q[0] - (c0[0] + c1[0]) / 2, 2 * q[1] - (c0[1] + c1[1]) / 2, 2 * q[2] - (c0[2] + c1[2]) / 2]);
    }
  }
}

/**
 * Like `loft` without caps, for spans that step in so steeply that the ring
 * centres are a poor guide to which way is out (bevels and end caps on leaning
 * rings): the faces look away from the ring centres moved by `bias`.
 */
function skin(b: MeshBuilder, rings: Ring[], mat: Mat | ((span: number, side: number) => Mat), bias: V3): void {
  const pick = typeof mat === 'function' ? mat : () => mat;
  const n = rings[0].length;
  for (let k = 0; k < rings.length - 1; k++) {
    const r0 = rings[k], r1 = rings[k + 1];
    const c0 = centreOf(r0), c1 = centreOf(r1);
    const inside: V3 = [(c0[0] + c1[0]) / 2 + bias[0], (c0[1] + c1[1]) / 2 + bias[1], (c0[2] + c1[2]) / 2 + bias[2]];
    for (let s = 0; s < n; s++) {
      const t = (s + 1) % n;
      b.poly([r0[s], r0[t], r1[t], r1[s]], pick(k, s), inside);
    }
  }
}

/** Smooth interpolation through rows of numbers (Catmull-Rom), u = 0..1 over the rows. */
function spline(rows: number[][], u: number): number[] {
  const n = rows.length - 1;
  const x = Math.max(0, Math.min(1, u)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  const p0 = rows[Math.max(0, i - 1)], p1 = rows[i], p2 = rows[i + 1], p3 = rows[Math.min(n, i + 2)];
  return p1.map((_, d) => 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * f + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * f * f + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * f * f * f));
}

/** Scale to the exact design length along Z and centre it on the origin. */
function fit(m: MeshData, lengthM: number): MeshData {
  const s = lengthM / (m.max[2] - m.min[2]);
  const dz = -((m.max[2] + m.min[2]) / 2) * s;
  const p = m.positions;
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    p[i] *= s;
    p[i + 1] *= s;
    p[i + 2] = p[i + 2] * s + dz;
    for (let d = 0; d < 3; d++) {
      if (p[i + d] < min[d]) min[d] = p[i + d];
      if (p[i + d] > max[d]) max[d] = p[i + d];
    }
  }
  return { ...m, min, max };
}

interface Shell {
  /** Rows of [z, halfWidth, top, bottom, centreY] from the head end to the tail end. */
  stations: number[][];
  plates: number;
  /** Rings per plate. */
  rings: number;
  sides: number;
  flange: number;
  /** Does the joint behind plate j show inner light? */
  seam: (j: number) => boolean;
  /** Length of a lit joint, as a fraction of the whole shell. */
  gap: number;
  /** Rear of each plate stands this much proud of the next. */
  lift: number;
  /** Close the tail with a rounded cap of about this length. */
  tail: number;
  /** Z offset round the ring, in half-widths: sweeps the plate edges back toward the spine. */
  lean?: (a: number) => number;
  /** Tones for alternate plates. */
  tones?: [Mat, Mat];
}

/**
 * A carapace of overlapping plates, shingled front to back: each plate swells
 * toward its rear lip, and the next one starts tucked underneath it.
 */
function carapace(b: MeshBuilder, S: Shell): void {
  const lean = S.lean ?? (() => 0);
  const at = (u: number, m: number, dz = 0): Ring => {
    const [z, w, top, bot, cy] = spline(S.stations, u);
    return bodyRing((a) => z + dz + lean(a) * w, w * m, top * m, bot * m, S.sides, cy, S.flange);
  };
  const belly = (side: number) => Math.sin(((side + 0.5) / S.sides) * Math.PI * 2 - Math.PI / 2) < -0.45;
  const tones = S.tones ?? [MID, PALE];
  for (let j = 0; j < S.plates; j++) {
    const lastPlate = j === S.plates - 1;
    const u0 = j / S.plates + (j > 0 && S.seam(j - 1) ? S.gap : 0);
    const u1 = (j + 1) / S.plates;
    const rings: Ring[] = [];
    for (let i = 0; i < S.rings; i++) {
      const f = i / (S.rings - 1);
      rings.push(at(u0 + (u1 - u0) * f, lastPlate ? 0.97 + 0.03 * f : 1 - S.lift * 0.4 + S.lift * 1.4 * f ** 1.5));
    }
    const lipSpan = S.rings - 2;
    const main = tones[j % 2];
    const w = spline(S.stations, u1)[1];
    const lip = rings[S.rings - 1];
    // The rear edge steps in steeply; these faces look aft whatever the lean.
    const aft: V3 = [0, 0, w * 8];
    b.smooth(() => {
      b.loft(rings, (span, side) => (belly(side) ? DARK : span === lipSpan && !lastPlate ? EDGE : main), { capStart: false, capEnd: false });
      if (lastPlate) {
        // Blunt rounded tail.
        const end = at(1, 0.2, -S.tail);
        skin(b, [lip, at(1, 0.86, -S.tail * 0.45), at(1, 0.55, -S.tail * 0.85), end], (_span, side) => (belly(side) ? DARK : main), aft);
        b.poly(end, DARK, [0, 0, w * 8]);
      } else {
        // Bevel under the lip, so each plate edge has a shadowed back face.
        skin(b, [lip, at(u1, 1 - S.lift * 1.2, -w * S.lift * 0.9)], DEEP, aft);
      }
    });
    if (!lastPlate && S.seam(j)) {
      // The joint: a short sleeve of inner light between this lip and the next plate.
      b.loft([at(u1, 1 - S.lift * 1.6, 0), at(u1 + S.gap * 1.15, 1 - S.lift * 0.3)], SEAM, { capStart: false, capEnd: false });
    }
  }
}

interface Limb {
  /** Control points, root to tip. */
  ctrl: V3[];
  /** Direction of the limb's "back" at the root; thickness is measured along it. */
  up: V3;
  /** Half extents [across, thickness] at t = 0..1. */
  size: (t: number) => [number, number];
  segments: number;
  /** Rings per segment. */
  rings: number;
  sides: number;
  /** Joint length as a fraction of a segment; 0 for none. */
  joint: number;
  /** Does joint k (after segment k) show inner light? */
  lit: (k: number) => boolean;
  /** End in a small firing chamber instead of a point. */
  tipEye?: boolean;
  /** Tone shift per limb so neighbours differ a little. */
  tone?: number;
}

/**
 * A curved, jointed limb: armoured segments swept along a smooth path, each
 * starting in a collar that overlaps the tapered end of the one before, with a
 * narrow joint between that may show inner light.
 */
function limb(b: MeshBuilder, L: Limb): void {
  const S = L.segments, R = L.rings;
  const CORE = 0.8;
  // Per segment: ring parameters along the path and their size multipliers.
  const ts: number[] = [], ms: number[] = [], first: number[] = [];
  for (let k = 0; k < S; k++) {
    const t0 = k / S, t1 = (k + 1 - (k < S - 1 ? L.joint : 0)) / S;
    first.push(ts.length);
    // Each collar is undercut so its back face is a cone, not a flat washer.
    const lead = k > 0 ? (t1 - t0) * 0.05 : 0;
    if (k > 0) { ts.push(t0); ms.push(CORE); }
    for (let i = 0; i < R; i++) {
      const f = i / (R - 1);
      ts.push(t0 + lead + (t1 - t0 - lead) * f);
      ms.push(k === 0 ? 1.04 - 0.12 * f : 1.1 - 0.18 * f ** 0.8);
    }
  }
  first.push(ts.length);
  const path = ts.map((t) => curvePoint(L.ctrl, t));
  const all = sweepRings(path, (_t, i) => { const [w, h] = L.size(ts[i]); return [w * ms[i], h * ms[i]]; }, L.sides, L.up);
  const tone = L.tone ?? 0;
  for (let k = 0; k < S; k++) {
    const seg = all.slice(first[k], first[k + 1]);
    const lastSeg = k === S - 1;
    const main = metal((k % 2 === 0 ? 0.05 : 0.062) + tone);
    const inner = metal(0.04 + tone);
    const collar = k > 0 ? 1 : -1;
    b.smooth(() =>
      b.loft(
        seg,
        (span, side) => (side < 0 || span < collar ? DEEP : span === collar ? EDGE : side < L.sides * 0.25 || side >= L.sides * 0.75 ? inner : main),
        { capStart: false, capEnd: !(lastSeg && L.tipEye) },
      ),
    );
    if (!lastSeg && L.joint > 0) {
      const end = first[k + 1] - 1;
      b.smooth(() => b.loft([scaleRing(all[end], CORE / ms[end]), all[end + 1]], L.lit(k) ? SEAM : DEEP, { capStart: false, capEnd: false }));
    }
    if (lastSeg && L.tipEye) {
      // Firing chamber: a shallow socket with a lit floor, looking along the tip.
      const end = seg[seg.length - 1], prev = seg[seg.length - 2];
      const ce = centreOf(end), cp = centreOf(prev);
      const back: V3 = [(cp[0] - ce[0]) * 0.3, (cp[1] - ce[1]) * 0.3, (cp[2] - ce[2]) * 0.3];
      const floor = moveRing(scaleRing(end, 0.72), back);
      innerLoft(b, [end, floor], DEEP);
      b.poly(floor, EYE, cp);
    }
  }
}

/** One-sided curved panel between rows of points, facing away from `inside` (lids, shields). */
function panel(b: MeshBuilder, rows: V3[][], mat: (row: number, col: number) => Mat, inside: V3): void {
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < rows[r].length - 1; c++) {
      b.poly([rows[r][c], rows[r][c + 1], rows[r + 1][c + 1], rows[r + 1][c]], mat(r, c), inside);
    }
  }
}

interface Hood {
  /** The dome the hood is cut from: rows of [z, halfWidth, top, bottom, centreY], stern-most first. */
  dome: number[][];
  sides: number;
  /** Rear edge, where the hood laps over the carapace. */
  lipZ: (a: number) => number;
  /** Open front edge: furthest forward at the crown (a = 90 degrees), cut back round the chin. */
  rimZ: (a: number) => number;
  /** Back wall of the hollow inside. */
  backZ: (a: number) => number;
  /** Wall thickness at the rim, metres. */
  wall: number;
}

/**
 * A hood: the bow end of a dome, sliced open on a slant so its crown reaches
 * forward over whatever sits inside, with a real inner face.
 */
function hood(b: MeshBuilder, H: Hood): void {
  const section = (z: number): number[] => {
    const d = H.dome;
    if (z <= d[0][0]) return d[0];
    for (let i = 1; i < d.length; i++) {
      if (z <= d[i][0]) {
        const f = (z - d[i - 1][0]) / (d[i][0] - d[i - 1][0]);
        return d[i].map((v, k) => d[i - 1][k] + (v - d[i - 1][k]) * f);
      }
    }
    return d[d.length - 1];
  };
  const at = (zOf: (a: number) => number, m: number): Ring => {
    const r: Ring = [];
    for (let i = 0; i < H.sides; i++) {
      const a = (i / H.sides) * Math.PI * 2 - Math.PI / 2;
      const z = zOf(a);
      const [, w, top, bot, cy] = section(z);
      const s = Math.sin(a);
      r.push([w * m * Math.cos(a), cy + (s >= 0 ? top : bot) * m * s, z]);
    }
    return r;
  };
  const mix = (f: number) => (a: number) => H.lipZ(a) + (H.rimZ(a) - H.lipZ(a)) * f;
  const rim = at(H.rimZ, 1);
  const lip = at(H.lipZ, 1);
  const w = section(H.lipZ(0))[1];
  b.smooth(() => {
    b.loft([lip, at(mix(0.35), 1), at(mix(0.7), 1), rim], (span) => (span === 2 ? EDGE : PALE), { capStart: false, capEnd: false });
    // Bevel where the hood laps over the carapace.
    skin(b, [lip, at((a) => H.lipZ(a) - w * 0.16, 0.72)], DEEP, [0, 0, w * 8]);
  });
  const back = at(H.backZ, 0.62);
  b.smooth(() => innerLoft(b, [rim, at((a) => H.rimZ(a) - H.wall, 0.89), back], DARK));
  b.poly(back, DEEP, [0, 0, -1e5]);
}

// ---------------------------------------------------------------- Oculus

function buildOculus(detail: 0 | 1): MeshData {
  const b = new MeshBuilder();
  const hi = detail === 0;
  const n = hi ? 10 : 6;
  const R = 5.0, RL = 5.5;
  const deg = Math.PI / 180;
  // Eyeball: only the part the lids leave open, with the eye at its bow pole.
  const ball = (phi: number, sides = n): Ring => {
    const r: Ring = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      r.push([R * Math.sin(phi * deg) * Math.cos(a), R * Math.sin(phi * deg) * Math.sin(a), R * Math.cos(phi * deg)]);
    }
    return r;
  };
  b.smooth(() => b.loft((hi ? [15, 46, 84] : [15, 96]).map((p) => ball(p)), (span) => (span === 0 && hi ? MID : DEEP), { capStart: false, capEnd: false }));
  b.poly(ball(16, hi ? 12 : 6), { ...EYE, glow: 0.75 }, [0, 0, 0]);
  // Lids: two armoured shells that close the sphere, hinged at its sides, leaving
  // an almond slit round the eye. The upper lid hangs a little over it.
  const lidPoint = (psi: number, lam: number): V3 => [RL * Math.sin(lam * deg), RL * Math.cos(lam * deg) * Math.sin(psi * deg), RL * Math.cos(lam * deg) * Math.cos(psi * deg)];
  const cols = hi ? 6 : 4, rows = hi ? 6 : 4;
  const lid = (open: number, sign: number) => {
    const grid: V3[][] = [];
    for (let r = 0; r <= rows; r++) {
      const row: V3[] = [];
      for (let c = 0; c <= cols; c++) {
        const lam = -90 + (180 * c) / cols;
        // The slit closes before the sides, where there is no eyeball behind it.
        const edge = open * Math.max(0, 1 - (lam / 60) ** 2) ** 0.8;
        row.push(lidPoint(sign * (edge + ((180 - edge) * r) / rows), lam));
      }
      grid.push(row);
    }
    b.smooth(() => panel(b, grid, (r) => (r === 0 ? EDGE : sign > 0 ? PALE : MID), [0, 0, 0]));
  };
  lid(15, 1);
  lid(29, -1);
  // Three sickle blades standing edge-on round the body: each is a thin crescent
  // rooted along the shell, its points closing in ahead of the eye and behind.
  const prof: [number, number][] = [[2.6, -8.0], [4.6, -6.3], [5.75, -3.2], [6.25, 0], [5.75, 3.2], [4.6, 6.3], [2.6, 8.0]];
  for (let k = 0; k < 3; k++) {
    const th = (90 + k * 120) * deg;
    const c = Math.cos(th), s = Math.sin(th);
    const ctrl = prof.map(([r, z]) => [r * c, r * s, z] as V3);
    const count = hi ? 10 : 4;
    const path: V3[] = [];
    for (let i = 0; i < count; i++) path.push(curvePoint(ctrl, i / (count - 1)));
    const rings = sweepRings(path, (t) => { const m = Math.sin(Math.PI * (0.04 + 0.92 * t)) ** 0.7; return [0.05 + 0.32 * m, 0.05 + 1.25 * m ** 1.5]; }, 4, [c, s, 0]);
    b.smooth(() => b.loft(rings, (_span, side) => (side === 0 || side === 3 ? DARK : PALE)));
  }
  return fit(b.build(hi ? 50 : 65), 16);
}

// ---------------------------------------------------------------- Destroyer

function buildDestroyer(detail: 0 | 1): MeshData {
  const b = new MeshBuilder();
  const hi = detail === 0;
  const n = hi ? 24 : 10;
  // Plate edges sweep back toward the spine.
  const lean = (a: number) => -0.45 * (0.5 + 0.5 * Math.sin(a)) ** 1.5;
  // Body: a short hunched carapace of five plates, thickest just behind the chest.
  carapace(b, {
    stations: [
      [58, 20, 19, 16, -3],
      [44, 27, 27, 19, -1],
      [24, 29, 30, 19, 2],
      [2, 24, 25, 15, 4],
      [-16, 15, 15, 9, 6],
      [-26, 8, 8, 5, 7],
    ],
    plates: 5,
    rings: hi ? 5 : 3,
    sides: n,
    flange: 0.08,
    seam: (j) => j === 1,
    gap: 0.024,
    lift: 0.07,
    tail: 7,
    lean,
  });
  // Hood: grows out of the back, its crown reaching forward and down over the chest.
  const rimZ = (a: number) => 55 + 35 * (0.5 + 0.5 * Math.sin(a)) ** 1.1;
  hood(b, {
    dome: [
      [40, 27, 26, 17.5, -2],
      [55, 26, 24.5, 17, -3],
      [68, 23, 21.5, 16.5, -4],
      [80, 17.5, 17, 15, -5],
      [90, 10, 12, 12, -6],
    ],
    sides: n,
    lipZ: (a) => 53 + lean(a) * 21,
    rimZ,
    backZ: (a) => 59 + (rimZ(a) - 55) * 0.25,
    wall: 2.5,
  });
  // Chest: a dome under the hood carrying the great eye.
  const cy = -3;
  const socket = bodyRing(76.5, 10, 9.6, 9.6, n, cy - 2);
  b.smooth(() =>
    b.loft(
      [bodyRing(56, 16.5, 15, 14.5, n, cy), bodyRing(64, 16.3, 14.8, 13.6, n, cy - 0.6), bodyRing(70.5, 14.5, 13.4, 12, n, cy - 1.4), bodyRing(74.5, 12.3, 11.6, 10.8, n, cy - 1.9), socket],
      MID,
      { capStart: false, capEnd: false },
    ),
  );
  const floor = bodyRing(72, 8, 7.7, 7.7, n, cy - 2);
  b.smooth(() => innerLoft(b, [socket, floor], DEEP));
  b.poly(floor, EYE, [0, cy - 2, 40]);
  if (hi) {
    // Pupil: a dark lens in the middle of the chamber.
    b.smooth(() => b.loft([bodyRing(72.1, 2.9, 2.9, 2.9, 10, cy - 2), bodyRing(73.6, 1.8, 1.8, 1.8, 10, cy - 2)], DEEP, { capStart: false }));
  }
  b.mirrorX(() => {
    // Forward legs: out, down and aft.
    limb(b, {
      ctrl: [[12, -8, 24], [33, -5, 14], [51, -14, -7], [59, -31, -35], [56, -47, -61], [50, -56, -79]],
      up: [0.3, 1, 0],
      size: (t) => { const w = 1.3 + 6.4 * (1 - t) ** 0.9; return [w, w * 0.82]; },
      segments: 3, rings: hi ? 6 : 3, sides: hi ? 12 : 5, joint: hi ? 0.05 : 0, lit: () => true,
    });
    // Rear legs: closer in, trailing straight aft.
    limb(b, {
      ctrl: [[9, -3, 2], [21, 6, -15], [30, 3, -37], [33, -11, -57], [30, -25, -72], [26, -34, -81]],
      up: [0.3, 1, 0],
      size: (t) => { const w = 1.2 + 5.6 * (1 - t) ** 0.9; return [w, w * 0.82]; },
      segments: 3, rings: hi ? 6 : 3, sides: hi ? 12 : 5, joint: hi ? 0.05 : 0, lit: () => true, tone: 0.006,
    });
    // Small forward arms under the chest, curling in.
    limb(b, {
      ctrl: [[11, -14, 50], [20, -24, 62], [18, -31, 75], [10, -30, 84]],
      up: [0.5, -1, 0],
      size: (t) => { const w = 0.8 + 3.2 * (1 - t) ** 0.8; return [w, w * 0.8]; },
      segments: 2, rings: hi ? 5 : 3, sides: hi ? 8 : 5, joint: hi ? 0.07 : 0, lit: () => true,
    });
  });
  return fit(b.build(hi ? 50 : 65), 160);
}

// ---------------------------------------------------------------- Sovereign-class

function buildSovereign(detail: 0 | 1): MeshData {
  const b = new MeshBuilder();
  const hi = detail === 0;
  const n = hi ? 28 : 12;
  const lean = (a: number) => -0.42 * (0.5 + 0.5 * Math.sin(a)) ** 1.5;
  // Mantle: broad, humped, thickest a third of the way back, ending in a blunt tail.
  const mantle = [
    [150, 100, 88, 62, 0],
    [-20, 136, 128, 80, 5],
    [-235, 152, 146, 92, 8],
    [-480, 138, 126, 84, 5],
    [-715, 106, 92, 66, 0],
    [-890, 74, 62, 48, -3],
    [-965, 52, 42, 35, -5],
  ];
  carapace(b, {
    stations: mantle,
    plates: 11,
    rings: hi ? 5 : 3,
    sides: n,
    flange: 0.16,
    seam: (j) => j === 2 || j === 5 || j === 8,
    gap: 0.0085,
    lift: 0.055,
    tail: 22,
    lean,
  });
  // Dorsal shield: a second, paler layer of larger plates riding the back.
  carapace(b, {
    stations: mantle.map(([z, w, top, , cy]) => [z + lean(Math.PI / 2) * w * 0.2, w * 0.8, top * 0.78, top * 0.3, cy + top * 0.3]),
    plates: 7,
    rings: hi ? 5 : 3,
    sides: hi ? 20 : 10,
    flange: 0,
    seam: () => false,
    gap: 0,
    lift: 0.06,
    tail: 20,
    lean,
    tones: [PALE, EDGE],
  });
  // Hood: a cowl round the head, its crown reaching forward and down over the face.
  const rimZ = (a: number) => 170 + 150 * (0.5 + 0.5 * Math.sin(a)) ** 1.6;
  hood(b, {
    dome: [
      [60, 132, 106, 72, 0],
      [130, 138, 116, 76, 0],
      [200, 140, 118, 76, -2],
      [260, 116, 100, 70, -6],
      [320, 60, 62, 50, -12],
    ],
    sides: n,
    lipZ: (a) => 128 + lean(a) * 96,
    rimZ,
    backZ: (a) => 160 + (rimZ(a) - 170) * 0.3,
    wall: 9,
  });
  // Face: a dome inside the hood with the main firing chamber.
  const fy = -6;
  const socket = bodyRing(244, 35, 33, 33, n, fy);
  b.smooth(() => b.loft([bodyRing(150, 70, 62, 54, n, fy), bodyRing(195, 64, 58, 52, n, fy), bodyRing(228, 50, 46, 44, n, fy), socket], MID, { capStart: false, capEnd: false }));
  const floor = bodyRing(227, 25, 24, 24, n, fy);
  b.smooth(() => innerLoft(b, [socket, floor], DEEP));
  b.poly(floor, EYE, [0, fy, 100]);

  // Five great arms round the head: they sweep out, forward, then close like a hand.
  const armProfile: [number, number][] = [[0.22, 0], [0.5, 0.1], [0.82, 0.26], [1, 0.46], [0.97, 0.66], [0.8, 0.83], [0.54, 0.94], [0.3, 1]];
  const arm = (thetaDeg: number, spread: number, reach: number, thick: number, tone: number) => {
    const th = (thetaDeg * Math.PI) / 180;
    const c = Math.cos(th), s = Math.sin(th);
    limb(b, {
      ctrl: armProfile.map(([fr, fz]) => [spread * fr * c, spread * fr * s + fy, 120 + reach * fz] as V3),
      up: [c, s, 0],
      size: (t) => { const w = thick * (0.13 + 0.87 * (1 - t) ** 0.85); return [w, w * 0.62]; },
      segments: 7, rings: hi ? 5 : 3, sides: hi ? 12 : 6, joint: hi ? 0.05 : 0, lit: (k) => k < 4, tipEye: true, tone,
    });
  };
  b.mirrorX(() => {
    arm(54, 275, 880, 84, 0);
    arm(-18, 260, 830, 76, 0.005);
  });
  arm(-90, 220, 740, 78, 0.008);
  // Smaller legs beneath the head and the forward mantle.
  const legProfile: [number, number][] = [[0.3, 0], [0.72, 0.16], [1, 0.48], [0.9, 0.82], [0.62, 1]];
  const leg = (thetaDeg: number, z0: number, spread: number, reach: number, thick: number) => {
    const th = (thetaDeg * Math.PI) / 180;
    const c = Math.cos(th), s = Math.sin(th);
    limb(b, {
      ctrl: legProfile.map(([fr, fz]) => [spread * fr * c, spread * fr * s, z0 + reach * fz] as V3),
      up: [c, s, 0],
      size: (t) => { const w = thick * (0.14 + 0.86 * (1 - t) ** 0.9); return [w, w * 0.8]; },
      segments: 4, rings: hi ? 5 : 3, sides: hi ? 8 : 5, joint: hi ? 0.06 : 0, lit: (k) => k < 2,
    });
  };
  b.mirrorX(() => {
    leg(-60, 110, 215, 380, 26);
    leg(-50, 20, 190, 320, 22);
    leg(-64, -70, 160, 260, 18);
  });
  return fit(b.build(hi ? 50 : 65), 2000);
}

const NO_ENGINES = { engines: [], engineColor: INNER_LIGHT } satisfies Pick<HullDef, 'engines' | 'engineColor'>;

export const REAPER_OCULUS: HullDef = { id: 'reaper_oculus', lengthM: 16, build: buildOculus, ...NO_ENGINES };
export const REAPER_DESTROYER: HullDef = { id: 'reaper_destroyer', lengthM: 160, build: buildDestroyer, ...NO_ENGINES };
export const REAPER_SOVEREIGN: HullDef = { id: 'reaper_sovereign', lengthM: 2000, build: buildSovereign, ...NO_ENGINES };
