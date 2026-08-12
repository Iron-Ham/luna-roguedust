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
