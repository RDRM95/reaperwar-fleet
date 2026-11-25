export * from './kit';
export * from './types';
import { ALLIANCE_CARRIER, ALLIANCE_CRUISER, ALLIANCE_DREADNOUGHT, ALLIANCE_FIGHTER, ALLIANCE_FRIGATE } from './alliance';
import { REAPER_DESTROYER, REAPER_OCULUS, REAPER_SOVEREIGN } from './reaper';
import type { HullDef } from './types';

// Order matters to the scale probe, which draws the first two entries. New hulls go at the end.
export const HULLS: HullDef[] = [
  ALLIANCE_FRIGATE,
  ALLIANCE_CRUISER,
  ALLIANCE_FIGHTER,
  ALLIANCE_DREADNOUGHT,
  ALLIANCE_CARRIER,
  REAPER_OCULUS,
  REAPER_DESTROYER,
  REAPER_SOVEREIGN,
];
export const hullById = (id: string): HullDef => {
  const h = HULLS.find((x) => x.id === id);
  if (!h) throw new Error(`unknown hull ${id}`);
  return h;
};
