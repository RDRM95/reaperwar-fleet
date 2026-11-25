# Design bible

An original design language for each faction, written so that any hull built from it
feels at home in the setting. Everything here is this project's own interpretation: no
game geometry, textures or images are used or stored. Tags: **[canon]** = stated in the
games' Codex (see docs/lore/LORE_BIBLE.md for sources), **[house]** = this project's choice.

## Rules for every hull

- **Built in code** with `packages/hulls/src/kit.ts`. Axes: +Z bow, +Y up, +X port. Metres, true size.
  Length along Z must equal the catalogue length, centred on the origin (unit-tested).
- **No boxes.** A hull is a lofted body with at least three distinct section shapes along its
  length, plus the appendages its faction calls for. The shape test fails a hull that fills
  more than 45 % of its bounding box.
- **Two builds:** detail 0 (full) and detail 1 (same silhouette, no small parts, fewer sides).
- **Materials by vertex colour only.** `kind 0` painted plate, `kind 1` bare dark metal,
  `kind 2` light source. Self-lit parts use `glow` (engines 1.0, windows about 0.5).
  The shader adds plating seams; hulls do not model individual plates.
- **Scale cues:** window rows 3 m tall per deck, turrets and hatches sized in metres, so a
  frigate and a dreadnought never look like the same model at different zoom.
- **Reads at three ranges:** as a coloured glint (faction colour), as a silhouette (faction
  shape), and close up (class details). Each sheet states the silhouette goal.
- **Budget:** fighters up to 400 triangles, frigates 1,500, cruisers 4,000, dreadnoughts and
  carriers 8,000, Reaper capitals 16,000. Detail 1 at most 40 % of detail 0.

## Systems Alliance

**Idea:** a young navy's ships: clean, purposeful, built around one very long gun. [house]

- **Shape vocabulary:** a slim spear or arrowhead pressure hull with chamfered octagonal
  sections; a long neck forward of the mass centre; **swept wing pylons carrying outboard
  engine nacelles**; a single dorsal fin aft; the main gun as an underslung or through-hull
  spine that ends flush at the bow. Straight lines and flat facets; the only round forms
  are nacelles and gun barrels.
- **Proportions:** hull alone about 8:1 length to beam; with wings 3.5:1 to 5:1. The main
  gun runs about 90 % of the length **[canon]**; broadside guns about 40 % of the beam
  **[canon]**. Bigger classes get thicker and gain outrigger hulls, not longer noses.
- **Class signatures:**
  - *Fighter (about 15 m):* twin-boom dart, forward-swept wings, one engine.
  - *Frigate (about 170 m):* arrowhead, two wing nacelles, tall thin fin. Fast and narrow.
  - *Cruiser (about 520 m):* spear hull with an armoured prow collar, two outrigger hulls on
    paired pylons, stepped bridge tower, visible broadside turret row.
  - *Dreadnought (888 m):* a slab-sided keel built round the gun, with a forked prow that
    frames the muzzle, four outriggers, three broadside decks **[canon: three decks]**.
  - *Carrier (about 900 m):* dreadnought-length but flat and wide: a through-deck hangar open
    at bow and stern, island tower offset to starboard, no forked prow, few guns.
- **Materials and colour (linear albedo):** armour plate grey-white 0.50 to 0.62; belly and
  recesses graphite (0.10, 0.12, 0.16); trim (0.20, 0.23, 0.29); **identity stripe Alliance
  blue (0.07, 0.20, 0.55)** on the flanks and the fin.
- **Lights:** warm-white window rows (1.0, 0.86, 0.60); blue navigation lights at wing tips;
  **engines blue-white (0.35, 0.65, 1.0)**, steady, brighter with throttle.
- **Weapon effects:** mass accelerator rounds as short blue-white streaks with a brief
  muzzle flash and a ring of light at the bow of big guns; broadsides in rippling rows.
  GARDIAN lasers are infrared and invisible **[canon]**; they are drawn as faint, very short
  violet flickers so point defence can be read **[house]**. Disruptor torpedoes: slow
  blue-violet orbs with a wavering halo. Thanix: a short, searing gold-white stream with a
  blue sheath. Barrier hits: a pale blue ripple at the impact point.
- **At long range:** blue-white glints in tidy geometric formations.

## Reapers

**Idea:** ancient machines that look grown rather than built: one sweeping carapace, limbs
that suggest a living thing, and no visible way in. [house, from canon descriptions]

- **Shape vocabulary:** a **long tapering mantle** (thickest a third of the way back, ending in
  a blunt tail), a hooded head, and **limbs gathered at the head**: large arms that reach
  forward and curl inward like a hand closing, with smaller legs beneath. Every surface is
  curved and smooth-shaded; plates overlap like segmented armour. No windows, no hard
  right angles, no visible engines.
- **Proportions:** Sovereign-class capital **2 km [canon]**, mantle about 4:1; arms about
  45 % of total length. Destroyer **160 m [canon]**: a short upright body, four legs and
  small forward arms, one great "eye" firing chamber in the chest. Each capital is given
  its own arm stance (a seeded variation) so no two look copied.
- **Class signatures:**
  - *Oculus (about 16 m):* a lidded sphere with a single red eye and three curved blades
    around it; reads as a dot with a red point.
  - *Destroyer:* legs splayed, eye forward; the eye glows before it fires.
  - *Sovereign-class:* five great arms forward, mantle behind, firing chambers at the arm tips
    and one in the head.
  - *Harbinger:* a larger capital with extra eyes (yellow-orange) and heavier arms.
- **Materials and colour:** carapace near-black gunmetal with a violet-blue sheen
  (0.045, 0.045, 0.06), higher gloss than any organic navy; plate edges slightly paler.
  **Inner light is red-orange (1.0, 0.16, 0.06)** in seams at the joints and in the eyes.
- **Lights:** no navigation lights. Seams pulse slowly. Barrier hits show as a dull red
  shimmer. A dying Reaper's seams flare white-orange and go dark.
- **Weapon effects:** the main gun is a **stream of molten metal** **[canon]**: a thick
  red beam with a yellow-white core, slightly unsteady, with a charging glow before and
  glowing spatter at the impact. Destroyer beams are thinner and shorter. Oculus shots are
  thin red needles.
- **At long range:** dark shapes that hide stars, red glints, and long red beams.

## Level-of-detail plan (all factions)

| Size on screen | Drawn as |
|---|---|
| under 2 to 5 px (by quality) | faction-coloured glint only |
| up to about 40 to 140 px | detail 1 hull, engine flares |
| larger | detail 0 hull, engine flares, window lights |

## Reference sheets

One image per hull in `docs/design/sheets/`, rendered by `npm run sheets` from the built
mesh: six orthographic views, a three-quarter view, and the hull beside the standard
Alliance cruiser (520 m) for scale. They are software-rendered; colour and exposure on real
hardware should match, fine shading may differ.
