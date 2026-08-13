# Super Roguedust Notes

## 2026-08-12 — foundation

- Repository initialized on `main`; Vite and TypeScript are the only development dependencies.
- Design contract records the fixed 1600x900 arena, five-sector route rhythm, exact economy, ships, boons, bosses, Threat Protocol, accessibility, and production QA requirements.
- Source boundary now includes stable types, seeded math, validated localStorage persistence, keyboard/pointer/gamepad snapshots, lazy procedural audio, and the fixed-step simulation with bounded enemy/projectile/particle/pickup caps.
- Production build succeeds; preview browser QA passed title, first gesture launch, route overlay, salvage cache, combat controls, death report, Dust banking, atomic Hull Matrix purchase, reload persistence, upgraded 110-hull HUD, and pause/resume.
- Current milestone: deterministic core loop stable; all content definitions and route/boss selection paths are now wired but need exhaustive content QA.
- Next action: exercise every route kind, boon handoff, full enemy roster, boss phases, and progression unlock path.
- Known issue: 404 favicon request fixed with an inline local data icon; full boss/progression QA remains.

## 2026-08-12 — content and targeting

- Production preview exercise reached `GRINDER` and `RAIL WARDEN` with actual phase transitions and defeated both in seeded QA runs. Rewards, sector unlocks, `PRISM ROUNDS`, `RIFT STEP`, `DRONE PACT`, enemy discoveries, and transmission cards persisted immediately through the shared save object.
- Verified `ELITE` clears into a deterministic two-card boon selection; selecting `DRONE PACT` changed subsequent run combat, and `MARKET` spent exactly 80 run Dust once despite rapid duplicate clicks.
- Pointer aim originally used arena-center deltas, which made shots miss after movement. Input snapshots now carry logical pointer targets and simulation aims from player position; boss shots visibly track the cursor.
- Added actual prism reflection, sentinel aperture blocking, Nova charge/release and gravity pull, Mirage decoy rendering, and Afterimage dash damage trail. Tuned elite density and first-boss damage for a readable first-clear path.
- Current milestone: route/enemy/boss/boon content stable; persistent progression and presentation QA remain.
- Next action: exercise ship abilities, every meta level, malformed saves, Threat Protocol toggles, settings, reduced motion, and dense late-game rendering.

## 2026-08-12 — presentation pass

- Canvas QA screenshot confirms cached starfield, fracture boundary, neon ship silhouettes, hostile shape grammar, boss health/phase telegraphs, and semantic DOM route/report overlays at desktop production resolution.
- HUD now keeps ship identity, dash/ability readiness, and temporary boon build visible during combat; Canvas renderer remains capped by `HIGH`/`BALANCED`/`LOW` quality and reduced-motion settings.
- Dev smoke passed title -> launch -> route with zero console errors, page errors, or failed requests. Production preview remains the final verification target.
- Next action: run final fresh-state preview QA, adversarial lifecycle checks, and quality/reduced-motion evidence.

## 2026-08-12 — final QA

- `npm run build` passes against the production bundle; `npm run dev -- --host 127.0.0.1` smoke passed title -> launch -> route with zero console/page errors and no failed requests.
- `vite preview --host 127.0.0.1` production QA passed fresh title branding, first gesture launch, route choices, safe salvage, combat movement/fire/dash/ability, death report, positive Dust recovery, hangar banking, insufficient-Dust Hull Matrix state, page reload, and upgraded-HUD persistence in a prior 110-hull run.
- Production QA passed `GRINDER` and `RAIL WARDEN` normal path defeats in seeded snapshots, sector unlocks, ship blueprint purchase, `ELITE` boon selection, `MARKET` one-time purchase, archive records, malformed-save recovery notice, and no console errors.
- Settings interactions persisted reduced motion and `LOW` quality; high-DPR canvas rendered at 2000x1125 logical backing resolution for a 1.25 DPR viewport. Pause/resume and visibility lifecycle produced no console errors.
- Remaining verification limit: exhaustive five-boss/late-game density and every ship/boon phase were not all played in one fresh normal run; deterministic saved snapshots covered the first two bosses and multiple ship/content paths.
- Production command: `npm run preview -- --host 127.0.0.1`.

## 2026-08-12 — balance polish

- Fixed a dead-end when an `ELITE`/`RIFT` node completed with a full three-boon build: the node now advances without rendering an empty boon screen.
- `SALVAGE/PATCH` is now a real disabled button at full hull or under `SCARCITY`; `CACHE` and `CHARGE` remain available. Removed a duplicate `CHARGE` application in the simulation.
- Final saved-snapshot QA armed all five Threat Protocol modifiers; a live combat screenshot showed `HEAT 195%`, and the five toggles persisted after debounce. HUD displayed build, dash, ability, ship identity, and health/energy.
- Final production preview boot, launch, route, and control checks remained at zero console errors, page errors, and failed requests.

## 2026-08-12 — globe revision

- Replaced the planar arena with a player-centered longitude/latitude globe. Surface movement wraps longitude, clamps latitude, and projects depth for occlusion; projectiles and enemy motion use finite angular surface ranges.
- Replaced route roulette with authored per-sector node sequences. Salvage, elite, rift, market, chest rewards, cargo signals, and the five boss gates remain deterministic under seeded runs.
- Added Pulse/Scatter/Rail/Nova weapon cycling, kinetic/plasma/cryo/void weaknesses, score multipliers, persistent score-milestone Dust, cargo supplies, destructible reward chests, and controller-first HUD telemetry.
- Production globe screenshot confirms sphere shading, graticule lines, depth-readable entities, surface combat, score/multiplier HUD, weapon identity, bomb/shield counts, and no browser console/page/request errors.
- Remaining verification: sustained full campaign progression and late-game density stress after the globe migration.

## 2026-08-12 — globe QA follow-up

- `npm run build` passes after the migration.
- Production preview fresh-state smoke reached the live globe with the overlay hidden, 2000x1125 balanced-quality canvas backing, and zero console errors, page errors, or failed requests.
- Live QA exercised movement, mouse fire, Q weapon swap, E ability, Space dash, F bomb, score/multiplier HUD, authored `SWEEP -> SALVAGE -> ELITE` sequence, salvage cache handoff, reward chest spawning, and score milestone persistence.
- The complete five-boss campaign and late-game density remain unplayed in one normal run because the globe's first-node hazard rate is intentionally high under stale saved progression snapshots; deterministic source paths and bounded pools are implemented, but exhaustive boss coverage is still a follow-up verification limit.

## 2026-08-12 — control/readability diagnosis

- Reproduced the control complaint against the production globe. The ship was projected at the arena center, but input advanced geographic longitude/latitude with a fixed axis, so screen directions felt rotated as the camera latitude changed.
- Confirmed cargo scheduling was unconditional: once `elapsed >= cargoTimer`, every subsequent combat node could immediately create another event after expiry. Cargo is now disabled by default and no longer loops automatically.
- Added explicit far-side suppression/depth language and a globe orientation legend. Surface movement remains deterministic and player-centered.

## 2026-08-12 — control/readability fix verification

- `npm run build` passes after the control and event changes.
- Dev-browser smoke from cleared storage exercised launch, movement, mouse fire, Q weapon swap, E ability, and Space dash with zero console errors, page errors, or failed requests.
- After 9 seconds of combat, no cargo event appeared; cargo is no longer an unavoidable recurring interruption.
- The first focused screenshot after the long smoke landed on the death report, so the remaining visual evidence is the existing live-globe screenshot plus the explicit depth legend/source path. Full five-boss progression remains outside this fix's scope.
