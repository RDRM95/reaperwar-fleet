/**
 * The numbers the simulation runs on. These are plain figures in game units
 * (metres, seconds, joules); the catalogue package derives them from sourced
 * canon-unit figures. The simulation never sees a source or a faction name.
 */

export const enum WeaponKind {
  /** Mass round: arrives after a flight time, stopped by barriers. */
  Slug = 0,
  /** Stream of molten metal: delivered over a burst, part of it heat. */
  Stream = 1,
  /** Laser: continuous, barriers do not stop it. */
  Laser = 2,
  /** Guided torpedo: slow, ignores barriers, can be shot down. */
  Torpedo = 3,
}

export interface WeaponSpec {
  id: string;
  kind: WeaponKind;
  /** Energy of one impact, joules: one slug, one whole burst, one warhead, or one second of one laser. */
  impactJ: number;
  /** Impacts per firing: guns in the battery, torpedoes in the salvo, lasers bearing. */
  count: number;
  /** Share of the impact that is heat and cannot be stopped by a barrier, 0..1. */
  thermalShare: number;
  /** Ticks from one firing to the next. */
  cycleTicks: number;
  /** Ticks a stream burst lasts (0 for other kinds). */
  burstTicks: number;
  /** Chance to hit inside effective range, 0..1. */
  accuracy: number;
  /** Round speed in the battle space, m/s (ignored for streams and lasers). */
  speed: number;
  /** Rounds carried; 0 means unlimited. */
  magazine: number;
  /** Fire only at capital ships while any enemy capital is on the field. */
  reserveForCapitals: boolean;
  /** Point defence: keeps firing under hold-fire and does not count as fighting for the engagement measure. */
  pointDefence: boolean;
  /** Energy removed from the target's barrier pool on a hit that ignores barriers (torpedoes), joules. */
  barrierDrainJ: number;
  /** Effective range against each ship class, metres (0 = will not engage that class). */
  range: number[];
}

export interface MountSpec {
  weapon: number;
  /** Unit axis of the mount's arc in hull axes (x port, y up, z bow). */
  axis: [number, number, number];
  /** Cosine of the arc's half-angle; -1 = all round. */
  cosArc: number;
  /** The main gun: aims at the ship's chosen target and the ship turns to bear. */
  main: boolean;
}

export const enum Role {
  /** Flies a fixed loop; used by the scale probe. */
  Patrol = 0,
  Screen = 1,
  Line = 2,
  Flank = 3,
  Carrier = 4,
  /** Small craft making attack runs. */
  Strike = 5,
}

export interface ShipClass {
  id: string;
  lengthM: number;
  /** Radius used for spacing, metres. */
  radius: number;
  /** Half the hull's beam: the hull blocks lines of fire as a capsule of this radius along its length. */
  halfWidth: number;
  /** Top battle speed, m/s. */
  maxSpeed: number;
  /** Acceleration along the bow, m/s^2 (less in other directions). */
  accel: number;
  /** Turn rate, rad/s. */
  turnRate: number;
  sensorRange: number;
  /** Counts as a capital ship for reserved rounds and reports. */
  capital: boolean;
  /** Fighter-sized: flies where it points and is a point-defence target. */
  small: boolean;
  barrierJ: number;
  barrierLimitJ: number;
  barrierRegenW: number;
  armourJ: number;
  armourLimitJ: number;
  hullJ: number;
  /** Torpedoes per second this ship's point defence can stop near itself. */
  pdRate: number;
  mounts: MountSpec[];
  /** How much this class wants to fight each other class: 1 = built for it, larger = less keen, 0 = never. */
  preference: number[];
}

export const MAX_MOUNTS = 6;
