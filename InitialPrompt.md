# Super Roguedust — One-Shot Build Directive

## Mission

You are going to research, design, architect, build, test, balance, and polish a complete game in a single autonomous session. There is no human in the loop. You will receive no further input, no answers to questions, and no approvals — do not ask questions, do not present options and wait, do not pause for confirmation. When you face a decision, make the best judgment call, record it in your notes, and keep moving. This is a demonstration of what you can do unassisted: aim for something you would be proud to ship commercially. This is a large project — expect many hours of work. Do not cut scope to finish early. The Definition of Done at the bottom is the finish line, not the clock.

## The Concept

**Super Roguedust.** Start from the PS3/PS4 arcade game *Super Stardust HD/Ultra* and build it into a deep, modern **roguelite**. Runs end in death; death is progress. Every run earns currency that is banked and spent between runs on persistent meta progression that makes the player permanently more powerful and able to get further next run.

## Requirements (the *what* — the *how* is entirely yours)

- **Core action game rooted in Super Stardust.** The player pilots a ship with twin-stick style controls. Beyond that foundation, modernize freely. 
- **Controller Support**.
- **Globe traversal**. An iconic design within Super Stardust is that the game-level is a sphere that the player can move around, and the bullets, enemies, pickups, etc move on that sphere as you would expect.
- **Persistent meta progression is the heart of the game.** Every run matters. Currency earned in runs is spent between runs on permanent unlocks and upgrades.
- **Power philosophy:** the dominant source of player power is the meta layer — think *Rogue Legacy*. In-run upgrades and temporary boons are welcome as seasoning that makes individual runs distinct, but avoid the *Vampire Survivors* pattern where a constant in-run upgrade drip is the main power curve.
- **Unfolding design.** The game should continuously reveal new mechanics, systems, enemy types, and content as the player progresses — unlocks that open up genuinely *new ways to play*, not just bigger numbers. The player should still be discovering new things after hours of play.
- **Bosses**, and the other trappings of a modern roguelite.
- **Ship unlocks and/or ship upgrade paths** are required. Equipment or similar systems are optional — your call.
- **Content depth:** several hours of gameplay content.
- **Presentation:** professional, commercial quality. The player prefers a *Geometry Wars*-style modern neon/particle presentation over retro vector minimalism — the final aesthetic call is yours, but it must look like a real product, not a prototype.
- **Audio:** make a genuine attempt at both sound effects and music, generated procedurally (WebAudio). 
- The game is titled **Super Roguedust** — brand it in-game.

## Research First

Before designing anything, conduct real research on modern roguelites using web search: what makes meta progression compelling, how the best games in the genre pace their unlocks and "unfold" new systems, how they structure bosses, difficulty, and the "one more run" hook. Distill your findings into `DESIGN.md`, make your design decisions, and then commit to them.

## You Own the Entire Stack

You are the researcher, game designer, architect, engineer, QA team, and producer:

1. **Research** the genre (above).
2. **Design** the game — write `DESIGN.md` covering mechanics, progression/economy, unlock tree, bosses, content plan.
3. **Architect** — choose the tech approach you judge most likely to produce a high-quality, reliable result within the constraints below.
4. **Break the work into tasks** — maintain `TODO.md` and keep it current as you work.
5. **Implement.**
6. **Verify** (see Self-Verification below).
7. **Balance and polish** until the Definition of Done is satisfied.

## Hard Constraints

- Browser game. Desktop only. Target current desktop Chrome.
- Use Vite as your dev server and build tool. The game must be playable with a single command (`npm run dev`), and `npm run build` must produce a working production build (verified via `vite preview`).
- Zero network at runtime: no CDNs, no fetched fonts, no downloaded assets. Runtime libraries, if any, must come through npm and be bundled into the build.
- Persistence via `localStorage`.
- Everything lives in this directory.

## Process Requirements

- `git init` immediately. Commit at every meaningful milestone with clear messages, so no amount of late-stage disaster can destroy earlier work.
- Maintain `NOTES.md` continuously: key decisions, current status, next steps. Assume your context may be compacted at any point mid-run — if that happens, re-read `DESIGN.md`, `NOTES.md`, and `TODO.md` before continuing.
- Run everything headless/non-interactive. Never launch anything that blocks waiting for input. If a tool or approach fails repeatedly, switch approaches rather than retrying indefinitely.

## Self-Verification

- Iterate against the Vite dev server, but the final QA pass must run against the production build (`npm run build` + `vite preview`) — test what actually ships, not just dev mode.
- Zero console errors across full play sessions. Eliminate warnings where reasonable.
- Verify the complete core loop end to end, from a **wiped localStorage state**: new player → play → die → earn currency → buy a meta upgrade → **reload the page** → progress persisted → next run is measurably stronger.
- Verify every unlock, upgrade, boss, and feature you build actually triggers and functions in-game. No dead content.
- Performance: smooth (60fps target) under heavy load — screens full of asteroids, enemies, and particles.
- Play adversarially: mash keys, die instantly, idle without input, buy everything, buy nothing, spam clicks in menus.
- Balance pass: playtest via scripted runs and sanity-check the progression pacing — the game should feel rewarding from the very first runs while long-term goals stay meaningful.
- When you believe you are done: perform one final, full, adversarial QA pass of everything above from a completely fresh state. Fix what you find, commit, and repeat the full pass until it comes back clean.

## Definition of Done

- The game launches with `npm run dev`, the production build succeeds and runs cleanly via `vite preview`, and play produces no console errors.
- The complete meta loop is verified end to end, including persistence across page reloads.
- All designed content is implemented and reachable in real play: the unlock tree, bosses, ships, and every system in `DESIGN.md`.
- It looks professional and has sound and music.
- Several hours of content, with new mechanics still unfolding deep into progression.
- A stranger could sit down, play three runs, and feel the pull of "one more run."
- Final commit is made.
