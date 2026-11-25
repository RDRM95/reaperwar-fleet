# Combat model

Written before the combat code. The simulation implements exactly this; when a rule
changes, this file changes in the same pull request. Values live in the catalogue
(`packages/catalog`), each tagged canon, inferred or invented with its source; this file
gives the rules. Lore sources are in docs/lore/LORE_BIBLE.md.

## 1. Quantities

- Energy in joules. 1 kt = 4.184e12 J. A mass round carries ½·m·v²; a stream weapon
  (Thanix, Reaper main gun) carries a stated energy per burst; a laser carries power × time;
  a warhead carries its yield.
- Every delivery of energy to a ship is a **packet**: total energy E, a **kind**, and
  **the size of one impact** (the whole burst for a stream, one slug for a round, even
  when a battery fires many slugs together).
- There are no damage multipliers. A rule set (canon, Annihilation, Prime/Apex) may only
  change declared catalogue values or add or remove equipment.

## 2. The three layers

Each ship has three pools, in joules, met in this order:

| Layer | Pool | Per-impact limit | Refills |
|---|---|---|---|
| **Kinetic barrier** | energy it can stop before collapsing | most energy it can stop from one impact | yes, at a declared rate in watts |
| **Armour** | energy the ablative belt can soak (belt mass × 1e7 J/kg) | most energy the plate can soak from one impact before it is holed | no |
| **Hull** | energy that wrecks the ship (mass × 1e5 J/kg) | none | no |

For a packet whose single impact has energy *e*:

1. **Barrier.** Barriers stop moving mass only. The kinetic part of the impact is
   *e·(1 − thermal share)*; a slug's thermal share is 0, a stream's is declared (molten metal
   carries heat a barrier cannot stop), a laser's is 1. The barrier stops
   *min(kinetic part, barrier limit)* while its pool lasts, and that much is taken from the pool.
   Disruptor torpedoes ignore barriers and drain the pool by a declared amount.
2. **Armour.** What passes meets the armour, which soaks *min(passed, armour limit)* while
   its pool lasts.
3. **Hull.** The rest is taken from the hull. At zero the ship is destroyed.

**Independent of the time step.** The shares in steps 1 and 2 depend only on the size of
one whole impact and the target's limits, so they are fixed numbers for a given weapon and
target. A beam delivered over forty ticks is charged *share × slice* each tick and ends
with exactly the result of the same energy arriving at once. Armour is never charged per
tick. (This is the fault the old game never fixed.)

**Same energy, same treatment.** Armour sees only joules that got past the barrier.
Whether they came by beam or by round makes no difference to steps 2 and 3.

## 3. Hitting

- A target can dodge by accelerating sideways while the round is in flight. A weapon's
  **effective range against a target** is where the target could just step out of its own
  width: *R = v · √(2·w / a)* with v the round's speed, w the target's half-width and a its
  combat acceleration, capped by the fire-control horizon. This is physics, per weapon and
  per target class: a dreadnought gun reaches a dreadnought at about 12,000 km and a
  frigate at about 2,200 km.
- Inside effective range the chance to hit is the weapon's base accuracy. Beyond it the
  chance falls as *(R / d)⁴* (the area the target can reach grows with the fourth power of
  flight time). Ships open fire at up to 1.15 × R.
- Single guns roll for each shot with the seeded generator. A battery of many small guns
  lands the expected number of slugs.
- **Line of fire.** A shot is traced from muzzle to target against the hull spheres of every
  other ship. A friendly hull in the way means the gun holds fire and the ship looks for a
  clear line. An enemy hull in the way takes the hit instead. A screen therefore protects
  what is behind it.

## 4. The one compression

Canon engagement ranges run to tens of thousands of kilometres against hulls under two
kilometres long. Hulls are drawn at true size, and distances at or under 10 km (knife-fight
range, point defence, torpedo runs) are **not compressed**. Beyond that, one curve is
applied to every range alike:

> game distance = 10 km × (canon distance ÷ 10 km)^0.4

So 1,000 km plays as 63 km, 12,000 km as 170 km and 30,000 km as 246 km. A round's speed
is scaled by the same ratio at its reference range, so its **time of flight is unchanged**.
**Time is never compressed.** Ship speeds are not canon figures at all: they are invented
"battle speeds" chosen so that crossing the battle space takes minutes, ordered as the
Codex orders agility (fighters, frigates, cruisers, dreadnoughts; Reapers faster than
their peers).

## 5. Fire control

- A ship has **mounts**: a spinal main gun with a narrow forward arc, and batteries
  (broadsides, point defence, secondary beams) with their own arcs. **Every mount picks its
  own target** from what is inside its arc and range. The main gun follows the ship's chosen
  target; batteries engage whatever they bear on. No battery waits on another.
- **Choosing a target.** Prefer enemies already inside effective range, of the classes the
  ship is built to fight, close to the bow line, and belonging to the enemy group its own
  battlegroup is engaging. A ship keeps its target until it dies, leaves range or is masked.
- **Focus.** Each target tracks the fire already assigned to it. Once that fire would
  destroy it within 10 s, further ships count it as taken and pick another, unless it is
  the only target.
- **Reserved rounds.** A mount with a magazine and the `reserve for capitals` flag fires
  only at capital ships while any enemy capital is on the field. A target named by the
  player overrides this.
- **Hold fire** stops every mount of the ship except point defence.

## 6. Manoeuvre

- Ships have a velocity and a facing that are independent: a ship can hold station and
  turn its bow, or slide sideways under thrusters at reduced acceleration.
- A **battlegroup** has an anchor, a formation of slots and a role:
  - **Screen** leads, engages the enemy's screen and small craft, and stands between the
    enemy and its own line.
  - **Gun line** closes to 0.8 of its main gun's effective range against the enemy line and
    holds there, bows on.
  - **Flank** swings wide around the enemy before turning in.
  - **Carrier** stays behind the line and launches **strike** squadrons.
- Ships keep their slots by position and turn their bows to their targets, so a ship in
  range fights rather than chases. Closing is done by the group, at its role's standoff.
- Player orders (move, attack, hold fire) replace the group's choice for the selected ships.

## 7. Measures

- **Engagement share:** after first contact, the share of armed hull-ticks in which the hull
  has an anti-ship mount in its firing cycle. Target 70 % or more under canon rules.
- **Time to first shot**, and **distance flown while not firing** per hull.
- **Reserved rounds:** share fired at capital ships while capitals are present.
- **Canon anchors**, checked by tests: two dreadnoughts cannot drain a Sovereign-class
  barrier, three drain it slowly, four quickly; a direct main-gun hit from a Reaper capital
  destroys a dreadnought; one cruiser can strip and kill a destroyer.
