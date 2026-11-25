export * from './kit';
export * from './types';
import { ALLIANCE_CARRIER, ALLIANCE_CRUISER, ALLIANCE_DREADNOUGHT, ALLIANCE_FIGHTER, ALLIANCE_FRIGATE } from './alliance';
import type { HullDef } from './types';

export const HULLS: HullDef[] = [ALLIANCE_FRIGATE, ALLIANCE_CRUISER, ALLIANCE_FIGHTER, ALLIANCE_DREADNOUGHT, ALLIANCE_CARRIER];
export const hullById = (id: string): HullDef => {
  const h = HULLS.find((x) => x.id === id);
  if (!h) throw new Error(`unknown hull ${id}`);
  return h;
};
