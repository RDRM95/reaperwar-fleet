/**
 * Uniform spatial hash, rebuilt each tick with a counting sort. Buckets are
 * filled in ship-index order, so iteration order (and therefore floating-point
 * summation order) is the same on every machine.
 */
export class SpatialGrid {
  readonly cellX: Int32Array;
  readonly cellY: Int32Array;
  readonly cellZ: Int32Array;
  readonly items: Int32Array;
  readonly start: Int32Array;
  private readonly keys: Int32Array;
  private readonly cursor: Int32Array;
  private readonly mask: number;
  readonly cellSize: number;

  constructor(capacity: number, cellSize: number) {
    this.cellSize = cellSize;
    let size = 1024;
    while (size < capacity * 2) size *= 2;
    this.mask = size - 1;
    this.cellX = new Int32Array(capacity);
    this.cellY = new Int32Array(capacity);
    this.cellZ = new Int32Array(capacity);
    this.keys = new Int32Array(capacity);
    this.items = new Int32Array(capacity);
    this.start = new Int32Array(size + 1);
    this.cursor = new Int32Array(size);
  }

  bucket(x: number, y: number, z: number): number {
    return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & this.mask;
  }

  build(n: number, px: Float64Array, py: Float64Array, pz: Float64Array, alive: Uint8Array): void {
    const { cellX, cellY, cellZ, keys, start, items } = this;
    const inv = 1 / this.cellSize;
    start.fill(0);
    for (let i = 0; i < n; i++) {
      if (alive[i] === 0) {
        keys[i] = -1;
        continue;
      }
      const x = (cellX[i] = Math.floor(px[i] * inv));
      const y = (cellY[i] = Math.floor(py[i] * inv));
      const z = (cellZ[i] = Math.floor(pz[i] * inv));
      const k = (keys[i] = this.bucket(x, y, z));
      start[k + 1]++;
    }
    const size = this.mask + 1;
    for (let b = 0; b < size; b++) start[b + 1] += start[b];
    const cursor = this.cursor;
    cursor.set(start.subarray(0, size));
    for (let i = 0; i < n; i++) {
      const k = keys[i];
      if (k >= 0) items[cursor[k]++] = i;
    }
  }
}
