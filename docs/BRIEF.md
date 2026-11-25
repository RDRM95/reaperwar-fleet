Build me a new game from the ground up: a cinematic real-time space fleet-battle simulator set in the Mass Effect universe during the Reaper War, with my alternate-universe fleets. I already have one in the browser. Do not continue its code. Design this one properly, on the engine you judge best, and build it.

Save this brief word for word as docs/BRIEF.md in your first commit and re-read it at the start of every session.

AUTONOMY
- Work with maximum autonomy. Do not wait for me between steps or milestones.
- When something is mine to decide, pick the best default, record it in docs/DECISIONS.md, list it under "Waiting on me" in the checkpoint, and keep going.
- Stop only for a real blocker: missing access or credentials, an action that cannot be undone outside the new repository, or anything on my PC beyond the benchmark.
- If a session ends mid-milestone, the next one picks up from docs/CHECKPOINT.md without asking me.

REPOSITORIES
- New game: RDRM95/reaperwar-fleet (I have created it empty). Attach it with push access. If you cannot push, tell me the one step you need and keep working locally meanwhile.
- Old game, read only: RDRM95/reaperwarCodexBuild, branch codex/apex-combat-overhaul (TypeScript, Vite, three.js). It is my best build and the only old repository you use. Never push there.
- From the old game you may reuse ideas, the ship and weapon catalogue (src/data), the rule sets (src/timelines), the scenarios (src/scenarios), docs/apex/reference/APEX_Fleet_Reference.md, and my original models (src/rendering/ships) as a starting point.
- Read first, in docs/apex/: CHECKPOINT.md (newest on top), COMBAT_AUDIT_2026-11-09.md, COMBAT_OVERHAUL_2026-11-12.md, REAPER_CAPITAL_BARRIER_2026-11-13.md, CAPITAL_ROUNDS_2026-11-15.md, SIM_WORKER_DESIGN_2026-11-11.md. WORK_BREAKDOWN.md is long: skim it.

WHAT WENT WRONG LAST TIME: DESIGN SO NONE OF IT CAN HAPPEN AGAIN
1. Several copies of the game and several agents at once: days lost porting fixes between them, and half-finished branches abandoned. One repository, one game, one source of truth.
2. My RTX 5090 never measured a single frame. Every visual and performance claim rested on software rendering.
3. The mouse never reached the battle from the first commit until PR #92, because the interface layer swallowed pointer events, and no test used real input.
4. The simulation ran on the drawing thread and was moved to a worker late, as a retrofit.
5. Fleet combat was fixed by accretion over eight passes: ships chased instead of fought, main guns sat silent while broadsides fired, fire was spread too thin, magazine Reaper-killers emptied into destroyers, an AU refit silently replaced my AU guns, and armour was charged against a beam every tick so beams lost most of their damage.
6. Fleets deployed so close and battles were so short (100 to 170 s) that flanking and manoeuvre had no room to show, and with nothing blocking lines of fire a screen was only a picture.
7. Cameras that eased their own position towards a moving ship juddered at uneven frame rates.
8. Box-shaped placeholder hulls lingered until I asked for each one to be rebuilt.
9. The "short" checkpoint grew to 62 KB, and open questions to me piled up with nothing moving until I answered.

ENGINE: DECIDE FIRST, PROVE IT, TELL ME WHY
Compare the realistic options (for example WebGPU in the browser, Bevy, Godot, Unreal, a custom renderer) against these facts and pick one:
- I play on Windows with an RTX 5090. I want thousands of ships at a high frame rate and footage good enough for YouTube. Targets, unless you show they are unrealistic: 2,000 ships at 120 fps and 5,000 at 60 fps, at 4K on Ultra.
- You work in a cloud container with no graphics card. You must be able to build, test and see what you make there. Before you commit to an engine, prove your verification path works in the container (for example headless Chromium with software WebGPU, or Mesa's software Vulkan) and say what it can and cannot show.
- I must be able to run it with almost no setup: a link, or one download.
- Keep the simulation in its own engine-free module with its own tests, so the renderer could be replaced later without touching combat.
Write a short note, docs/ENGINE.md: what you chose, what it costs, what you tested, and which claims rest on software rendering and which on nothing at all. Never claim something looks right because it compiles. Then carry on; do not wait for my reply.

LORE AND DESIGN
- Research before you build. Use the web for Mass Effect lore (in-game codex entries, wiki pages, developer statements) and cite every source. Canon wins over memory. Where canon is silent, infer or invent and label it so.
- docs/lore/LORE_BIBLE.md: factions and their doctrine, ship classes and roles, weapons and how they behave (mass accelerators, GARDIAN point defence, Thanix cannons, Javelin torpedoes, kinetic barriers, armour, Reaper beams), the fleet battles of the Reaper War, and my AU rules. Short scannable entries, bolded key terms, each claim tagged canon, inferred or invented with its source.
- docs/design/DESIGN_BIBLE.md: an original design language for each faction: shape vocabulary, proportions, materials, colour palette, running lights and engine glow, weapon-effect colours, and how it reads at long range and up close. Written so that any hull built from it feels at home in the setting.
- One reference sheet per hull in docs/design/sheets/: role, canon size and armament with sources, silhouette goals, palette, level-of-detail plan, and renders of my build from six orthographic views, a three-quarter view, and beside a standard ship for scale.
- Every hull, effect and texture is original work made by you in the visual language of its setting. No game assets, screenshots, copied geometry or reference imagery in the repository. My private reference pack stays on my side.

THE GAME
Battles
- Real-time fleet battles in true 3D, from single duels to 5,000+ ships.
- Fleets deploy, screen, hold a line and engage as fleets: battlegroups with roles (a screen that leads, a gun line that stands off, a group that swings wide), deployment distances and battle spaces large enough for manoeuvre to matter, and line-of-fire blocking so a screen actually protects what is behind it.
- No long stretches of ships chasing instead of fighting (see the measures below).
Simulation
- Deterministic, fixed time step, separate from drawing and off the drawing thread from the first commit; the renderer interpolates between ticks. The same seed and build replays identically on any machine and runs headless for balance batches. Show the seed on screen and in every report so I can quote it to you.
Factions
- Systems Alliance, Turian, Asari, Salarian, Quarian, Geth, Cerberus, Reapers (Sovereign-class capitals, destroyers, Oculus fighters, Harbinger).
- Ships at canon size and scale relative to each other. One catalogue table gives every figure with its source, tagged canon, inferred or invented. Declare any compression of range or time once and apply it to every weapon alike.
Rule sets
- Canon Mass Effect 3.
- Annihilation: Reaper capital beams destroy ordinary ships on contact.
- My AU, Prime/Apex: a prepared galaxy wins conventionally with HADES rounds (nuclear-armed penetrator mass rounds) and hyper-mass accelerators. A refit never replaces a gun designed for the AU.
My AU ships
- The Normandy Valkyrie with its NOVA Array: a 200-gigaton spinal gun, eight rounds, one destroys a Sovereign.
- Omaha super-dreadnoughts. Aegis command dreadnoughts.
- New: hyper-dreadnoughts, beyond super-dreadnoughts and as large as or larger than Reapers, with teraton-yield kinetic spinal guns and massive railguns: capital one-shot, barrier-depleting, armour-destroying, with area of effect, the nuclear equivalent among mass rounds, and a colour of their own from the speed of the round.
- Add other vessels that fit, marked as your inventions.
Combat rules
- Damage comes from physical quantities (mass, velocity, yield, beam power). Barriers and armour are pools and thresholds with declared values. No arbitrary damage multipliers and no forced outcomes.
- Armour meets the same energy the same way whether it arrives by beam or by round.
- Reapers stay lethal. A catastrophic Reaper victory is fine if the mechanics are honest.
- Specialised Reaper-killers keep their limited rounds for capital ships while any are on the field, unless I name a target.
Cameras
- Tactical; free flight by mouse; ship follow and fixed chase views; first-person gunnery and main-cannon views; fighter and Oculus cockpit views with their own optics; a cinematic camera that moves; an automatic director that chooses shots; theatre mode with the interface hidden.
- Every camera travels with what it frames and eases only its offset, so it stays steady at any frame rate.
Command
- Select by click and by dragging an area; order fleets to move and attack; target priorities; hold fire; salvo control.
Interface
- A distinct console for each faction, menus and results included; fast and uncluttered.
Maps
- Good-looking battle environments and a Sol system map.
Effects
- Weapon effects with weight and character for each kind of weapon and each faction.
Crossovers (optional, last)
- Halo and Warhammer 40,000 fleets as original stand-in hulls on a declared common scale.

MEASURES THAT MUST HOLD (automated, reported in the checkpoint)
- Determinism: identical per-tick state hashes across runs, and between the in-game simulation thread and the headless runner.
- Engagement: after first contact, the share of armed hull-time spent firing (aim for 70 % or more under canon rules), time to first shot, and distance flown while not firing. A behaviour change merges only with before-and-after numbers over several seeds.
- Reaper-killer rounds: share fired at capital ships while capital ships are present.
- Simulation cost per tick at 1,000, 2,000 and 5,000 ships, headless.
- Input: a test that drags, selects, gives orders and moves the camera with real pointer and key events.
- Drawn output: automated captures checked for blank frames, errors, faction colours and framing.

QUALITY CHECKS (at every milestone, by an independent reviewer subagent that has not seen the work; results in docs/qa/)
- Scale: every hull's rendered length matches its catalogue length, with pairs drawn side by side.
- Lore: every ship, weapon and rule checked against the lore bible; any untagged figure fails.
- Design: every hull checked against its faction's section of the design bible and its own reference sheet; it must read as its faction at long range and as its class up close.
- Visual: captures at fixed seeds and camera positions compared with the last accepted set; every change explained.
- Honesty: the report says which checks rest on software rendering and which need my eyes on the 5090.

HARDWARE LOOP
- From the first milestone, ship an in-game benchmark (in the menu and as a URL or command-line switch) that prints plain text I can paste back: GPU, resolution, settings, ship count, average fps, 1 % and 0.1 % lows, frame-time breakdown, simulation tick time, seed.
- If this session can reach my PC through the Claude desktop app (built-in browser or computer-use tools), use it to open the build on my RTX 5090, run the benchmark and take screenshots. Ask before doing anything else on my machine. If it cannot, say so once and rely on me.

ORDER OF WORK
- M0, scale probe: repository, CI, deployment (a link and/or one download), the benchmark, and a scene of 5,000 moving instanced ships. Tell me as soon as the link works so I can run it on my card before you build on the engine; carry on with M1 meanwhile.
- M1, first playable slice: lore bible, design bible and reference sheets for the Systems Alliance and the Reapers first; then Systems Alliance against Reapers, canon ME3 rules, one Earth-orbit battle space; frigate, cruiser, dreadnought, carrier with fighters; Reaper destroyer, Sovereign-class, Oculus; tactical, follow, free and theatre cameras; click and drag selection, move, attack, hold fire; effects for each kind of weapon; deterministic simulation off the drawing thread with a headless runner; every measure and quality check above live.
- After M1, your order, roughly: the other factions (lore, design bible and sheets before each faction's hulls) and the catalogue; Annihilation and Prime/Apex with my AU ships and the hyper-dreadnoughts; doctrine, screens, line-of-fire blocking, salvo control; the remaining cameras and the director; faction consoles, effects, maps and Sol; crossovers.

HOW TO WORK
- No personal information in the repository. No box-shaped placeholders after M1.
- Tests from the start: unit tests for the simulation and automated checks of what is drawn. Browser tests that wait on frames must allow for a CI runner three times slower than your machine.
- Small verified steps on branches with pull requests; merge your own when its checks pass.
- Use subagents freely: parallel ones for independent work on separate branches (a faction's lore and hulls, a camera), plus the independent reviewer above.
- docs/CHECKPOINT.md stays under 150 lines: current state; what was measured; "Waiting on me", each item with the default you are already using. Move older entries to docs/history/. Record decisions one line each in docs/DECISIONS.md.
- Report plainly what works, what does not, and what you could not check. Keep going until you hit a real blocker. You have my permission to be creative within this scope.

Start now: clone the old game, read its checkpoint and the notes above, write docs/ENGINE.md, then build M0 and M1.
