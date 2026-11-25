export * from './kit';
export * from './types';
import { ALLIANCE_CRUISER, ALLIANCE_FRIGATE } from './alliance';
import { REAPER_DESTROYER, REAPER_OCULUS, REAPER_SOVEREIGN } from './reaper';
import type { HullDef } from './types';

export const HULLS: HullDef[] = [ALLIANCE_FRIGATE, ALLIANCE_CRUISER, REAPER_OCULUS, REAPER_DESTROYER, REAPER_SOVEREIGN];
export const hullById = (id: string): HullDef => {
  const h = HULLS.find((x) => x.id === id);
  if (!h) throw new Error(`unknown hull ${id}`);
  return h;
};
