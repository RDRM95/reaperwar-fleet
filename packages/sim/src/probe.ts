/**
 * The M0 scale-probe scenario: two fleets of battlegroups flying crossing
 * circuits. It exists to measure simulation and drawing cost at a given ship
 * count. The class figures here are placeholders for the probe only; the real
 * catalogue with sourced figures replaces them in M1.
 */
import { Rng } from './rng';
import { dcos, dsin, TAU } from './dmath';
import type { GroupSpawn, ShipClass, WorldConfig } from './world';

export const PROBE_CLASSES: ShipClass[] = [
  { id: 'probe_frigate', lengthM: 170, radius: 110, maxSpeed: 900, accel: 60, turnRate: 0.5, sensorRange: 60000 },
  { id: 'probe_cruiser', lengthM: 707, radius: 420, maxSpeed: 600, accel: 30, turnRate: 0.25, sensorRange: 90000 },
];

export function probeScenario(shipCount: number, seed: number): WorldConfig {
  const rng = new Rng(seed ^ 0x5eed);
  const groups: GroupSpawn[] = [];
  const perGroup = 50;
  const groupTotal = Math.max(2, Math.ceil(shipCount / perGroup));
  let left = shipCount;
  for (let g = 0; g < groupTotal; g++) {
    const team = g % 2;
    const count = Math.min(perGroup, left - (groupTotal - g - 1));
    left -= count;
    const ring = Math.floor(g / 2);
    // Each fleet starts on its own side and flies a loop through the middle.
    const side = team === 0 ? -1 : 1;
    const lane = (ring % 10) - 4.5;
    const layer = Math.floor(ring / 10) - 2;
    const pos: [number, number, number] = [lane * 26000 + rng.range(-3000, 3000), layer * 14000 + rng.range(-2000, 2000), side * 160000];
    const a = rng.range(0, TAU);
    const loop: [number, number, number][] = [
      [pos[0] * 0.6, pos[1], -side * 60000],
      [pos[0] + dcos(a) * 60000, pos[1] + 20000 * dsin(a), -side * 170000],
      [-pos[0], -pos[1], -side * 40000],
      [pos[0], pos[1], side * 170000],
    ];
    const ships: GroupSpawn['ships'] = [];
    // A wedge of cruisers with frigates on the wings: 1 cruiser to 4 frigates.
    const cols = 10;
    for (let s = 0; s < count; s++) {
      const cruiser = s % 5 === 0;
      const col = s % cols;
      const row = Math.floor(s / cols);
      const x = (col - (cols - 1) / 2) * 2200;
      const y = ((row % 2) - 0.5) * 1400 + (cruiser ? 0 : 500);
      const z = -row * 2600 - Math.abs(col - (cols - 1) / 2) * 700;
      ships.push({ cls: cruiser ? 1 : 0, slot: [x, y, z] });
    }
    groups.push({ team, pos, fwd: [0, 0, -side], waypoints: loop, ships });
  }
  return { seed, classes: PROBE_CLASSES, groups };
}
