import type { MeshData, V3 } from './kit';

export interface EngineNode {
  /** Centre of the nozzle exit, hull-local metres. */
  pos: V3;
  /** Nozzle radius, metres. */
  radius: number;
}

export interface HullDef {
  id: string;
  /** Design length in metres; the built mesh must match it (tested). */
  lengthM: number;
  /** detail 0 = full hull, 1 = distant hull (same silhouette, no small parts). */
  build(detail: 0 | 1): MeshData;
  engines: EngineNode[];
  /** Linear RGB of the engine exhaust. */
  engineColor: [number, number, number];
}
