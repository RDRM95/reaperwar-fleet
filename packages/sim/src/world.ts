/**
 * Simulation state and the fixed-step update.
 *
 * Units: metres, seconds, radians. Local ship axes: +Z forward, +Y up,
 * +X = up x forward. All state is held in flat typed arrays (one entry per
 * ship) so a tick touches memory in order and can be hashed word by word.
 */
import { Rng } from './rng';
import { dcos, dsin } from './dmath';
import { SpatialGrid } from './grid';

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;

/** What the simulation needs to know about a class of ship. Numbers only. */
export interface ShipClass {
  id: string;
  /** Hull length in metres. */
  lengthM: number;
  /** Radius of the sphere used for spacing, metres. */
  radius: number;
  /** Top speed in battle, m/s. */
  maxSpeed: number;
  /** Acceleration along the hull axis, m/s^2. */
  accel: number;
  /** Turn rate, rad/s. */
  turnRate: number;
  /** Distance at which it can pick a target, metres. */
  sensorRange: number;
}

export interface GroupSpawn {
  team: number;
  pos: [number, number, number];
  fwd: [number, number, number];
  /** Loop of points the group flies through, metres. */
  waypoints: [number, number, number][];
  /** Ships, each with a slot offset in the group's frame (x right, y up, z forward). */
  ships: { cls: number; slot: [number, number, number] }[];
}

export interface WorldConfig {
  seed: number;
  classes: ShipClass[];
  groups: GroupSpawn[];
  /** Spare room for ships that appear later (launched fighters). */
  spareCapacity?: number;
}

const MAX_WAYPOINTS = 8;

export class World {
  tick = 0;
  readonly seed: number;
  readonly rng: Rng;
  readonly classes: ShipClass[];
  readonly capacity: number;
  /** Number of ship slots in use (alive or dead). */
  n = 0;

  // Ships.
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly pz: Float64Array;
  readonly fx: Float64Array;
  readonly fy: Float64Array;
  readonly fz: Float64Array;
  readonly ux: Float64Array;
  readonly uy: Float64Array;
  readonly uz: Float64Array;
  readonly speed: Float64Array;
  readonly slotX: Float64Array;
  readonly slotY: Float64Array;
  readonly slotZ: Float64Array;
  readonly cls: Uint16Array;
  readonly team: Uint8Array;
  readonly alive: Uint8Array;
  readonly group: Uint16Array;
  readonly target: Int32Array;

  // Per-class lookups, expanded for speed.
  private readonly cRadius: Float64Array;
  private readonly cMaxSpeed: Float64Array;
  private readonly cAccel: Float64Array;
  private readonly cTurnCos: Float64Array;
  private readonly cTurnSin: Float64Array;
  private readonly cSensor2: Float64Array;

  // Battlegroups.
  readonly groupCount: number;
  readonly gpx: Float64Array;
  readonly gpy: Float64Array;
  readonly gpz: Float64Array;
  readonly gfx: Float64Array;
  readonly gfy: Float64Array;
  readonly gfz: Float64Array;
  readonly gSpeed: Float64Array;
  readonly gCruise: Float64Array;
  readonly gRadius: Float64Array;
  readonly gTeam: Uint8Array;
  readonly gWpCount: Uint8Array;
  readonly gWpIndex: Uint8Array;
  readonly gWp: Float64Array;
  /** Ship indices of each group, concatenated; gStart[g]..gStart[g+1]. */
  readonly gMembers: Int32Array;
  readonly gStart: Int32Array;

  private readonly grid: SpatialGrid;
  private readonly dirX: Float64Array;
  private readonly dirY: Float64Array;
  private readonly dirZ: Float64Array;
  private readonly wantSpeed: Float64Array;

  constructor(cfg: WorldConfig) {
    this.seed = cfg.seed >>> 0;
    this.rng = new Rng(this.seed);
    this.classes = cfg.classes;
    let count = 0;
    for (const g of cfg.groups) count += g.ships.length;
    const cap = (this.capacity = count + (cfg.spareCapacity ?? 0));

    const f64 = () => new Float64Array(cap);
    this.px = f64(); this.py = f64(); this.pz = f64();
    this.fx = f64(); this.fy = f64(); this.fz = f64();
    this.ux = f64(); this.uy = f64(); this.uz = f64();
    this.speed = f64();
    this.slotX = f64(); this.slotY = f64(); this.slotZ = f64();
    this.dirX = f64(); this.dirY = f64(); this.dirZ = f64();
    this.wantSpeed = f64();
    this.cls = new Uint16Array(cap);
    this.team = new Uint8Array(cap);
    this.alive = new Uint8Array(cap);
    this.group = new Uint16Array(cap);
    this.target = new Int32Array(cap).fill(-1);

    const nc = cfg.classes.length;
    this.cRadius = new Float64Array(nc);
    this.cMaxSpeed = new Float64Array(nc);
    this.cAccel = new Float64Array(nc);
    this.cTurnCos = new Float64Array(nc);
    this.cTurnSin = new Float64Array(nc);
    this.cSensor2 = new Float64Array(nc);
    let maxRadius = 1;
    for (let c = 0; c < nc; c++) {
      const k = cfg.classes[c];
      this.cRadius[c] = k.radius;
      this.cMaxSpeed[c] = k.maxSpeed;
      this.cAccel[c] = k.accel;
      this.cTurnCos[c] = dcos(k.turnRate * DT);
      this.cTurnSin[c] = dsin(k.turnRate * DT);
      this.cSensor2[c] = k.sensorRange * k.sensorRange;
      if (k.radius > maxRadius) maxRadius = k.radius;
    }
    this.grid = new SpatialGrid(cap, maxRadius * 3);

    const ng = (this.groupCount = cfg.groups.length);
    const g64 = () => new Float64Array(ng);
    this.gpx = g64(); this.gpy = g64(); this.gpz = g64();
    this.gfx = g64(); this.gfy = g64(); this.gfz = g64();
    this.gSpeed = g64(); this.gCruise = g64(); this.gRadius = g64();
    this.gTeam = new Uint8Array(ng);
    this.gWpCount = new Uint8Array(ng);
    this.gWpIndex = new Uint8Array(ng);
    this.gWp = new Float64Array(ng * MAX_WAYPOINTS * 3);
    this.gMembers = new Int32Array(count);
    this.gStart = new Int32Array(ng + 1);

    let i = 0;
    for (let g = 0; g < ng; g++) {
      const spec = cfg.groups[g];
      const fl = Math.sqrt(spec.fwd[0] * spec.fwd[0] + spec.fwd[1] * spec.fwd[1] + spec.fwd[2] * spec.fwd[2]) || 1;
      this.gpx[g] = spec.pos[0]; this.gpy[g] = spec.pos[1]; this.gpz[g] = spec.pos[2];
      this.gfx[g] = spec.fwd[0] / fl; this.gfy[g] = spec.fwd[1] / fl; this.gfz[g] = spec.fwd[2] / fl;
      this.gTeam[g] = spec.team;
      const wn = Math.min(spec.waypoints.length, MAX_WAYPOINTS);
      this.gWpCount[g] = wn;
      for (let w = 0; w < wn; w++) {
        const o = (g * MAX_WAYPOINTS + w) * 3;
        this.gWp[o] = spec.waypoints[w][0];
        this.gWp[o + 1] = spec.waypoints[w][1];
        this.gWp[o + 2] = spec.waypoints[w][2];
      }
      this.gStart[g] = i;
      let cruise = Infinity;
      let radius = 0;
      // Group frame: forward f, right r = worldUp x f, up u = f x r.
      const bx = this.gfx[g], by = this.gfy[g], bz = this.gfz[g];
      let rx = bz, rz = -bx; // (0,1,0) x f
      const rl = Math.sqrt(rx * rx + rz * rz) || 1;
      rx /= rl; rz /= rl;
      const ux = by * rz, uy = bz * rx - bx * rz, uz = -by * rx;
      for (const s of spec.ships) {
        const k = cfg.classes[s.cls];
        this.cls[i] = s.cls;
        this.team[i] = spec.team;
        this.alive[i] = 1;
        this.group[i] = g;
        this.slotX[i] = s.slot[0]; this.slotY[i] = s.slot[1]; this.slotZ[i] = s.slot[2];
        this.px[i] = spec.pos[0] + rx * s.slot[0] + ux * s.slot[1] + bx * s.slot[2];
        this.py[i] = spec.pos[1] + uy * s.slot[1] + by * s.slot[2];
        this.pz[i] = spec.pos[2] + rz * s.slot[0] + uz * s.slot[1] + bz * s.slot[2];
        this.fx[i] = bx; this.fy[i] = by; this.fz[i] = bz;
        this.ux[i] = ux; this.uy[i] = uy; this.uz[i] = uz;
        this.gMembers[i] = i;
        if (k.maxSpeed < cruise) cruise = k.maxSpeed;
        const d = Math.sqrt(s.slot[0] * s.slot[0] + s.slot[1] * s.slot[1] + s.slot[2] * s.slot[2]) + k.radius;
        if (d > radius) radius = d;
        i++;
      }
      this.gCruise[g] = cruise === Infinity ? 0 : cruise * 0.7;
      this.gRadius[g] = radius;
    }
    this.gStart[ng] = i;
    this.n = i;
  }

  step(): void {
    this.stepGroups();
    this.grid.build(this.n, this.px, this.py, this.pz, this.alive);
    this.steer();
    this.integrate();
    this.scanTargets();
    this.tick++;
  }

  /** Battlegroup anchors fly their waypoint loop; ships hold slots around them. */
  private stepGroups(): void {
    const turn = 0.06 * DT; // rad per tick, expressed as a blend below
    for (let g = 0; g < this.groupCount; g++) {
      const wn = this.gWpCount[g];
      if (wn === 0) continue;
      const o = (g * MAX_WAYPOINTS + this.gWpIndex[g]) * 3;
      let dx = this.gWp[o] - this.gpx[g];
      let dy = this.gWp[o + 1] - this.gpy[g];
      let dz = this.gWp[o + 2] - this.gpz[g];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < this.gRadius[g] * 0.5 + 2000) {
        this.gWpIndex[g] = (this.gWpIndex[g] + 1) % wn;
        continue;
      }
      dx /= d; dy /= d; dz /= d;
      // Ease the heading towards the waypoint at a fleet's stately rate.
      let hx = this.gfx[g] + (dx - this.gfx[g]) * turn * 4;
      let hy = this.gfy[g] + (dy - this.gfy[g]) * turn * 4;
      let hz = this.gfz[g] + (dz - this.gfz[g]) * turn * 4;
      const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
      hx /= hl; hy /= hl; hz /= hl;
      this.gfx[g] = hx; this.gfy[g] = hy; this.gfz[g] = hz;
      const s = this.gSpeed[g] + (this.gCruise[g] - this.gSpeed[g]) * 0.02;
      this.gSpeed[g] = s;
      this.gpx[g] += hx * s * DT;
      this.gpy[g] += hy * s * DT;
      this.gpz[g] += hz * s * DT;
    }
  }

  /** Choose each ship's wanted direction and speed from its slot and its neighbours. */
  private steer(): void {
    const { px, py, pz, fx, fy, fz, cls, alive, group, slotX, slotY, slotZ } = this;
    const { gpx, gpy, gpz, gfx, gfy, gfz, gSpeed, cRadius, cMaxSpeed, dirX, dirY, dirZ, wantSpeed } = this;
    const grid = this.grid;
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (alive[i] === 0) continue;
      const g = group[i];
      const c = cls[i];
      const bx = gfx[g], by = gfy[g], bz = gfz[g];
      let rx = bz, rz = -bx;
      const rl = Math.sqrt(rx * rx + rz * rz) || 1;
      rx /= rl; rz /= rl;
      const vx = by * rz, vy = bz * rx - bx * rz, vz = -by * rx;
      const sx = slotX[i], sy = slotY[i], sz = slotZ[i];
      // Vector from ship to its slot.
      const tx = gpx[g] + rx * sx + vx * sy + bx * sz - px[i];
      const ty = gpy[g] + vy * sy + by * sz - py[i];
      const tz = gpz[g] + rz * sx + vz * sy + bz * sz - pz[i];
      const along = tx * bx + ty * by + tz * bz;
      const radius = cRadius[c];
      // Aim at a point ahead of the slot so a ship on station flies the group's heading.
      const lead = radius * 6 + 600;
      let dx = tx + bx * lead, dy = ty + by * lead, dz = tz + bz * lead;

      // Keep clear of neighbours.
      let qx = 0, qy = 0, qz = 0;
      const cx = grid.cellX[i], cy = grid.cellY[i], cz = grid.cellZ[i];
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const kx = cx + ox, ky = cy + oy, kz = cz + oz;
            const b = grid.bucket(kx, ky, kz);
            const end = grid.start[b + 1];
            for (let s = grid.start[b]; s < end; s++) {
              const j = grid.items[s];
              if (j === i || grid.cellX[j] !== kx || grid.cellY[j] !== ky || grid.cellZ[j] !== kz) continue;
              const ex = px[i] - px[j], ey = py[i] - py[j], ez = pz[i] - pz[j];
              const d2 = ex * ex + ey * ey + ez * ez;
              const min = (radius + cRadius[cls[j]]) * 1.5;
              if (d2 < min * min && d2 > 1e-6) {
                const d = Math.sqrt(d2);
                const push = (min - d) / d;
                qx += ex * push; qy += ey * push; qz += ez * push;
              }
            }
          }
        }
      }
      dx += qx * 4; dy += qy * 4; dz += qz * 4;

      const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dl > 1e-6) {
        dirX[i] = dx / dl; dirY[i] = dy / dl; dirZ[i] = dz / dl;
      } else {
        dirX[i] = fx[i]; dirY[i] = fy[i]; dirZ[i] = fz[i];
      }
      // Match the group's speed, plus a correction for being ahead of or behind the slot.
      let want = gSpeed[g] + along * 0.08;
      const facing = fx[i] * dirX[i] + fy[i] * dirY[i] + fz[i] * dirZ[i];
      if (facing < 0.3) want *= 0.4;
      const top = cMaxSpeed[c];
      wantSpeed[i] = want < 0 ? 0 : want > top ? top : want;
    }
  }

  /** Turn at the class's rate, change speed at its acceleration, then move. */
  private integrate(): void {
    const { px, py, pz, fx, fy, fz, ux, uy, uz, speed, cls, alive, dirX, dirY, dirZ, wantSpeed } = this;
    const { cTurnCos, cTurnSin, cAccel } = this;
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (alive[i] === 0) continue;
      const c = cls[i];
      let ax = fx[i], ay = fy[i], az = fz[i];
      const dx = dirX[i], dy = dirY[i], dz = dirZ[i];
      const dot = ax * dx + ay * dy + az * dz;
      let turnX = 0, turnY = 0, turnZ = 0;
      if (dot >= cTurnCos[c]) {
        ax = dx; ay = dy; az = dz;
      } else {
        // Rotate towards the wanted direction by one tick of turn.
        let tx = dx - ax * dot, ty = dy - ay * dot, tz = dz - az * dot;
        let tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (tl < 1e-9) {
          // Wanted direction is straight behind: turn about the ship's up axis.
          tx = uy[i] * az - uz[i] * ay; ty = uz[i] * ax - ux[i] * az; tz = ux[i] * ay - uy[i] * ax;
          tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        }
        tx /= tl; ty /= tl; tz /= tl;
        turnX = tx; turnY = ty; turnZ = tz;
        const cs = cTurnCos[c], sn = cTurnSin[c];
        ax = ax * cs + tx * sn; ay = ay * cs + ty * sn; az = az * cs + tz * sn;
        const al = Math.sqrt(ax * ax + ay * ay + az * az);
        ax /= al; ay /= al; az /= al;
      }
      fx[i] = ax; fy[i] = ay; fz[i] = az;

      // Up eases towards world up, leaning into the turn, kept square to forward.
      let nx = ux[i] + (turnX * 0.5 - ux[i]) * 0.04;
      let ny = uy[i] + (1 + turnY * 0.5 - uy[i]) * 0.04;
      let nz = uz[i] + (turnZ * 0.5 - uz[i]) * 0.04;
      const k = nx * ax + ny * ay + nz * az;
      nx -= ax * k; ny -= ay * k; nz -= az * k;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl > 1e-6) {
        ux[i] = nx / nl; uy[i] = ny / nl; uz[i] = nz / nl;
      }

      const dv = cAccel[c] * DT;
      let s = speed[i];
      const want = wantSpeed[i];
      s = want > s ? (want - s > dv ? s + dv : want) : s - want > dv ? s - dv : want;
      speed[i] = s;
      px[i] += ax * s * DT;
      py[i] += ay * s * DT;
      pz[i] += az * s * DT;
    }
  }

  /** Each ship looks for the nearest enemy in sensor range once a second, staggered by index. */
  private scanTargets(): void {
    const { px, py, pz, team, alive, cls, target, cSensor2 } = this;
    const { gpx, gpy, gpz, gRadius, gTeam, gStart, gMembers } = this;
    const n = this.n;
    const phase = this.tick % TICK_HZ;
    for (let i = phase; i < n; i += TICK_HZ) {
      if (alive[i] === 0) continue;
      const r2 = cSensor2[cls[i]];
      const r = Math.sqrt(r2);
      let best = -1;
      let bestD = r2;
      for (let g = 0; g < this.groupCount; g++) {
        if (gTeam[g] === team[i]) continue;
        const ex = gpx[g] - px[i], ey = gpy[g] - py[i], ez = gpz[g] - pz[i];
        const reach = r + gRadius[g];
        if (ex * ex + ey * ey + ez * ez > reach * reach) continue;
        const end = gStart[g + 1];
        for (let m = gStart[g]; m < end; m++) {
          const j = gMembers[m];
          if (alive[j] === 0) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bestD) {
            bestD = d2;
            best = j;
          }
        }
      }
      target[i] = best;
    }
  }
}
