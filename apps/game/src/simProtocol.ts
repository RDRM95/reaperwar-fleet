export type ToWorker =
  | { t: 'init'; ships: number; seed: number; rate: number }
  | { t: 'rate'; rate: number }
  | { t: 'recycle'; buffer: ArrayBuffer };

export type ToMain =
  | { t: 'ready'; seed: number; n: number; capacity: number; cls: Uint16Array; team: Uint8Array; classes: { id: string; lengthM: number; radius: number; maxSpeed: number }[] }
  | { t: 'snap'; tick: number; hash: number; stepMs: number; n: number; buffer: ArrayBuffer };
