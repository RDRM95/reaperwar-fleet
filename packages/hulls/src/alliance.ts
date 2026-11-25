/**
 * Systems Alliance hulls. Original designs in the Alliance idiom: a slim
 * spear-shaped pressure hull, swept wing pylons carrying outboard engine
 * nacelles, pale armour over a dark belly, and a blue identity stripe.
 *
 * Axes: +Z bow, +Y up, +X port. Everything is in metres at true size, so
 * windows (about 1.4 m tall, one row per 3 to 4 m deck) and turrets (a few
 * metres across) stay the same size from frigate to dreadnought.
 */
import { MeshBuilder, octRing, ovalRing, rollZ, scale, translate, yawY, type Mat, type MeshData, type V3 } from './kit';
import type { EngineNode, HullDef } from './types';

const PLATE: Mat = { color: [0.5, 0.53, 0.58] };
const PLATE_HI: Mat = { color: [0.62, 0.65, 0.7] };
const BELLY: Mat = { color: [0.1, 0.12, 0.16], kind: 1 };
const TRIM: Mat = { color: [0.2, 0.23, 0.29], kind: 1 };
const STRIPE: Mat = { color: [0.07, 0.2, 0.55] };
const WINDOW: Mat = { color: [1, 0.86, 0.6], glow: 0.55, kind: 2 };
const ENGINE: Mat = { color: [0.45, 0.75, 1], glow: 1, kind: 2 };
const NAV: Mat = { color: [0.3, 0.6, 1], glow: 0.9, kind: 2 };
/** Gun bores and hangar depths. Darker than the bible's graphite because the renderer casts no shadows into a cavity. */
const BORE: Mat = { color: [0.02, 0.025, 0.035], kind: 1 };
/** Faint accelerator glow inside a big gun's muzzle. */
const COIL: Mat = { color: [0.35, 0.65, 1], glow: 0.2, kind: 2 };
/** Hangar edge and deck lighting. */
const DECK_LIGHT: Mat = { color: [0.7, 0.86, 1], glow: 0.6, kind: 2 };
const ENGINE_COLOR: [number, number, number] = [0.35, 0.65, 1.0];

/** Hull cross-section at z: half width, half height, height of the centre. Listed bow to stern. */
type Station = [z: number, halfW: number, halfH: number, cy?: number];

const isBelly8 = (side: number): boolean => side === 0 || side === 1 || side === 7;

/** Rectangle ring. Sides: 0 bottom, 1 +X, 2 top, 3 -X. */
function boxRing(z: number, halfW: number, halfH: number, cx = 0, cy = 0): V3[] {
  return [
    [cx - halfW, cy - halfH, z],
    [cx + halfW, cy - halfH, z],
    [cx + halfW, cy + halfH, z],
    [cx - halfW, cy + halfH, z],
  ];
}

/**
 * Octagon whose flanks are split into bands at the heights in `belts` (ascending). With k
 * belts the sides are: 0 bottom, 1 lower bevel, 2..2+k the +X flank bands from the bottom
 * up, then upper bevel, top, upper bevel, the -X bands from the top down, and a lower bevel.
 */
function beltRing(z: number, halfW: number, halfH: number, cut: number, cy: number, belts: number[]): V3[] {
  const c = Math.min(halfW, halfH) * cut;
  const lo = cy - halfH + c, hi = cy + halfH - c;
  const k = belts.length;
  const ys = belts.map((y, i) => Math.min(Math.max(y, lo + 0.05 * (i + 1)), hi - 0.05 * (k - i)));
  const r: V3[] = [
    [-halfW + c, cy - halfH, z],
    [halfW - c, cy - halfH, z],
    [halfW, lo, z],
  ];
  for (const y of ys) r.push([halfW, y, z]);
  r.push([halfW, hi, z], [halfW - c, cy + halfH, z], [-halfW + c, cy + halfH, z], [-halfW, hi, z]);
  for (let i = k - 1; i >= 0; i--) r.push([-halfW, ys[i], z]);
  r.push([-halfW, lo, z]);
  return r;
}

/** Linear interpolation of one station column (1 half width, 2 half height, 3 centre height) at z. */
function at(st: Station[], z: number, col: 1 | 2 | 3): number {
  const v = (s: Station): number => s[col] ?? 0;
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], c = st[i + 1];
    if (z <= a[0] && z >= c[0]) return v(a) + ((v(c) - v(a)) * (a[0] - z)) / (a[0] - c[0]);
  }
  return z > st[0][0] ? v(st[0]) : v(st[st.length - 1]);
}
/** Height of the top deck of a station loft at z. */
const topAt = (st: Station[], z: number): number => at(st, z, 3) + at(st, z, 2);
/** Height of the underside of a station loft at z. */
const botAt = (st: Station[], z: number): number => at(st, z, 3) - at(st, z, 2);

interface SpineOpts {
  /** First and last span that carry the identity stripe on the top flank band. */
  stripe?: [number, number];
  cut?: number;
  /** Heights (ascending) that split the flanks into bands. */
  belts?: number[];
  /** Paint of each flank band from the bottom up; plate where not given. */
  bands?: Mat[];
  /** Leave the bow end open (a muzzle is fitted there). */
  open?: boolean;
  /** Spans from this one aft are bare engine-block metal. */
  trimFrom?: number;
}

/** Main pressure hull: pale top, dark belly, identity stripe on the flanks. */
function spine(b: MeshBuilder, st: Station[], o: SpineOpts = {}): void {
  const cut = o.cut ?? 0.34;
  const belts = o.belts ?? [];
  const k = belts.length;
  b.loft(
    st.map(([z, w, h, cy]) => beltRing(z, w, h, cut, cy ?? 0, belts)),
    (span, side) => {
      if (side < 0) return TRIM;
      if (side <= 1 || side === 7 + 2 * k) return BELLY;
      if (o.trimFrom !== undefined && span >= o.trimFrom) return TRIM;
      if (side === 4 + k) return PLATE_HI;
      if (side === 3 + k || side === 5 + k) return PLATE;
      const band = side < 3 + k ? side - 2 : 6 + 2 * k - side;
      if (band === k && o.stripe && span >= o.stripe[0] && span <= o.stripe[1]) return STRIPE;
      return o.bands?.[band] ?? PLATE;
    },
    { capStart: !o.open },
  );
}

/** Faceted deck house or pod lofted through stations; pale on top, graphite beneath. */
function block(b: MeshBuilder, st: Station[], cx = 0, top: Mat = PLATE_HI, flank: Mat = PLATE, cut = 0.28): void {
  b.loft(
    st.map(([z, w, h, cy]) => octRing(z, w, h, cut, cx, cy ?? 0)),
    (_span, side) => (isBelly8(side) ? BELLY : side === 4 ? top : flank),
  );
}

/**
 * Engine nacelle along Z from zFront to zBack (zBack < zFront), glowing at the back. The
 * exhaust plug ends at zBack - r / 4. Six sides or fewer builds the simpler distant version.
 */
function nacelle(b: MeshBuilder, x: number, y: number, zFront: number, zBack: number, r: number, sides: number): void {
  const len = zFront - zBack;
  const far = sides <= 6;
  const ring = (z: number, k: number): V3[] => ovalRing(z, r * k, r * k, sides, x, y);
  b.smooth(() => {
    b.loft(
      far ? [ring(zFront, 0.25), ring(zFront - len * 0.18, 0.8), ring(zFront - len * 0.5, 1), ring(zBack, 0.8)] : [ring(zFront, 0.25), ring(zFront - len * 0.18, 0.8), ring(zFront - len * 0.5, 1), ring(zBack + len * 0.12, 0.95), ring(zBack, 0.8)],
      (span) => (span === 3 ? TRIM : PLATE),
      { capEnd: false },
    );
  });
  // Nozzle lip, then the glowing exhaust plug.
  if (far) b.loft([ring(zBack, 0.8), ring(zBack - r * 0.25, 0.5)], ENGINE, { capStart: false });
  else b.loft([ring(zBack, 0.8), ring(zBack - r * 0.04, 0.7), ring(zBack - r * 0.25, 0.5)], (span, side) => (span === 0 && side >= 0 ? TRIM : ENGINE), { capStart: false });
}

interface Chord {
  x: number;
  y: number;
  z0: number;
  z1: number;
  t: number;
}

/** Flat swept wing from a root chord on the hull to a tip chord outboard. */
function wing(b: MeshBuilder, root: Chord, tip: Chord, m: Mat): void {
  const ring = (c: Chord): V3[] => [
    [c.x, c.y - c.t / 2, c.z0],
    [c.x, c.y - c.t / 2, c.z1],
    [c.x, c.y + c.t / 2, c.z1],
    [c.x, c.y + c.t / 2, c.z0],
  ];
  b.loft([ring(root), ring(tip)], (_s, side) => (side === 0 ? BELLY : m));
}

/** Painted band on the top of a wing: s runs root to tip, u leading to trailing edge. */
function wingDecal(b: MeshBuilder, root: Chord, tip: Chord, s0: number, s1: number, u0: number, u1: number, m: Mat): void {
  const pt = (s: number, u: number): V3 => {
    const z0 = root.z0 + (tip.z0 - root.z0) * s, z1 = root.z1 + (tip.z1 - root.z1) * s;
    const t = root.t + (tip.t - root.t) * s;
    return [root.x + (tip.x - root.x) * s, root.y + (tip.y - root.y) * s + t / 2 + 0.18, z0 + (z1 - z0) * u];
  };
  const mid = pt((s0 + s1) / 2, (u0 + u1) / 2);
  b.poly([pt(s0, u0), pt(s1, u0), pt(s1, u1), pt(s0, u1)], m, [mid[0], mid[1] - 5, mid[2]]);
}

interface FinSection {
  y: number;
  z0: number;
  z1: number;
  t: number;
}

/** Thin vertical blade built from chord sections, root first. */
function fin(b: MeshBuilder, sec: FinSection[], mat: (span: number) => Mat, x = 0): void {
  b.loft(
    sec.map((c): V3[] => [
      [x - c.t / 2, c.y, c.z0],
      [x + c.t / 2, c.y, c.z0],
      [x + c.t / 2, c.y, c.z1],
      [x - c.t / 2, c.y, c.z1],
    ]),
    (span) => mat(span),
  );
}

interface RowOpts {
  m?: Mat;
  /** Lit fraction of each step along the row. */
  fill?: number;
  /** Stand-off from the wall, metres. */
  off?: number;
  /** Z positions where the wall changes angle; strips never straddle one. */
  breaks?: number[];
  /** Leave roughly one strip in `skip` dark, for a lived-in look. */
  skip?: number;
}

/**
 * A row of lit strips just proud of a wall that faces +X and stands `xAt(z)` from the
 * centreline. Call inside mirrorX to light both flanks.
 */
function lightRow(b: MeshBuilder, xAt: (z: number) => number, y: number, zBow: number, zStern: number, count: number, h: number, o: RowOpts = {}): void {
  const step = (zBow - zStern) / count;
  const half = (step * (o.fill ?? 0.62)) / 2;
  const off = o.off ?? 0.25;
  for (let i = 0; i < count; i++) {
    if (o.skip && (i * 7 + Math.round(y * 3)) % o.skip === 0) continue;
    const zc = zBow - step * (i + 0.5);
    const za = zc + half, zb = zc - half;
    if (o.breaks?.some((k) => k < za && k > zb)) continue;
    const xa = xAt(za) + off, xb = xAt(zb) + off;
    b.poly(
      [
        [xa, y - h / 2, za],
        [xb, y - h / 2, zb],
        [xb, y + h / 2, zb],
        [xa, y + h / 2, za],
      ],
      o.m ?? WINDOW,
      [xAt(zc) - 5, y, zc],
    );
  }
}

/** Window row on the +X flank of a station loft whose centreline is at `cx`. */
function flankRow(b: MeshBuilder, st: Station[], y: number, zBow: number, zStern: number, count: number, h: number, o: RowOpts & { cx?: number } = {}): void {
  const cx = o.cx ?? 0;
  lightRow(b, (z) => cx + at(st, z, 1), y, zBow, zStern, count, h, { breaks: st.map((s) => s[0]), ...o });
}

/** Run `fn` as given and mirrored across the plane x = cx (for parts that are not on the centreline). */
function bothSides(b: MeshBuilder, cx: number, fn: () => void): void {
  fn();
  b.with((p) => [2 * cx - p[0], p[1], p[2]], fn);
}

/** Ring around the Y axis with a flat facing +Z. */
function ringY(y: number, r: number, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2 - Math.PI / n;
    out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return out;
}

/**
 * Low gun turret standing on a deck at (x, y, z). `yaw` turns the barrels from the bow
 * (0) towards port (90). `up` = -1 hangs it under a deck.
 */
function turret(b: MeshBuilder, x: number, y: number, z: number, r: number, yaw: number, barrel: number, up = 1): void {
  b.with(translate(x, y, z), () =>
    b.with(scale(1, up, 1), () =>
      b.with(yawY(yaw), () => {
        const h = r * 0.62;
        b.loft([ringY(-0.4, r, 6), ringY(h, r * 0.68, 6)], (_s, side) => (side < 0 ? PLATE : TRIM), { capStart: false });
        const br = Math.max(0.3, r * 0.13);
        for (const gx of [-r * 0.3, r * 0.3]) {
          const ring = (zz: number): V3[] => [
            [gx - br, h * 0.5 - br * 0.6, zz],
            [gx + br, h * 0.5 - br * 0.6, zz],
            [gx, h * 0.5 + br, zz],
          ];
          b.loft([ring(r * 0.5), ring(r * 0.75 + barrel)], BELLY, { capStart: false });
        }
      }),
    ),
  );
}

/** Broadside gun port in a wall that faces +X at `x`: a dark recess and a barrel. */
function gunPort(b: MeshBuilder, x: number, y: number, z: number, w: number, h: number, len: number): void {
  b.poly(
    [
      [x + 0.3, y - h / 2, z + w / 2],
      [x + 0.3, y - h / 2, z - w / 2],
      [x + 0.3, y + h / 2, z - w / 2],
      [x + 0.3, y + h / 2, z + w / 2],
    ],
    BORE,
    [x - 5, y, z],
  );
  const br = h * 0.24;
  const ring = (xx: number): V3[] => [
    [xx, y - br * 0.6, z - br],
    [xx, y - br * 0.6, z + br],
    [xx, y + br, z],
  ];
  b.loft([ring(x), ring(x + len)], TRIM, { capStart: false });
}

/**
 * Gun muzzle closing the forward end of a barrel whose rim is `rim` (facing +Z): an
 * armoured lip, a dark bore `depth` metres deep and, on big guns, a faint coil glow.
 */
function muzzle(b: MeshBuilder, rim: V3[], k: number, depth: number, glow: boolean, lipMat: Mat = TRIM): void {
  const n = rim.length;
  const c: V3 = [0, 0, 0];
  for (const p of rim) {
    c[0] += p[0] / n;
    c[1] += p[1] / n;
    c[2] += p[2] / n;
  }
  const shrink = (f: number, dz: number): V3[] => rim.map((p): V3 => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f, p[2] - dz]);
  const lip = shrink(k, 0), back = shrink(k, depth);
  const coilA = shrink(k * 0.985, depth * 0.3), coilB = shrink(k * 0.82, depth * 0.3);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    b.poly([rim[i], rim[j], lip[j], lip[i]], lipMat, [c[0], c[1], c[2] - 1]);
    // The bore wall faces the axis, so its "inside" point lies outside the barrel.
    const outside: V3 = [lip[i][0] + lip[j][0] - c[0], lip[i][1] + lip[j][1] - c[1], c[2] - depth / 2];
    b.poly([lip[i], lip[j], back[j], back[i]], BORE, outside);
    if (glow) b.poly([coilA[i], coilA[j], coilB[j], coilB[i]], COIL, [c[0], c[1], c[2] - depth]);
  }
  b.poly(back, BORE, [c[0], c[1], c[2] - depth - 1]);
}

/** Small navigation light. */
function navLight(b: MeshBuilder, x: number, y: number, z: number, s: number): void {
  b.slab(z + s, z - s, { x, y, w: s * 2, h: s * 2 }, { x, y, w: s * 2, h: s * 2 }, NAV);
}

/** Thin sensor mast rising from y0 to y1. */
function mast(b: MeshBuilder, x: number, y0: number, y1: number, z: number, w: number): void {
  b.slab(z + w / 2, z - w / 2, { x, y: (y0 + y1) / 2, w, h: y1 - y0 }, { x, y: (y0 + y1) / 2, w: w * 0.6, h: y1 - y0 }, TRIM);
}

/** Flat painted or lit panel lying on a deck (`up` = -1: under a keel). `yEnd` lets it follow a sloping deck. */
function deckPanel(b: MeshBuilder, x0: number, x1: number, y: number, z0: number, z1: number, m: Mat, up = 1, yEnd = y): void {
  b.poly(
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, yEnd, z1],
      [x0, yEnd, z1],
    ],
    m,
    [(x0 + x1) / 2, (y + yEnd) / 2 - 5 * up, (z0 + z1) / 2],
  );
}

/** Flat panel on a wall that faces along Z (`dir` +1 forward, -1 aft). */
function facePanel(b: MeshBuilder, x0: number, x1: number, y0: number, y1: number, z: number, dir: number, m: Mat): void {
  b.poly(
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    m,
    [(x0 + x1) / 2, (y0 + y1) / 2, z - 5 * dir],
  );
}

// ---------------------------------------------------------------------------------------
// Fighter, 15 m: twin-boom dart, forward-swept wings, one engine.
// ---------------------------------------------------------------------------------------

function buildFighter(detail: 0 | 1): MeshData {
  const b = new MeshBuilder();
  fighterParts(b, detail === 1, ENGINE);
  return b.build();
}

/** The fighter's geometry, so that a carrier can park a few on its deck. `exhaust` is the paint of the engine plug. */
function fighterParts(b: MeshBuilder, far: boolean, exhaust: Mat): void {
  // Central pod: cockpit forward, the single engine aft.
  if (far) {
    b.loft([boxRing(4.8, 0.1, 0.08, 0, -0.1), boxRing(1.2, 0.8, 0.58, 0, 0.08), boxRing(-5.4, 0.72, 0.58, 0, 0.1), boxRing(-6.95, 0.42, 0.38, 0, 0.1)], (_s, side) => (side === -2 ? exhaust : side === 0 ? BELLY : PLATE));
  } else {
    b.loft(
      [octRing(4.8, 0.12, 0.1, 0.35, 0, -0.1), octRing(3.4, 0.5, 0.38, 0.35, 0, 0), octRing(1.2, 0.82, 0.6, 0.35, 0, 0.08), octRing(-2.6, 0.9, 0.68, 0.35, 0, 0.1), octRing(-5.4, 0.74, 0.6, 0.35, 0, 0.1), octRing(-6.7, 0.56, 0.5, 0.35, 0, 0.1)],
      (span, side) => (span === 4 ? TRIM : isBelly8(side) ? BELLY : side === 4 ? PLATE_HI : PLATE),
      { capEnd: false },
    );
    b.loft([octRing(-6.7, 0.56, 0.5, 0.35, 0, 0.1), octRing(-6.74, 0.46, 0.41, 0.35, 0, 0.1), octRing(-6.95, 0.3, 0.27, 0.35, 0, 0.1)], (span, side) => (span === 0 && side >= 0 ? TRIM : exhaust), { capStart: false });
    // Canopy.
    b.loft([boxRing(3.3, 0.16, 0.04, 0, 0.36), boxRing(2.3, 0.4, 0.2, 0, 0.6), boxRing(0.5, 0.44, 0.2, 0, 0.78), boxRing(-1.0, 0.2, 0.05, 0, 0.74)], BORE);
    // Ventral cannon.
    b.slab(3.6, -0.6, { x: 0, y: -0.5, w: 0.26, h: 0.34 }, { x: 0, y: -0.62, w: 0.3, h: 0.3 }, TRIM);
  }
  const wingRoot: Chord = { x: 2.0, y: -0.05, z0: -1.1, z1: -4.9, t: 0.24 };
  const wingTip: Chord = { x: 5.6, y: 0.12, z0: 2.0, z1: 0.5, t: 0.08 };
  b.mirrorX(() => {
    // Boom: a cannon at the bow end, a canted fin at the tail.
    const boom: Station[] = far ? [[7.5, 0.05, 0.05], [1.5, 0.3, 0.34], [-7.5, 0.1, 0.16]] : [[7.5, 0.05, 0.05], [6.0, 0.17, 0.19], [1.5, 0.3, 0.34], [-5.0, 0.28, 0.32], [-7.5, 0.1, 0.16]];
    b.loft(
      boom.map(([z, w, h]) => boxRing(z, w, h, 1.95, -0.05)),
      (span, side) => (side === 0 ? BELLY : !far && span === 2 && (side === 1 || side === 3) ? STRIPE : PLATE),
    );
    b.with(translate(1.95, 0.05, 0), () => b.with(rollZ(-20), () => fin(b, [{ y: 0, z0: -4.4, z1: -7.2, t: 0.14 }, { y: 1.9, z0: -6.5, z1: -7.5, t: 0.06 }], () => STRIPE)));
    // Forward-swept wing outboard of the boom, and the centre section that ties boom to pod.
    wing(b, wingRoot, wingTip, PLATE);
    wing(b, { x: 0.5, y: 0, z0: -0.4, z1: -5.1, t: 0.3 }, { x: 1.9, y: -0.05, z0: -0.9, z1: -5.0, t: 0.26 }, PLATE_HI);
    if (!far) {
      wingDecal(b, wingRoot, wingTip, 0.55, 0.8, 0.0, 1.0, STRIPE);
      // Intake on the pod's shoulder.
      b.loft([boxRing(-0.3, 0.2, 0.26, 0.96, 0.22), boxRing(-2.8, 0.14, 0.2, 0.9, 0.24)], (_s, side) => (side === -1 ? BORE : PLATE));
      navLight(b, 5.6, 0.12, 1.2, 0.07);
    }
  });
}

// ---------------------------------------------------------------------------------------
// Frigate, 170 m: arrowhead, two wing nacelles, tall thin fin.
// ---------------------------------------------------------------------------------------

function buildFrigate(detail: 0 | 1): MeshData {
  const b = new MeshBuilder();
  const far = detail === 1;
  const sides = far ? 6 : 12;
  const hull: Station[] = [
    [85, 0.8, 0.6, -2.0],
    [77, 2.8, 1.9, -0.9],
    [58, 5.4, 3.5, 0],
    [28, 8.6, 5.4, 0.7],
    [-8, 11.2, 6.9, 1.0],
    [-44, 10.8, 6.9, 1.0],
    [-66, 8.4, 5.8, 0.8],
    [-78, 6.0, 4.4, 0.6],
  ];
  spine(b, hull, { stripe: [3, 5] });
  // Stern engine block with two inboard exhausts.
  b.loft([octRing(-78, 6, 4.4, 0.34, 0, 0.6), octRing(-81.5, 5, 3.6, 0.34, 0, 0.6)], TRIM, { capStart: false });
  b.mirrorX(() => b.loft([ovalRing(-81.5, 1.8, 2.4, far ? 4 : 8, 2.4, 0.6), ovalRing(-82.9, 1.2, 1.7, far ? 4 : 8, 2.4, 0.6)], ENGINE, { capStart: false }));
  // Underslung main gun, flush with the bow, and the bridge deck house.
  const gun: Station[] = [
    [84.6, 1.2, 1.2, -3.0],
    [44, 1.9, 1.7, -3.9],
    [-16, 2.6, 2.2, -6.6],
    [-40, 1.6, 1.0, -6.2],
  ];
  const house: Station[] = [
    [36, 2.0, 0.5, 5.6],
    [24, 4.2, 1.7, 7.5],
    [-10, 4.8, 1.9, 9.0],
    [-28, 3.0, 0.6, 8.2],
  ];
  if (far) {
    b.loft(gun.map(([z, w, h, cy]) => boxRing(z, w, h, 0, cy)), TRIM);
    b.loft(house.map(([z, w, h, cy]) => boxRing(z, w * 0.9, h, 0, cy)), PLATE_HI);
  } else {
    b.loft(gun.map(([z, w, h, cy]) => octRing(z, w, h, 0.3, 0, cy)), (_s, side) => (side === -1 ? BORE : TRIM));
    block(b, house);
  }
  // Tall thin fin, blue above.
  fin(b, [{ y: 5, z0: -42, z1: -77, t: 1.4 }, { y: 19, z0: -63, z1: -82, t: 0.9 }, { y: 33, z0: -77.5, z1: -84.5, t: 0.4 }], (span) => (span === 0 ? PLATE : STRIPE));
  const wingRoot: Chord = { x: 8, y: 0.4, z0: 26, z1: -54, t: 3.0 };
  const wingTip: Chord = { x: 33, y: -3.0, z0: -34, z1: -64, t: 1.6 };
  b.mirrorX(() => {
    // Swept delta pylon and outboard nacelle: the barbs of the arrowhead.
    wing(b, wingRoot, wingTip, PLATE);
    nacelle(b, 36, -3.2, -18, -83.7, 5.2, sides);
    if (!far) {
      wingDecal(b, wingRoot, wingTip, 0.1, 0.95, 0.04, 0.16, STRIPE);
      flankRow(b, hull, 3.6, 24, -62, 22, 0.8, { skip: 6 });
      flankRow(b, hull, -2.7, 8, -50, 14, 0.8, { skip: 4 });
      flankRow(b, house, 8.6, 20, -8, 8, 0.7, { fill: 0.8 });
      // Point-defence turrets on the wing roots, nav lights on the nacelles.
      turret(b, 13.5, 1.0, -24, 1.7, 90, 3.2);
      turret(b, 3.0, topAt(hull, 46) - 0.2, 46, 1.4, 0, 2.6);
      turret(b, 4.2, botAt(hull, -30) + 0.1, -30, 1.5, 90, 2.8, -1);
      navLight(b, 41.3, -3.2, -50, 0.45);
      // Stabiliser fin on each nacelle, and a dark intake band.
      fin(b, [{ y: 1.0, z0: -50, z1: -76, t: 0.7 }, { y: 8.5, z0: -70, z1: -81, t: 0.3 }], () => PLATE, 36);
      fin(b, [{ y: -7.4, z0: -50, z1: -76, t: 0.7 }, { y: -12.5, z0: -68, z1: -80, t: 0.3 }], () => TRIM, 36);
      flankRow(b, hull, 0.8, 50, 30, 4, 0.8);
      flankRow(b, gun, -5.6, 30, -14, 6, 0.6, { m: DECK_LIGHT });
    }
  });
  if (!far) {
    facePanel(b, -1.6, 1.6, 5.4, 5.9, 36.2, 1, WINDOW);
    mast(b, 0, 10.5, 16, -4, 0.5);
    navLight(b, 0, 33.3, -81, 0.4);
  }
  return b.build();
}

// ---------------------------------------------------------------------------------------
// Cruiser, 707 m: spear hull, armoured prow collar, two outrigger hulls on paired pylons,
// stepped bridge tower, broadside turret row.
// ---------------------------------------------------------------------------------------

function buildCruiser(detail: 0 | 1): MeshData {
  const b = new MeshBuilder();
  const far = detail === 1;
  const sides = far ? 6 : 14;
  const hull: Station[] = [
    [353.5, 5, 5, 0],
    [332, 10, 8.5, 0],
    [286, 16, 12.5, 0.5],
    [205, 20, 15, 1],
    [136, 27, 19, 2],
    [60, 40, 26, 3.5],
    [-80, 43, 29, 4],
    [-205, 41, 28, 4],
    [-288, 32, 23, 3],
    [-322, 25, 18, 2.5],
  ];
  spine(b, hull, { stripe: [5, 7], belts: [14], open: !far, trimFrom: 8 });
  if (!far) muzzle(b, beltRing(353.5, 5, 5, 0.34, 0, [14]), 0.62, 9, false);
  else b.poly(octRing(353.5, 5, 5, 0.34), BORE, [0, 0, 340]);

  // Armoured prow collar with cheek plates.
  const collar: Station[] = [
    [310, 12.5, 10, 0.3],
    [294, 27, 18, 0.5],
    [242, 31, 21, 0.8],
    [222, 23, 16.5, 1],
  ];
  b.loft(
    collar.map(([z, w, h, cy]) => octRing(z, w, h, 0.3, 0, cy ?? 0)),
    (_span, side) => (isBelly8(side) ? BELLY : side === 4 ? PLATE_HI : PLATE),
  );
  b.mirrorX(() => {
    b.loft([boxRing(292, 1.8, 9, 27.6, 0.5), boxRing(244, 1.8, 14, 31.4, 0.8)], PLATE_HI);
    if (!far) b.poly([[30.13, -3, 286], [32.98, -3, 250], [32.98, 4, 250], [30.13, 4, 286]], STRIPE, [20, 0, 268]);
  });

  // Stepped bridge tower: three tiers, each shorter and narrower than the one below.
  const tier1: Station[] = [
    [50, 12, 2.5, 30],
    [14, 20, 7, 36],
    [-204, 20, 7, 37.5],
    [-240, 12, 2.5, 31.5],
  ];
  const tier2: Station[] = [
    [-34, 10, 2, 43.5],
    [-58, 14.5, 6.5, 49.5],
    [-172, 14.5, 6.5, 50.5],
    [-194, 10, 2, 46],
  ];
  const tier3: Station[] = [
    [-82, 7, 2, 57],
    [-96, 10.5, 5.5, 61.5],
    [-142, 10.5, 5.5, 62],
    [-156, 7, 2, 58.5],
  ];
  block(b, tier1, 0, PLATE_HI, PLATE);
  block(b, tier2, 0, PLATE_HI, PLATE);
  block(b, tier3, 0, PLATE_HI, PLATE);
  b.slab(-102, -122, { x: 0, y: 65.5, w: 32, h: 2 }, { x: 0, y: 65.5, w: 36, h: 2 }, PLATE);
  // Dorsal fin aft.
  fin(b, [{ y: 22, z0: -205, z1: -305, t: 3 }, { y: 52, z0: -268, z1: -320, t: 2 }, { y: 76, z0: -308, z1: -333, t: 1 }], (span) => (span === 0 ? PLATE : STRIPE));
  // Ventral keel pod.
  const keel: Station[] = [
    [96, 9, 2.5, -21],
    [30, 18, 10, -31.5],
    [-150, 18, 10, -33],
    [-205, 9, 2.5, -25],
  ];
  b.loft(keel.map(([z, w, h, cy]) => octRing(z, w, h, 0.3, 0, cy ?? 0)), (_s, side) => (side === 2 || side === 6 ? TRIM : BELLY));

  const OX = 84, OY = -5;
  const outrigger: Station[] = [
    [140, 1.8, 1.8, OY],
    [96, 10, 8.5, OY],
    [-10, 14.5, 12.5, OY],
    [-205, 14.5, 12.5, OY],
    [-272, 11, 10, OY],
  ];
  b.mirrorX(() => {
    // Outrigger hull on a pair of pylons.
    b.loft(
      outrigger.map(([z, w, h, cy]) => octRing(z, w, h, 0.34, OX, cy ?? 0)),
      (span, side) => (isBelly8(side) ? BELLY : side === 2 && span === 2 ? STRIPE : side === 4 ? PLATE_HI : PLATE),
    );
    wing(b, { x: 38, y: -1, z0: 62, z1: -16, t: 7.5 }, { x: 71, y: -5, z0: 34, z1: -24, t: 5.5 }, PLATE);
    wing(b, { x: 38, y: -1, z0: -140, z1: -226, t: 8.5 }, { x: 71, y: -5, z0: -150, z1: -214, t: 6 }, PLATE);
    nacelle(b, OX, OY, -258, -336, 11.5, sides);
    nacelle(b, 16, 3.5, -312, -350.5, 12, sides);
    // Broadside gun ledge along the flank.
    const ledge = (z: number, xo: number): V3[] => [
      [34, 7, z],
      [xo, 7, z],
      [xo, 14, z],
      [34, 14, z],
    ];
    b.loft([ledge(58, 39), ledge(34, 53), ledge(-190, 53), ledge(-214, 40)], (_s, side) => (side === 0 ? BELLY : side === 2 ? PLATE_HI : PLATE));
    if (!far) {
      // Broadside battery: a row of twin turrets trained outboard.
      for (let i = 0; i < 11; i++) turret(b, 48.6, 14, 22 - i * 19.8, 3.4, 90, 8);
      lightRow(b, () => 53, 10.5, 30, -186, 30, 1.4, { skip: 5 });
      flankRow(b, hull, 18, 40, -270, 40, 1.4, { skip: 6 });
      flankRow(b, hull, 2.5, 120, -280, 50, 1.4, { skip: 5 });
      flankRow(b, hull, -1.5, 100, -270, 46, 1.4, { skip: 4 });
      flankRow(b, hull, -5.5, 50, -200, 30, 1.4, { skip: 3 });
      flankRow(b, hull, 5, 270, 140, 16, 1.4, { skip: 4 });
      flankRow(b, tier1, 40, 8, -198, 22, 1.4, { skip: 5 });
      flankRow(b, tier1, 36.5, 8, -198, 22, 1.4, { skip: 3 });
      flankRow(b, tier1, 33.5, 4, -190, 20, 1.4, { skip: 4 });
      flankRow(b, tier2, 53, -62, -168, 12, 1.4, { skip: 6 });
      flankRow(b, tier2, 49.5, -62, -168, 12, 1.4, { skip: 4 });
      flankRow(b, tier2, 46.6, -64, -166, 11, 1.4, { skip: 3 });
      flankRow(b, tier3, 62, -98, -140, 6, 1.6, { fill: 0.85 });
      flankRow(b, tier3, 59, -98, -140, 6, 1.4, { skip: 4 });
      flankRow(b, outrigger, -1, 80, -200, 34, 1.4, { cx: OX, skip: 5 });
      flankRow(b, outrigger, -6, 60, -200, 30, 1.4, { cx: OX, skip: 3 });
      flankRow(b, keel, -33, 20, -140, 16, 1.4, { skip: 3 });
      navLight(b, OX + 14.8, OY, -120, 0.9);
      navLight(b, OX, OY + 1.5, 139, 0.8);
      // Dorsal and ventral point-defence turrets.
      turret(b, 19, topAt(hull, 100) - 0.3, 100, 2.6, 0, 5);
      turret(b, 13, topAt(collar, 262) - 0.4, 262, 2.6, 0, 5);
      turret(b, OX, OY + 12.2, -60, 2.8, 90, 6);
      turret(b, OX, OY + 12.2, -150, 2.8, 90, 6);
      turret(b, 10, botAt(keel, -60), -60, 2.8, 90, 6, -1);
    }
  });
  if (!far) {
    facePanel(b, -5.5, 5.5, 56.4, 57.8, -81.8, 1, WINDOW);
    facePanel(b, -8, 8, 43, 44.4, -33.8, 1, WINDOW);
    mast(b, 0, 67, 92, -130, 1.0);
    mast(b, 0, 66.5, 79, -139, 0.7);
    mast(b, 0, topAt(collar, 236) - 0.5, 33, 236, 0.8);
    navLight(b, 0, 76.6, -322, 0.8);
    // Hangar mouth light under the keel pod.
    deckPanel(b, -8, 8, botAt(keel, -20) - 0.2, -20, -110, BORE, -1, botAt(keel, -110) - 0.2);
    b.mirrorX(() => deckPanel(b, 8.4, 9.4, botAt(keel, -20) - 0.25, -20, -110, DECK_LIGHT, -1, botAt(keel, -110) - 0.25));
  }
  return b.build();
}

// ---------------------------------------------------------------------------------------
// Dreadnought, 888 m: slab-sided keel built round the gun, forked prow framing the muzzle,
// four outriggers, three broadside gun decks a side, bridge tower, engine cluster.
// ---------------------------------------------------------------------------------------

function buildDreadnought(detail: 0 | 1): MeshData {
  const b = new MeshBuilder();
  const far = detail === 1;
  const sides = far ? 6 : 14;
  // A blunt slab: nearly full section from the head to the engine block.
  const core: Station[] = [
    [334, 40, 44, 0],
    [300, 46, 54, 0],
    [200, 48, 58, 0],
    [-210, 48, 58, 0],
    [-310, 46, 54, 0],
    [-384, 40, 46, 0],
    [-408, 35, 40, 0],
  ];
  spine(b, core, { stripe: [2, 4], belts: [-14, 40], bands: [TRIM, PLATE, PLATE], cut: 0.18, trimFrom: 5 });

  // Spinal gun: the barrel stands proud of the head between the prongs of the fork.
  const barrelSides = far ? 8 : 16;
  b.loft([ovalRing(328, 13.5, 13.5, barrelSides, 0, 0), ovalRing(356, 13.5, 13.5, barrelSides, 0, 0)], (_s, side) => (side === -2 ? BORE : TRIM), { capStart: false, capEnd: far });
  if (!far) muzzle(b, ovalRing(356, 13.5, 13.5, barrelSides, 0, 0), 0.7, 18, true, PLATE_HI);

  // Dorsal fin and ventral keel blade.
  fin(b, [{ y: 40, z0: -296, z1: -392, t: 3.4 }, { y: 84, z0: -348, z1: -401, t: 2.2 }, { y: 116, z0: -386, z1: -409, t: 1 }], (span) => (span === 0 ? PLATE : STRIPE));
  const keel: Station[] = [
    [230, 8, 4, -56],
    [170, 16, 18, -72],
    [-200, 16, 18, -74],
    [-270, 8, 4, -58],
  ];
  b.loft(keel.map(([z, w, h, cy]) => octRing(z, w, h, 0.3, 0, cy ?? 0)), (_s, side) => (side === 2 || side === 6 ? TRIM : BELLY));

  // Bridge tower, three tiers.
  const tier1: Station[] = [
    [-70, 14, 3, 59.5],
    [-100, 26, 8, 65],
    [-290, 26, 9, 63.5],
    [-320, 14, 3, 55.5],
  ];
  const tier2: Station[] = [
    [-130, 13, 2, 73.5],
    [-150, 18, 7, 79.5],
    [-262, 18, 7, 79],
    [-280, 13, 2, 73.5],
  ];
  const tier3: Station[] = [
    [-168, 9, 2, 87],
    [-180, 13, 6, 92],
    [-236, 13, 6, 92],
    [-248, 9, 2, 87],
  ];
  block(b, tier1, 0, PLATE_HI, PLATE);
  block(b, tier2, 0, PLATE_HI, PLATE);
  block(b, tier3, 0, PLATE_HI, PLATE);
  b.slab(-188, -208, { x: 0, y: 95.5, w: 40, h: 2.4 }, { x: 0, y: 95.5, w: 46, h: 2.4 }, PLATE);

  // Three broadside gun decks a side, each stepping further outboard than the one above.
  const decks = [
    { y0: 24, y1: 40, xo: 57, zf: 176, za: -216, tipF: [200, 47], tipA: [-240, 46], ports: 13 },
    { y0: 6, y1: 24, xo: 65, zf: 204, za: -246, tipF: [232, 46], tipA: [-274, 45], ports: 15 },
    { y0: -14, y1: 6, xo: 73, zf: 232, za: -276, tipF: [264, 46], tipA: [-308, 45], ports: 17 },
  ];
  const UX = 92, UY = 56, LX = 118, LY = -38;
  const upper: Station[] = [
    [64, 4, 3, UY],
    [40, 11.5, 9, UY],
    [-6, 15, 13, UY],
    [-250, 15, 13, UY],
    [-300, 11, 10, UY],
  ];
  const lower: Station[] = [
    [156, 4, 3.5, LY],
    [128, 12.5, 10, LY],
    [70, 16, 14, LY],
    [-220, 16, 14, LY],
    [-272, 12, 10.5, LY],
  ];
  b.mirrorX(() => {
    // Forked prow: a heavy blade either side of the muzzle, blunt at the tip.
    b.loft(
      [octRing(296, 14, 44, 0.3, 30, 0), octRing(336, 14, 40, 0.3, 30, 0), octRing(410, 11.5, 30, 0.3, 27.5, 2), octRing(436, 9, 22, 0.3, 25, 3), octRing(444, 6, 12, 0.3, 22, 3.5)],
      (_span, side) => (isBelly8(side) ? BELLY : side === 6 ? TRIM : side === 4 ? PLATE_HI : PLATE),
    );
    for (const d of decks) {
      const ring = (z: number, xo: number): V3[] => [
        [34, d.y0, z],
        [xo, d.y0, z],
        [xo, d.y1, z],
        [34, d.y1, z],
      ];
      b.loft([ring(d.tipF[0], d.tipF[1]), ring(d.zf, d.xo), ring(d.za, d.xo), ring(d.tipA[0], d.tipA[1])], (_s, side) => (side === 0 ? BELLY : side === 2 ? PLATE_HI : PLATE));
      if (far) continue;
      const pitch = (d.zf - d.za - 28) / (d.ports - 1);
      for (let i = 0; i < d.ports; i++) {
        const z = d.zf - 14 - pitch * i;
        gunPort(b, d.xo, (d.y0 + d.y1) / 2 - 1.5, z, 7, 5, 7);
        if (i % 2 === 1) turret(b, d.xo - 4.4, d.y1, z + pitch / 2, 2.9, 90, 6);
      }
      lightRow(b, () => d.xo, d.y1 - 2.6, d.zf - 4, d.za + 4, d.ports * 4, 1.4, { skip: 5 });
    }
    // Upper and lower outrigger hulls, each on a pair of pylons.
    for (const [st, x, y] of [[upper, UX, UY], [lower, LX, LY]] as const) {
      b.loft(
        st.map(([z, w, h, cy]) => octRing(z, w, h, 0.34, x, cy ?? 0)),
        (span, side) => (isBelly8(side) ? BELLY : side === 2 && span === 2 ? STRIPE : side === 4 ? PLATE_HI : PLATE),
      );
      if (!far) {
        flankRow(b, st, y + 3.5, st[1][0] - 12, st[3][0] - 20, 32, 1.4, { cx: x, skip: 5 });
        flankRow(b, st, y - 1.5, st[2][0], st[3][0] - 10, 28, 1.4, { cx: x, skip: 3 });
        navLight(b, x, y + 2.6, st[0][0] - 1.5, 0.9);
        turret(b, x, y + st[2][2] - 0.3, st[2][0] - 50, 3, 90, 6);
        turret(b, x, y + st[2][2] - 0.3, st[3][0] + 40, 3, 90, 6);
      }
    }
    wing(b, { x: 38, y: 52, z0: 16, z1: -64, t: 9 }, { x: 78, y: 56, z0: -8, z1: -64, t: 7 }, PLATE);
    wing(b, { x: 38, y: 52, z0: -168, z1: -256, t: 10 }, { x: 78, y: 56, z0: -184, z1: -248, t: 7 }, PLATE);
    wing(b, { x: 40, y: -36, z0: 112, z1: 24, t: 10 }, { x: 103, y: -38, z0: 84, z1: 22, t: 7 }, PLATE);
    wing(b, { x: 40, y: -36, z0: -128, z1: -226, t: 11 }, { x: 103, y: -38, z0: -150, z1: -218, t: 7.5 }, PLATE);
    nacelle(b, UX, UY, -284, -374, 12.5, sides);
    nacelle(b, LX, LY, -256, -354, 13.5, sides);
    // Main engine cluster.
    nacelle(b, 18, 21, -378, -439.75, 17, sides);
    nacelle(b, 18, -21, -378, -439.75, 17, sides);
    if (!far) {
      // Accelerator rails down the inner faces of the fork, with a faint coil glow.
      for (const y of [-10, 10]) {
        b.slab(432, 338, { x: 14.6, y, w: 3.2, h: 2.4 }, { x: 14.6, y, w: 3.2, h: 2.4 }, TRIM);
        b.poly([[12.8, y - 0.6, 430], [12.8, y - 0.6, 340], [12.8, y + 0.6, 340], [12.8, y + 0.6, 430]], COIL, [20, y, 385]);
      }
      // Blue flash along each prong.
      b.poly([[43.71, -5, 344], [39.66, -5, 404], [39.66, 5, 404], [43.71, 5, 344]], STRIPE, [28, 0, 374]);
      // Deck rows on the head, the armour belt, the lower hull and the tower.
      for (const y of [40, 36, 32, 28, 24]) flankRow(b, core, y, 296, 238, 7, 1.4, { skip: 4 });
      flankRow(b, core, 45, 190, -300, 62, 1.4, { skip: 6 });
      flankRow(b, core, -19, 200, -300, 56, 1.4, { skip: 3 });
      flankRow(b, core, -23.5, 180, -280, 50, 1.4, { skip: 4 });
      flankRow(b, core, -28, 160, -120, 30, 1.4, { skip: 3 });
      flankRow(b, tier1, 68.5, -104, -286, 22, 1.4, { skip: 5 });
      flankRow(b, tier1, 64.5, -104, -286, 22, 1.4, { skip: 3 });
      flankRow(b, tier1, 60.5, -104, -280, 20, 1.4, { skip: 4 });
      flankRow(b, tier2, 82, -154, -258, 13, 1.4, { skip: 6 });
      flankRow(b, tier2, 78, -154, -258, 13, 1.4, { skip: 4 });
      flankRow(b, tier3, 91.5, -182, -234, 7, 1.7, { fill: 0.85 });
      flankRow(b, keel, -74, 160, -190, 38, 1.4, { skip: 3 });
      flankRow(b, keel, -79, 150, -180, 34, 1.4, { skip: 4 });
      // Head armour flashes and the lights either side of the ventral hangar door.
      deckPanel(b, 16, 34, topAt(core, 290) + 0.3, 290, 216, STRIPE, 1, topAt(core, 216) + 0.3);
      deckPanel(b, 9.4, 10.6, botAt(keel, 60) - 0.25, 60, -100, DECK_LIGHT, -1, botAt(keel, -100) - 0.25);
    }
  });
  if (!far) {
    // Heavy dorsal and ventral turrets on the centreline.
    for (const z of [170, 100, 30]) turret(b, 0, topAt(core, z) - 0.3, z, 9, 0, 22);
    for (const z of [280, -330]) turret(b, 0, botAt(core, z), z, 7, z > 0 ? 0 : 180, 16, -1);
    facePanel(b, -7.5, 7.5, 86.2, 87.8, -167.8, 1, WINDOW);
    facePanel(b, -11, 11, 72.8, 74.2, -129.8, 1, WINDOW);
    mast(b, 0, 97.5, 128, -214, 1.2);
    b.mirrorX(() => mast(b, 8, 97.5, 114, -230, 0.8));
    navLight(b, 0, 116.8, -398, 0.9);
    deckPanel(b, -9, 9, botAt(keel, 60) - 0.2, 60, -100, BORE, -1, botAt(keel, -100) - 0.2);
  }
  return b.build();
}

// ---------------------------------------------------------------------------------------
// Carrier, 900 m: flat and wide, a through-deck hangar open at bow and stern, an island
// tower offset to starboard, no forked prow, few guns.
// ---------------------------------------------------------------------------------------

/** Half width of the hangar tunnel and the heights of its deck and ceiling. */
const TUN_W = 44, TUN_FLOOR = -6, TUN_ROOF = 22;

function buildCarrier(detail: 0 | 1): MeshData {
  const b = new MeshBuilder();
  const far = detail === 1;
  const sides = far ? 6 : 14;
  // Side hulls: [z, half beam, keel height, deck height]. The plan is a broad wedge that
  // widens in a straight line from the bow to the engine pylons, then steps in.
  const side: [number, number, number, number][] = [
    [428, 62, -15, 27],
    [400, 68, -22, 30],
    [250, 94, -31, 32],
    [0, 124, -34, 32],
    [-150, 136, -34, 32],
    [-310, 136, -33, 32],
    [-350, 114, -30, 32],
    [-410, 104, -26, 30],
    [-432, 96, -22, 28],
  ];
  const flank: Station[] = side.map(([z, w]) => [z, w, 0, 0]);
  const sideRing = ([z, w, yb, yt]: [number, number, number, number]): V3[] => {
    const cb = (yt - yb) * 0.16, ct = (yt - yb) * 0.08;
    return [
      [TUN_W, yb, z], // 0 bottom
      [w - cb, yb, z], // 1 lower bevel
      [w, yb + cb, z], // 2 lower flank
      [w, TUN_FLOOR, z], // 3 upper flank
      [w, yt - ct, z], // 4 upper bevel
      [w - ct, yt, z], // 5 deck
      [TUN_W, yt, z], // 6 hangar wall
    ];
  };
  // Hangar deck (with a landing apron proud of the bow) and hangar roof.
  const floor: [number, number][] = [[far ? 450 : 449.7, -8.5], [428, -17], [400, -24], [250, -33], [0, -36], [-150, -36], [-310, -35], [-350, -32], [-410, -28], [-432, -24], [-440, -9.5]];
  const roof: [number, number][] = [[412, 31], [400, 32.5], [250, 34.5], [-350, 34.5], [-410, 32.5], [-420, 31]];
  b.loft(
    floor.map(([z, yb]): V3[] => [[-TUN_W - 2, yb, z], [TUN_W + 2, yb, z], [TUN_W + 2, TUN_FLOOR, z], [-TUN_W - 2, TUN_FLOOR, z]]),
    (_s, s2) => (s2 === 2 ? BELLY : s2 === 0 ? BELLY : TRIM),
  );
  b.loft(
    roof.map(([z, yt]): V3[] => [[-TUN_W - 2, TUN_ROOF, z], [TUN_W + 2, TUN_ROOF, z], [TUN_W + 2, yt, z], [-TUN_W - 2, yt, z]]),
    (_s, s2) => (s2 === 0 ? BORE : s2 === 2 ? PLATE_HI : PLATE),
  );
  // Ventral sensor keel.
  b.loft([octRing(130, 8, 2, 0.3, 0, -37), octRing(70, 16, 7, 0.3, 0, -42), octRing(-120, 16, 7, 0.3, 0, -42), octRing(-170, 8, 2, 0.3, 0, -37)], (_s, s2) => (s2 === 2 || s2 === 6 ? TRIM : BELLY));

  b.mirrorX(() => {
    b.loft(side.map(sideRing), (_span, s2) => {
      if (s2 === -1) return PLATE;
      if (s2 === -2) return TRIM;
      if (s2 === 0 || s2 === 1) return BELLY;
      if (s2 === 2) return TRIM;
      if (s2 === 6) return BORE;
      return s2 === 5 ? PLATE_HI : PLATE;
    });
    // Engines: one large nozzle in each side hull's stern and a nacelle on a swept outboard pylon.
    nacelle(b, 72, 3, -404, -445.75, 17, sides);
    wing(b, { x: 122, y: -4, z0: -196, z1: -326, t: 10 }, { x: 158, y: -4, z0: -262, z1: -344, t: 7 }, PLATE);
    nacelle(b, 172, -4, -240, -446.25, 15, sides);
    // Deck-edge lifts standing out from the flanks, and a ventral skeg under each side hull.
    b.slab(180, 130, { x: 111, y: 31, w: 26, h: 3.2 }, { x: 115, y: 31, w: 26, h: 3.2 }, PLATE);
    b.slab(-40, -90, { x: 137, y: 31, w: 26, h: 3.2 }, { x: 141, y: 31, w: 26, h: 3.2 }, PLATE);
    fin(b, [{ y: -30, z0: -230, z1: -340, t: 4 }, { y: -60, z0: -292, z1: -352, t: 2 }], () => TRIM, 100);
    if (far) return;
    deckPanel(b, 103, 121, 32.9, 174, 136, TRIM);
    deckPanel(b, 129, 147, 32.9, -46, -84, TRIM);
    // Lit hangar mouths, bow and stern.
    facePanel(b, TUN_W + 0.5, TUN_W + 3.2, TUN_FLOOR + 1, TUN_ROOF - 0.5, 428.3, 1, DECK_LIGHT);
    facePanel(b, TUN_W + 0.5, TUN_W + 3.2, TUN_FLOOR + 1, TUN_ROOF - 0.5, -432.3, -1, DECK_LIGHT);
    // Deck-edge lights down the length of the hangar.
    for (let i = 0; i < 8; i++) deckPanel(b, TUN_W - 3.4, TUN_W - 2.2, TUN_FLOOR + 0.3, 420 - i * 106, 324 - i * 106, DECK_LIGHT);
    // Identity stripe and deck rows on the flanks.
    for (let i = 2; i < 5; i++) {
      const [za, wa] = side[i], [zb, wb] = side[i + 1];
      b.poly([[wa + 0.2, 7, za], [wb + 0.2, 7, zb], [wb + 0.2, 12.5, zb], [wa + 0.2, 12.5, za]], STRIPE, [0, 10, (za + zb) / 2]);
    }
    for (const y of [24.5, 20.5, 16.5]) flankRow(b, flank, y, 396, -404, 92, 1.4, { skip: 5 });
    flankRow(b, flank, 2.5, 390, -400, 88, 1.4, { skip: 4 });
    flankRow(b, flank, -1.5, 380, -400, 84, 1.4, { skip: 3 });
    flankRow(b, flank, -13, 240, -300, 58, 1.4, { skip: 3 });
    navLight(b, 187.3, -4, -343, 1);
    navLight(b, 62.5, 26, 427, 0.9);
    // A few guns: one twin turret forward and one aft on each side hull.
    turret(b, 80, 31.8, 250, 4.2, 60, 10);
    turret(b, 112, 31.8, -286, 4.2, 110, 10);
    // Roof lift hatches.
    deckPanel(b, 14, 40, 34.8, 230, 186, TRIM);
    deckPanel(b, 14, 40, 34.8, -250, -294, TRIM);
  });

  // Island tower, offset to starboard.
  const IX = -88;
  const isle1: Station[] = [
    [-10, 10, 3, 33.5],
    [-40, 19, 8.5, 40],
    [-215, 19, 8.5, 40],
    [-245, 10, 3, 34.5],
  ];
  const isle2: Station[] = [
    [-60, 9, 2, 49],
    [-78, 14, 7, 55.5],
    [-180, 14, 7, 55.5],
    [-198, 9, 2, 50.5],
  ];
  const isle3: Station[] = [
    [-96, 7, 2, 62.5],
    [-106, 11, 6, 68],
    [-150, 11, 6, 68],
    [-162, 7, 2, 64.5],
  ];
  block(b, isle1, IX, PLATE_HI, PLATE);
  block(b, isle2, IX, PLATE_HI, PLATE);
  block(b, isle3, IX, PLATE_HI, PLATE);
  b.slab(-110, -126, { x: IX, y: 72, w: 38, h: 2 }, { x: IX, y: 72, w: 42, h: 2 }, PLATE);
  if (!far) {
    // Structural frames inside the hangar, closing in towards the armoured core amidships.
    const depth = [3, 6, 10, 14, 14, 10, 6, 3], drop = [3, 4.5, 6.5, 8.5, 8.5, 6.5, 4.5, 3];
    for (let i = 0; i < 8; i++) {
      const z = 368 - i * 106, d = depth[i], h = drop[i];
      const post = { x: TUN_W + 0.25 - d / 2, y: 8, w: d + 0.5, h: 28.4 };
      const beam = { x: 0, y: TUN_ROOF + 0.2 - h / 2, w: 90, h: h + 0.4 };
      b.mirrorX(() => b.slab(z + 2, z - 2, post, post, BORE));
      b.slab(z + 2, z - 2, beam, beam, BORE);
      if (i === 0 || i === 7) continue;
      const dir = i < 4 ? 1 : -1;
      b.mirrorX(() => facePanel(b, TUN_W - d + 0.3, TUN_W - d + 1.1, TUN_FLOOR + 2, TUN_ROOF - h - 1, z + 2.3 * dir, dir, DECK_LIGHT));
      facePanel(b, -TUN_W + d + 2, TUN_W - d - 2, TUN_ROOF - h + 0.3, TUN_ROOF - h + 1.1, z + 2.3 * dir, dir, DECK_LIGHT);
    }
    bothSides(b, IX, () => {
      flankRow(b, isle1, 44.5, -44, -212, 20, 1.4, { cx: IX, skip: 5 });
      flankRow(b, isle1, 40.5, -44, -212, 20, 1.4, { cx: IX, skip: 3 });
      flankRow(b, isle1, 36.5, -44, -212, 20, 1.4, { cx: IX, skip: 4 });
      flankRow(b, isle2, 58.5, -82, -176, 12, 1.4, { cx: IX, skip: 6 });
      flankRow(b, isle2, 54.5, -82, -176, 12, 1.4, { cx: IX, skip: 4 });
      flankRow(b, isle3, 69, -108, -148, 5, 1.7, { cx: IX, fill: 0.85 });
    });
    facePanel(b, IX - 5.5, IX + 5.5, 61.8, 63.2, -95.8, 1, WINDOW);
    facePanel(b, IX - 7.5, IX + 7.5, 48.3, 49.7, -59.8, 1, WINDOW);
    mast(b, IX, 73.5, 104, -136, 1.2);
    b.slab(-134, -138, { x: IX, y: 94, w: 16, h: 1.4 }, { x: IX, y: 94, w: 16, h: 1.4 }, TRIM);
    mast(b, IX, 62, 84, -170, 0.9);
    navLight(b, IX, 104.8, -136, 0.9);
    // Hangar mouth lintels and sills, and the deck centreline.
    facePanel(b, -TUN_W, TUN_W, TUN_ROOF + 0.5, TUN_ROOF + 2.6, 412.3, 1, DECK_LIGHT);
    facePanel(b, -TUN_W, TUN_W, TUN_ROOF + 0.5, TUN_ROOF + 2.6, -420.3, -1, DECK_LIGHT);
    facePanel(b, -TUN_W, TUN_W, TUN_FLOOR - 2.2, TUN_FLOOR - 0.5, 450, 1, DECK_LIGHT);
    facePanel(b, -TUN_W, TUN_W, TUN_FLOOR - 2.6, TUN_FLOOR - 0.6, -440.3, -1, DECK_LIGHT);
    for (let i = 0; i < 28; i++) deckPanel(b, -0.9, 0.9, TUN_FLOOR + 0.3, 444 - i * 31.5, 426 - i * 31.5, DECK_LIGHT);
    // Roof centreline stripe.
    deckPanel(b, -4, 4, 34.8, 246, -346, STRIPE);
    // Fighters parked on the apron and just inside the hangar mouth: the scale cue.
    for (const [x, z] of [[-30, 438], [-13, 438], [13, 438], [30, 438], [-22, 419], [22, 419], [-34, 398], [34, 398]]) b.with(translate(x, TUN_FLOOR + 0.85, z), () => fighterParts(b, true, TRIM));
  }
  return b.build();
}

const FIGHTER_ENGINES: EngineNode[] = [{ pos: [0, 0.1, -6.95], radius: 0.4 }];
const FRIGATE_ENGINES: EngineNode[] = [
  { pos: [36, -3.2, -85], radius: 4.2 },
  { pos: [-36, -3.2, -85], radius: 4.2 },
  { pos: [2.4, 0.6, -82.9], radius: 1.8 },
  { pos: [-2.4, 0.6, -82.9], radius: 1.8 },
];
const CRUISER_ENGINES: EngineNode[] = [
  { pos: [84, -5, -338.9], radius: 9.2 },
  { pos: [-84, -5, -338.9], radius: 9.2 },
  { pos: [16, 3.5, -353.5], radius: 9.6 },
  { pos: [-16, 3.5, -353.5], radius: 9.6 },
];
const DREADNOUGHT_ENGINES: EngineNode[] = [
  { pos: [18, 21, -444], radius: 13.6 },
  { pos: [-18, 21, -444], radius: 13.6 },
  { pos: [18, -21, -444], radius: 13.6 },
  { pos: [-18, -21, -444], radius: 13.6 },
  { pos: [92, 56, -377.1], radius: 10 },
  { pos: [-92, 56, -377.1], radius: 10 },
  { pos: [118, -38, -357.4], radius: 10.8 },
  { pos: [-118, -38, -357.4], radius: 10.8 },
];
const CARRIER_ENGINES: EngineNode[] = [
  { pos: [72, 3, -450], radius: 13.6 },
  { pos: [-72, 3, -450], radius: 13.6 },
  { pos: [172, -4, -450], radius: 12 },
  { pos: [-172, -4, -450], radius: 12 },
];

export const ALLIANCE_FIGHTER: HullDef = { id: 'alliance_fighter', lengthM: 15, build: buildFighter, engines: FIGHTER_ENGINES, engineColor: ENGINE_COLOR };
export const ALLIANCE_FRIGATE: HullDef = { id: 'alliance_frigate', lengthM: 170, build: buildFrigate, engines: FRIGATE_ENGINES, engineColor: ENGINE_COLOR };
export const ALLIANCE_CRUISER: HullDef = { id: 'alliance_cruiser', lengthM: 707, build: buildCruiser, engines: CRUISER_ENGINES, engineColor: ENGINE_COLOR };
export const ALLIANCE_DREADNOUGHT: HullDef = { id: 'alliance_dreadnought', lengthM: 888, build: buildDreadnought, engines: DREADNOUGHT_ENGINES, engineColor: ENGINE_COLOR };
export const ALLIANCE_CARRIER: HullDef = { id: 'alliance_carrier', lengthM: 900, build: buildCarrier, engines: CARRIER_ENGINES, engineColor: ENGINE_COLOR };
