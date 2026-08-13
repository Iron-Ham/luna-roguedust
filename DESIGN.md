# Super Roguedust Design Contract

## North star

**SUPER ROGUEDUST** is a single-player desktop browser roguelite about a salvage pilot flying through a shattered planetary ring. The hangar is the persistent home; each launch is a short, intense expedition through five sectors. The fantasy is high-energy, mysterious, and confident: **DIE LOUD. FLY FURTHER.**

Audience: desktop arcade/roguelite players who want readable combat, expressive runs, and meaningful permanent progress. The visual direction is dark maximalist neon particle spectacle with crisp combat readability, never retro-vector minimalism.

## Research synthesis

- Supergiant Games' [Hades FAQ](https://www.supergiantgames.com/blog/hades-faq/) describes permanent progression and difficulty modifiers that open roguelike challenge to more players; each run combines different challenges and discoveries.
- [Game Developer's analysis of Hades' death cycle](https://www.gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death) argues that death should not feel like rage-quitting: reactive post-run rewards and a return hub make restarting meaningful.
- Motion Twin's [Dead Cells press kit](https://motiontwin.com/presskit/81) frames the loop as kill, die, learn, repeat, with permanent abilities and alternate routes. Unlocks should change strategy, not only inflate stats.
- [Risk of Rain Returns analysis](https://www.gamedeveloper.com/design/risk-of-rain-interview) emphasizes the decision to keep exploring while difficulty rises, the possibility of skillful play with a weak build, and later complexity without diluting the starter pool.
- [Lyons' peer-reviewed challenge/reward review](https://pmc.ncbi.nlm.nih.gov/articles/PMC4580142/) reports that failure and retrial are necessary and that challenge arcs with recovery moments can improve immersion.
- [Slay the Spire metrics research](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics) and Hades support an optional, player-authored late-game difficulty ladder.
- MDN documents fixed-timestamp [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), canvas layering/optimization, one reusable gesture-resumed [`AudioContext`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext), synchronous origin-scoped [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), and [Vite production builds](https://vite.dev/guide/build).
- [Housemarque's Super Stardust overview](https://housemarque.com/games/sshd) and [contemporary arcade overview](https://www.thesixthaxis.com/2007/07/04/super-stardust-hd/) reinforce named planets, differentiated weapon roles, finite phases, and a boss at each planet. Super Roguedust keeps named sectors and boss gates while randomizing encounters within them.
- [Dead Cells' hybrid level design](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/) recommends fixed biome identity and authored dramatic peaks with procedural assembly inside those constraints.
- [Hopoo's Development Thoughts #16](https://store.steampowered.com/news/app/632360/view/2740955655376700577) frames agency as player influence at micro and macro scales. The run exposes a visible heat/pressure meter and optional lucrative routes while preserving a readable baseline.
- [ARPG telegraphing guidance](https://www.gamedeveloper.com/game-platforms/designing-for-difficulty-readability-in-arpgs) emphasizes shape, color, audio, warning windows, safe gaps, and phase remixing. Bosses are knowledge checks, not untelegraphed health walls.

## Run contract

- A normal campaign is five named globe levels. Each level is three authored surface nodes followed by its boss; each node has a fixed dramatic role while enemy composition and salvage placement stay seeded. After the fifth boss, `ENDLESS` repeats the globe sequence with a score multiplier and rising pressure.
- The starter **VANGUARD** is complete and viable from a fresh save: movement, primary fire, dash, ability, and a boss strategy are available with no meta purchases.
- Death resets temporary build state but never erases earned Dust, discoveries, boss records, ship blueprints, or challenge marks.
- Every run awards run-end Dust even on immediate death. The hangar explains what survived and offers **LAUNCH AGAIN**.
- Power hierarchy: permanent meta progression first, ship identity second, temporary in-run boons third. Boons are expressive, never mandatory for the first boss.

## Controls and accessibility

- Keyboard/mouse: `WASD` movement across the globe surface, mouse aim, hold left mouse primary fire, `Q`/`R` or wheel weapon swap, `E` or right mouse ability, `F`/`B` bomb, `Space` or `Shift` dash, `Esc` pause. Arrow keys are movement aliases.
- Gamepad API: left stick move, right stick aim, right trigger fire, left trigger ability, `A` dash, `RB/LB` weapon swap, `Y` bomb, Start pause. Keyboard/mouse remains guaranteed.
- Bullets travel along the visible globe surface, not through screen space. Every projectile has a finite angular range, element, and deterministic surface path.
- The game surface suppresses context menus while a run is active. First `LAUNCH` click resumes/creates AudioContext; denial degrades to silent play and a visible settings state.
- All actions have labeled buttons in DOM menus, focus-visible styling, readable contrast, `aria-live` status, and non-color telegraphs. `prefers-reduced-motion` defaults reduced motion but the setting is reversible.

## Arena and authored levels

The simulation uses a bounded 1600x900 logical globe projection. The player is always centered while longitude and latitude advance on the sphere; depth controls occlusion, alpha, and scale cues. Latitude is clamped before it reaches a pole singularity, and longitude wraps continuously.

- `SWEEP`: paced surface combat.
- `SALVAGE`: safe choice between `PATCH` (+24 hull up to max), `CACHE` (+60 run Dust), and `CHARGE` (+35 ability energy).
- `ELITE`: dense globe combat with an elite target, then two boon choices.
- `RIFT`: hazardous high-Dust surface wave with a guaranteed boon choice.
- `MARKET`: buy one temporary boon for run Dust or leave.

The node sequence is authored per sector rather than selected from route roulette. Three completed nodes open that sector's boss gate. Chests appear on the globe after combat nodes and must be damaged to release a bomb, shield, life, or weapon-cache reward. Cargo signals drift into combat and expire if ignored.

## Combat and temporary build
- Fixed-step simulation is 60 Hz. Player starts with 100 hull, 0.8-second dash cooldown, 0.25-second dash invulnerability, and 0.75-second post-hit grace. Meta and ship modifiers apply at run start.
- Vanguard starts on `PULSE`/kinetic. `SCATTER`/plasma, `RAIL`/cryo, and `NOVA`/void are hot-swappable with `Q`/`R` or the mouse wheel. Enemy and asteroid weaknesses are explicit and produce a visible element-hit multiplier.
- `E` emits a short radial repulsor burst with a six-second base cooldown. `F`/`B` spends a bomb to clear hostile projectiles and damage surface threats. Dash is movement plus invulnerability, not damage unless a boon adds a trail.

| Boon | Effect |
| --- | --- |
| `OVERCLOCK` | +18% fire cadence, -10% projectile damage |
| `ECHO CHAMBER` | 20% fired projectile repeat after 0.08s |
| `MAGNETAR` | pickups pull from 160 px; Dust payouts +15% |
| `AFTERIMAGE` | dash leaves a 0.7s damage trail |
| `PRISM ROUNDS` | projectile hits split into two weaker angled shards |
| `DRONE PACT` | orbiting drone fires every 1.3s |
| `RIFT STEP` | dash +35% farther and blinks through enemies; cooldown +12% |
| `NULL SHELL` | ability kills restore 0.5s dash cooldown; ability damage -12% |

Starting runs offer `OVERCLOCK`, `ECHO CHAMBER`, and `MAGNETAR`. Availability follows the discovery schedule. Every boon has a visible description, actual simulation effect, and archive entry.
## Economy, score, and meta

The sole banked currency is **Dust**. Enemies award 1–4, authored node clears 20–140, chests 75, bosses 180–450 by sector. Score rises from kills, node objects, chests, bombs, and bosses; consecutive kills raise a visible multiplier that decays after a short break. Crossing profile milestones at 1,000 / 2,500 / 5,000 / 10,000 / 20,000 score awards persistent Dust once per milestone. Dust banks at run end and after every meta purchase, never per frame.

| Meta branch | Costs | Effect per level |
| --- | --- | --- |
| `HULL MATRIX` | 75 / 175 / 350 | +10 max hull |
| `VECTOR COILS` | 100 / 225 / 500 | +6% move speed |
| `CAPACITOR BANK` | 125 / 300 / 650 | +8% fire cadence |
| `SALVAGE LENS` | 150 / 400 | +12% run-end Dust |
| `PHASE LATTICE` | 200 / 550 | dash cooldown -8%, invulnerability +0.05s |
| `RESONANCE CORE` | 250 / 700 | ability cooldown -10%, ability damage +8% |

Meta screens show current value, next value, cost, and concrete preview. Purchases are atomic and immediately persisted; insufficient or maxed nodes are visibly disabled. Repeated clicks cannot double-spend.

## Ships

| Ship | Unlock | Identity |
| --- | --- | --- |
| `VANGUARD` | default | 100 hull, 100% speed, balanced pulse cannon and repulsor |
| `BULWARK` | 700 Dust + one `GRINDER` | 150 hull, 78% speed, wide arc cannon, 2.5s frontal shield, 7s ability |
| `NEEDLE` | 900 Dust + 100 kills | 72 hull, 132% speed, twin shard fan, dash -20%, 1.2s afterburner |
| `MIRAGE` | 1,400 Dust + one `RAIL WARDEN` | 88 hull, 110% speed, precision beam, 2.5s decoy + 0.45s phase |
| `NOVA` | 2,500 Dust + one `NULL CROWN` | 110 hull, 92% speed, charge singularity shot, 1.8s gravity well, longest cooldown |

Each shipyard entry shows real gameplay preview, strengths, cost, and weaknesses. No ship is a universal upgrade.

## Content and discovery

| Sector | Boss | Roster / discovery |
| --- | --- | --- |
| 1 `RUST EXPANSE` | `GRINDER` | `SHARDLING`, `SWARMER`, `SEEKER`, `MINE` |
| 2 `ION GARDENS` | `RAIL WARDEN` | `LANCER`, `SPLITTER`, `PRISM`, `DRONE PACT`, `RIFT STEP`, `PRISM ROUNDS` |
| 3 `BLOOMING VOID` | `BLOOM MOTHER` | `HARVESTER`, `RIFTLING`, `SENTINEL`, `AFTERIMAGE`, `NULL SHELL` |
| 4 `GLASS TRENCH` | `PRISM LEVIATHAN` | `ECHO`, `BLACK MARKET` weighting |
| 5 `NULL CROWN` | `NULL CROWN` | `THREAT PROTOCOL`, final transmission chain |

Enemy counterplay is explicit: `LANCER` charges after a red-line telegraph, `SPLITTER` divides, `PRISM` reflects shots in a wedge, `HARVESTER` steals nearby Dust, `RIFTLING` blinks between marked points, `SENTINEL` rotates a shield aperture. Clean nodes record `CLEAN CIRCUIT` and unlock Echo Chamber; boss victory without Dash records `NO-BURN VICTORY` and unlocks Null Shell.

## Bosses

- **GRINDER**: rotating arm hit zones; radial fragments; edge mines at 66%; accelerating arms and center pulse ring at 33%; 180 Dust.
- **RAIL WARDEN**: four orbit pylons; 0.9s bright line then rail sweep; phase two crossing rails and seekers; pylons reduce frequency; 240 Dust.
- **BLOOM MOTHER**: central nest and three eggs; swarms; eggs expose core; acid pools and Splitters at half hull; 300 Dust.
- **PRISM LEVIATHAN**: segmented body; wedge lasers with safe gaps; mirror drones at 66%; rotated pattern and Sentinels at 33%; 360 Dust.
- **NULL CROWN**: gravity well and rings; copies last dash direction plus void lanes; core/four shards and overload windows; 450 Dust.

Boss health, thresholds, timings, and telegraphs are data-driven. Every dangerous pattern agrees across color, shape, animation cadence, and audio; no phase is an untelegraphed damage race.

## Threat Protocol

After the first Null Crown victory, toggles persist in settings and affect reward multipliers: `OVERCLOCKED` (+18% enemy speed, +10% payout), `CROWDED` (+20% spawns, +15%), `SHORT FUSE` (telegraphs -20%, +20%), `SCARCITY` (no Salvage healing, +20%), `FRACTURED` (extra boss phase pattern, +30%). Each is reversible and labeled; none applies to fresh saves or is required for first clear.

## Presentation, audio, and architecture

Near-black blue-violet space, acid chartreuse player systems, ember orange hostile warnings, hot coral damage, pale lilac/white neutral UI. The globe is a shaded sphere with latitude/longitude wireframe, depth occlusion, surface trails, crisp ship silhouettes, and restrained additive glow. No pure black/white or generic purple/cyan gradients. Canvas logical space is 1600x900 with DPR cap 1.5 and CSS aspect fitting. Menus and HUD are semantic DOM over the canvas. Local system font stacks only.

A single lazy procedural WebAudio context owns master/music/SFX/UI buses. Voices are bounded and envelopes scheduled: weapon-specific pitch sweeps, filtered impacts, pickup/cargo chimes, dash noise, phase stingers, and a low-voice arpeggiated music bed whose mode tracks sector/boss/endless. Settings include music, SFX, master volume, reduced motion, and visual quality (`HIGH`, `BALANCED`, `LOW`). Reduced motion removes shake, limits trails, and preserves telegraphs.

Source boundary:

- `src/main.ts`: composition root and lifecycle.
- `src/types.ts`: stable unions, save and render/event contracts.
- `src/math.ts`: allocation-light math and seeded RNG.
- `src/input.ts`: keyboard, pointer, gamepad, edge actions, snapshots.
- `src/content.ts`: data-only content definitions.
- `src/persistence.ts`: validated version-one JSON save boundary.
- `src/audio.ts`: lazy procedural audio.
- `src/simulation.ts`: fixed-step authoritative run state.
- `src/render.ts`: cached canvas layers, telegraphs, HUD markers, quality policy.
- `src/ui.ts`: semantic screens and intent dispatch.
- `src/styles.css`: local responsive styling and tokens.
- `index.html`: metadata and root mount only.

Simulation uses pooled bounded caps: 96 enemies, 480 projectiles, 42 asteroids, 1,800 particles, and 96 pickups. All spawn decisions and authored level variations use a seeded RNG. `Math.random` is forbidden in simulation content. Persistence writes only at run end, purchases, unlock milestones, score milestones, visibility changes, and pagehide. Hidden tabs pause simulation and suspend audio; resume resets timing and caps catch-up.

## Balance targets and QA checklist

- Fresh launch reaches a playable first wave without a purchase or boon.
- A 30–45 second failed run earns enough for Hull Matrix I (75 Dust) when the pilot collects salvage; immediate death still pays a recovery floor.
- The normal campaign is five globe levels and three authored nodes per level; first boss is readable with Vanguard and no meta upgrades.
- Score, multiplier, weapon swap, element weakness, cargo, chest reward, ship, enemy, boss phase, feat, meta level, and modifier all have observable gameplay effects and readable feedback.
- Production `vite preview` pass: fresh title, launch/audio fallback, controls, death report, Dust persistence, atomic Hull Matrix purchase, reload, stronger next run.
- Adversarial pass: idle, rapid keys/clicks, insufficient/max purchases, repeated routes, pause, hide/show, refresh, corrupted save, reduced motion, low quality, high DPR, dense late-game entities. No console errors, duplicate transitions, runaway entity counts, or hidden simulation progress.
