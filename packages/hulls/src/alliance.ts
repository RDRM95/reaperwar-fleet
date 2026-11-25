/**
 * Systems Alliance hulls. Original designs in the Alliance idiom: a slim
 * spear-shaped pressure hull, swept wing pylons carrying outboard engine
 * nacelles, pale armour over a dark belly, and a blue identity stripe.
 */
import { MeshBuilder, octRing, ovalRing, translate, type Mat, type V3 } from './kit';
import type { HullDef } from './types';

const PLATE: Mat = { color: [0.6, 0.63, 0.68] };
const PLATE_HI: Mat = { color: [0.72, 0.75, 0.8] };
const BELLY: Mat = { color: [0.1, 0.12, 0.16], kind: 1 };
const TRIM: Mat = { color: [0.2, 0.23, 0.29], kind: 1 };
const STRIPE: Mat = { color: [0.07, 0.2, 0.55] };
const WINDOW: Mat = { color: [1, 0.86, 0.6], glow: 0.55, kind: 2 };
const ENGINE: Mat = { color: [0.45, 0.75, 1], glow: 1, kind: 2 };
const NAV: Mat = { color: [0.3, 0.6, 1], glow: 0.9, kind: 2 };
const ENGINE_COLOR: [number, number, number] = [0.35, 0.65, 1.0];

type Station = [z: number, halfW: number, halfH: number, cy?: number];

/** Main pressure hull: pale top, dark belly, optional stripe on the flanks between two spans. */
function spine(b: MeshBuilder, st: Station[], stripe: [number, number] | null, cut = 0.34): void {
  const rings = st.map(([z, w, h, cy]) => octRing(z, w, h, cut, 0, cy ?? 0));
  b.loft(rings, (span, side) => {
    if (side === 0 || side === 1 || side === 7) return BELLY;
    if ((side === 2 || side === 6) && stripe && span >= stripe[0] && span <= stripe[1]) return STRIPE;
    if (side === 4) return PLATE_HI;
    if (side < 0) return TRIM;
    return PLATE;
  });
}

/** Engine nacelle along Z from zFront to zBack (zBack < zFront), glowing at the back. */
function nacelle(b: MeshBuilder, x: number, y: number, zFront: number, zBack: number, r: number, sides: number): void {
  const len = zFront - zBack;
  b.smooth(() => {
    b.loft(
      [
        ovalRing(zFront, r * 0.25, r * 0.25, sides, x, y),
        ovalRing(zFront - len * 0.18, r * 0.8, r * 0.8, sides, x, y),
        ovalRing(zFront - len * 0.5, r, r, sides, x, y),
        ovalRing(zBack + len * 0.12, r * 0.95, r * 0.95, sides, x, y),
        ovalRing(zBack, r * 0.8, r * 0.8, sides, x, y),
      ],
      (span) => (span === 3 ? TRIM : PLATE),
      { capEnd: false },
    );
  });
  // Recessed glowing exhaust.
  b.loft([ovalRing(zBack, r * 0.8, r * 0.8, sides, x, y), ovalRing(zBack + r * 0.6, r * 0.55, r * 0.55, sides, x, y)], ENGINE, { capStart: false });
}

/** Flat swept wing from a root chord on the hull to a tip chord outboard. */
function wing(b: MeshBuilder, root: { x: number; y: number; z0: number; z1: number; t: number }, tip: { x: number; y: number; z0: number; z1: number; t: number }, m: Mat): void {
  const ring = (c: { x: number; y: number; z0: number; z1: number; t: number }): V3[] => [
    [c.x, c.y - c.t / 2, c.z0],
    [c.x, c.y - c.t / 2, c.z1],
    [c.x, c.y + c.t / 2, c.z1],
    [c.x, c.y + c.t / 2, c.z0],
  ];
  b.loft([ring(root), ring(tip)], (_s, side) => (side === 0 ? BELLY : m));
}

/** A row of lit window strips just proud of a flank. */
function windows(b: MeshBuilder, x: number, y: number, z0: number, z1: number, count: number, h: number): void {
  const step = (z1 - z0) / count;
  for (let i = 0; i < count; i++) {
    const z = z0 + step * i;
    b.slab(z + step * 0.15, z + step * 0.75, { x, y, w: 0.5, h }, { x, y, w: 0.5, h }, WINDOW);
  }
}

function buildFrigate(detail: 0 | 1): ReturnType<MeshBuilder['build']> {
  const b = new MeshBuilder();
  const sides = detail === 0 ? 12 : 6;
  spine(
    b,
    [
      [85, 0.8, 0.6, 0],
      [74, 3.6, 2.4, 0],
      [52, 7.5, 4.6, 0.3],
      [22, 11, 6.6, 0.8],
      [-14, 12.5, 7.6, 1],
      [-48, 11, 7.2, 1],
      [-70, 8, 5.8, 0.8],
      [-79, 5.5, 4.2, 0.6],
    ],
    [2, 4],
  );
  // Bridge blister and dorsal fin.
  b.loft([octRing(34, 2.2, 0.4, 0.3, 0, 6.4), octRing(22, 4.4, 1.9, 0.3, 0, 8.6), octRing(-6, 4.8, 2.1, 0.3, 0, 9.6), octRing(-22, 3, 0.6, 0.3, 0, 8.6)], PLATE_HI);
  b.loft(
    [
      [[-0.7, 8, -30], [0.7, 8, -30], [0.7, 8.5, -30], [-0.7, 8.5, -30]],
      [[-0.6, 8, -72], [0.6, 8, -72], [0.5, 20, -78], [-0.5, 20, -78]],
      [[-0.4, 7, -82], [0.4, 7, -82], [0.3, 19, -84], [-0.3, 19, -84]],
    ],
    STRIPE,
  );
  // Underslung main gun.
  b.loft([octRing(80, 1.2, 1.2, 0.3, 0, -3.6), octRing(30, 2.2, 2, 0.3, 0, -6.4), octRing(-20, 2.6, 2.2, 0.3, 0, -8)], TRIM);
  b.mirrorX(() => {
    // Swept wing pylon and outboard nacelle.
    wing(b, { x: 9, y: 0.5, z0: 2, z1: -46, t: 3.4 }, { x: 33, y: -3.4, z0: -30, z1: -62, t: 1.8 }, PLATE);
    nacelle(b, 36, -3.6, -14, -80, 5.6, sides);
    // Forward strake.
    wing(b, { x: 6, y: 0, z0: 56, z1: 30, t: 1.4 }, { x: 15, y: -0.6, z0: 38, z1: 28, t: 0.6 }, PLATE);
    if (detail === 0) {
      windows(b, 12.2, 2.4, -40, 18, 9, 0.7);
      b.slab(-28, -26.5, { x: 36, y: 2.4, w: 0.8, h: 0.8 }, { x: 36, y: 2.4, w: 0.8, h: 0.8 }, NAV);
    }
  });
  // Stern engine block with two inboard exhausts.
  b.loft([octRing(-79, 5.5, 4.2, 0.34, 0, 0.6), octRing(-85, 4.6, 3.4, 0.34, 0, 0.6)], TRIM, { capStart: false });
  b.mirrorX(() => b.loft([ovalRing(-85.2, 1.7, 2.2, 8, 2.2, 0.6), ovalRing(-84.6, 1.4, 1.9, 8, 2.2, 0.6)], ENGINE));
  return b.build();
}

function buildCruiser(detail: 0 | 1): ReturnType<MeshBuilder['build']> {
  const b = new MeshBuilder();
  const sides = detail === 0 ? 14 : 6;
  spine(
    b,
    [
      [260, 2.5, 2.5, 0],
      [238, 9, 7, 0],
      [196, 19, 12, 1],
      [128, 29, 17, 2],
      [44, 35, 21, 3],
      [-58, 37, 23, 3],
      [-156, 33, 21, 3],
      [-226, 25, 17, 2],
      [-246, 19, 13, 2],
    ],
    [3, 5],
  );
  // Armoured prow collar around the main gun.
  b.loft([octRing(214, 16, 3.2, 0.3, 0, 0), octRing(196, 40, 5, 0.3, 0, 0.5), octRing(150, 46, 6, 0.3, 0, 1), octRing(132, 34, 5, 0.3, 0, 1.4)], (_s, side) => (side === 0 || side === 1 || side === 7 ? BELLY : PLATE_HI));
  // Stepped dorsal superstructure and bridge.
  b.loft([octRing(20, 10, 3, 0.3, 0, 23), octRing(-30, 16, 7, 0.3, 0, 28), octRing(-130, 16, 8, 0.3, 0, 29), octRing(-170, 9, 3, 0.3, 0, 25)], PLATE);
  b.loft([octRing(-48, 7, 2, 0.3, 0, 36), octRing(-66, 9, 6, 0.3, 0, 40), octRing(-104, 9, 6, 0.3, 0, 40), octRing(-120, 5, 2, 0.3, 0, 37)], PLATE_HI);
  b.slab(-150, -215, { x: 0, y: 30, w: 2, h: 14 }, { x: 0, y: 41, w: 1.2, h: 34 }, STRIPE);
  // Ventral keel with hangar mouth.
  b.loft([octRing(60, 8, 2, 0.3, 0, -20), octRing(10, 15, 9, 0.3, 0, -27), octRing(-110, 15, 9, 0.3, 0, -28), octRing(-150, 7, 2, 0.3, 0, -22)], BELLY);
  b.mirrorX(() => {
    // Outrigger hull on a pair of pylons.
    b.loft(
      [octRing(96, 1.5, 1.5, 0.34, 70, -4), octRing(60, 9, 7, 0.34, 70, -4), octRing(-20, 13, 11, 0.34, 70, -4), octRing(-150, 13, 11, 0.34, 70, -4), octRing(-206, 9, 8, 0.34, 70, -4)],
      (span, side) => (side === 0 || side === 1 || side === 7 ? BELLY : side === 2 && span === 2 ? STRIPE : PLATE),
    );
    wing(b, { x: 30, y: -1, z0: 40, z1: -14, t: 6 }, { x: 60, y: -4, z0: 20, z1: -20, t: 4.5 }, PLATE);
    wing(b, { x: 34, y: -1, z0: -110, z1: -170, t: 7 }, { x: 60, y: -4, z0: -110, z1: -158, t: 5 }, PLATE);
    nacelle(b, 70, -4, -196, -252, 9.5, sides);
    nacelle(b, 13, 3, -238, -260, 9, sides);
    // Wing-tip fin.
    wing(b, { x: 82, y: -4, z0: -60, z1: -140, t: 3 }, { x: 108, y: -9, z0: -116, z1: -160, t: 1.4 }, PLATE);
    if (detail === 0) {
      // Broadside battery: a row of low turrets along the flank.
      for (let i = 0; i < 7; i++) {
        const z = 96 - i * 36;
        const x = 30 + Math.min(i, 3) * 2.2;
        b.with(translate(x, 9, z), () => {
          b.loft([octRing(-6, 4, 2, 0.4), octRing(4, 4, 2.4, 0.4), octRing(7, 2, 1.2, 0.4)], TRIM);
          b.slab(7, 19, { x: 0, y: 0.2, w: 0.9, h: 0.9 }, { x: 0, y: 0.2, w: 0.7, h: 0.7 }, BELLY);
        });
      }
      windows(b, 37.4, 12, -150, 30, 20, 1.1);
      windows(b, 36.4, 5, -140, 10, 14, 0.9);
      windows(b, 83.3, -1, -140, -30, 10, 1);
      b.slab(-100, -97, { x: 108.4, y: -9, w: 1, h: 1.4 }, { x: 108.4, y: -9, w: 1, h: 1.4 }, NAV);
    }
  });
  if (detail === 0) {
    // Sensor masts.
    b.slab(-80, -82, { x: 0, y: 52, w: 0.8, h: 14 }, { x: 0, y: 52, w: 0.5, h: 14 }, TRIM);
    b.slab(150, 148, { x: 0, y: 12, w: 0.8, h: 10 }, { x: 0, y: 12, w: 0.5, h: 10 }, TRIM);
  }
  return b.build();
}

export const ALLIANCE_FRIGATE: HullDef = {
  id: 'alliance_frigate',
  lengthM: 170,
  build: buildFrigate,
  engines: [
    { pos: [36, -3.6, -80], radius: 4.5 },
    { pos: [-36, -3.6, -80], radius: 4.5 },
    { pos: [0, 0.6, -85], radius: 3 },
  ],
  engineColor: ENGINE_COLOR,
};

export const ALLIANCE_CRUISER: HullDef = {
  id: 'alliance_cruiser',
  lengthM: 520,
  build: buildCruiser,
  engines: [
    { pos: [70, -4, -252], radius: 7.6 },
    { pos: [-70, -4, -252], radius: 7.6 },
    { pos: [13, 3, -260], radius: 7.2 },
    { pos: [-13, 3, -260], radius: 7.2 },
  ],
  engineColor: ENGINE_COLOR,
};
